# 使用 Node.js 作為建構環境
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 使用 Nginx 作為正式環境的網頁伺服器
FROM nginx:stable-alpine
COPY --from:build-stage /app/dist /usr/share/nginx/html
# 或是如果您的 build 輸出資料夾叫 build，請改為 /app/build
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
