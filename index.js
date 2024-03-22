// VPN 配置文件和并器
// 被请求之后会更新配置文件，每隔壁30min更新一次

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const schedule = require("node-schedule");
const yml = require("js-yaml");
const express = require("express");
const md5 = require("md5");
const router = express();
const log4js = require("log4js");
const logger = log4js.getLogger("clash-puller");
logger.level = "info";

async function main() {
  logger.info("开始更新配置文件");
  // 获取url列表 urls.txt
  let urls = "";
  try {
    urls = fs
      .readFileSync(path.join(__dirname, "urls.txt"), "utf-8")
      .split("\n")
      .filter((url) => url.trim() !== "")
      .map((url) => {
        let arr = url.split(" ");

        if (arr.length === 2) {
          return {
            name: arr[0],
            url: arr[1],
          };
        } else if (arr.length === 1) {
          return {
            name: md5(url),
            url: url,
          };
        }
      });
  } catch (e) {
    logger.warn("./urls.txt 不存在");
    logger.error("error:", e);
  }

  //链接去重
  for (let i = 0; i < urls.length; i++) {
    for (let j = i + 1; j < urls.length; j++) {
      if (urls[i].url === urls[j].url) {
        urls.splice(j, 1);
        j--;
      }
    }
  }

  //   logger.info(urls);

  let config_all = {
    "mixed-port": 7890,
    "allow-lan": false,
    IPV6: false,
    mode: "rule",
    UDP: true,
    "log-level": "silent",
    "external-controller": "127.0.0.1:9090",
    "unified-delay": true,
    secret: "",
    proxies: [],
    "proxy-groups": [],
    rules: [
      "DOMAIN-SUFFIX,local,DIRECT",
      "IP-CIDR,127.0.0.0/8,DIRECT",
      "IP-CIDR,172.16.0.0/12,DIRECT",
      "IP-CIDR,192.168.0.0/16,DIRECT",
      "IP-CIDR,10.0.0.0/8,DIRECT",
      "IP-CIDR,17.0.0.0/8,DIRECT",
      "IP-CIDR,100.64.0.0/10,DIRECT",
    ],
  };
  // 获取配置文件，如果没有则创建
  for (const url of urls) {
    try {
      logger.info("获取配置文件:", url.url);
      const { data } = await axios.get(url.url);
      const config = yml.load(data);

      fs.writeFileSync(
        path.join(__dirname, "data", `${url.name}.yml`),
        yml.dump(config),
        {
          encoding: "utf-8",
          flag: "w",
        }
      );
      // 保留json格式
      fs.writeFileSync(
        path.join(__dirname, "data", `${url.name}.json`),
        JSON.stringify(config),
        {
          encoding: "utf-8",
          flag: "w",
        }
      );
      logger.info("获取配置文件成功,URL:", url.url);

      try {
        addRandomNum(config, url.url);
      } catch (e) {
        logger.warn("文件格式错误", url.name);
      }
    } catch (e) {
      logger.warn("获取配置文件失败,URL:", url.url);

      // 读取本地文件
      // 打开文件
      let file = "";
      try {
        file = fs.readFileSync(
          path.join(__dirname, "data", `${url.name}.yml`),
          "utf-8"
        );
      } catch (e) {
        logger.warn("本地文件不存在", url.name);
        continue;
      }
      try {
        addRandomNum(yml.load(file), url.url);
      } catch (e) {
        logger.warn("本地文件格式错误", url.name);
      }
      continue;
    }
  }

  function addRandomNum(config, orginUrl) {
    // 随机数
    let rand = Math.floor(Math.random() * 10000);
    // 节点名称加上随机数
    config["proxies"].forEach((proxy) => {
      let oldName = proxy.name;

      proxy.name = `${proxy.name}${rand}`;
      proxy.orginUrl = orginUrl;
      config["proxy-groups"].forEach((group) => {
        group["proxies"].forEach((name, index) => {
          if (name === oldName) {
            group["proxies"][index] = `${proxy.name}`;
          }
        });
      });
    });

    // // 组名加上随机数
    // config["proxy-groups"].forEach((group) => {
    //   let oldName = group.name;
    //   group.name = `${group.name}${rand}`;
    //   config["proxy-groups"].forEach((group_) => {
    //     group_["proxies"].forEach((name, index) => {
    //       if (name === oldName) {
    //         group_["proxies"][index] = `${group.name}`;
    //         // logger.info("group.proxies", group["proxies"]);
    //       }
    //     });
    //   });
    //   config["rules"].forEach((rule) => {
    //     // 如果以组名结尾
    //     if (rule.endsWith(oldName)) {
    //       rule = rule.replace(oldName, group.name);
    //     }
    //   });
    // });

    // 合并配置文件
    config_all.proxies.push(...config.proxies);
    // config_all["proxy-groups"].push(...config["proxy-groups"]);
    // config_all.rules.push(...config.rules);
    config_all["proxy-groups"] = [];
    // 只需要2个组，一个包含全部，另一个是全部+自动
    config_all["proxy-groups"][0] = {
      name: "🔰节点选择",
      type: "select",
      //   proxies: config.proxies.map((proxy) => proxy.name),
      proxies: ["自动选择"].concat(config.proxies.map((proxy) => proxy.name)),
    };

    config_all["proxy-groups"][1] = {
      name: "自动选择",
      type: "url-test",
      proxies: config.proxies.map((proxy) => proxy.name),
      interval: "300",
      url: "https://www.gstatic.com/generate_204",
    };

    // 规则去重
    // config_all.rules = [...new Set(config_all.rules)];

    // 保存配置文件
    fs.writeFileSync(path.join(__dirname, "config.yml"), yml.dump(config_all), {
      encoding: "utf-8",
      flag: "w",
    });
  }
}

main();
// 定时任务
schedule.scheduleJob("0 */30 * * * *", main);

// 服务器

// 解决跨域问题
router.all("*", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  next();
});

// 获取配置文件
router.get("/get", (req, res) => {
  logger.info("/get");
  const file = fs.readFileSync(path.join(__dirname, "config.yml"), "utf-8");
  res.send(file);
  //   main();
});
// 获取配置文件
router.get("/update", (req, res) => {
  logger.info("/update");
  main();
});

// 错误处理
router.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("服务器错误");
});

router.listen(3333, () => {
  logger.info("Server is running on http://127.0.0.1:3333");
});
