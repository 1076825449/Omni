FROM node:20-alpine

WORKDIR /app

# 先复制 package.json 再安装依赖（利用 Docker 缓存）
COPY package.json package-lock.json* ./
RUN npm install

# 复制源码
COPY . .

EXPOSE 5173

ENV VITE_API_BASE=http://localhost:3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
