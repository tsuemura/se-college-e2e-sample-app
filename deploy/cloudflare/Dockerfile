# 講座のデモ環境用。アプリをそのまま動かすだけ（ビルドコンテキストはリポジトリ直下）
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY app ./app
COPY docs ./docs
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "app/server.js"]
