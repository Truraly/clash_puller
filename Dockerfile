FROM node:18-alpine
COPY ./node_modules /app
COPY ./index.js /app
WORKDIR /app
CMD node /app/index.js
