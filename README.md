# 订阅链接合并工具

可以将多个订阅链接合并为一个订阅链接，方便在订阅客户端中使用。

30min 自动更新一次订阅链接，访问接口时也会更新订阅链接。

## 使用方法

在 ./urls.txt 文件中填写需要合并的订阅链接，每行一个。

```txt
https://example.com/1
https://example.com/2
```

nodejs 环境下运行：

```bash
yarn start
```

docker 环境下运行：

```bash
yarn docker
```

docker 打包

```bash
yarn docker:build
```

## 获取订阅链接

访问 `http://localhost:3000` 获取合并后的订阅链接
