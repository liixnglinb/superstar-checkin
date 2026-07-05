FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* yarn.lock* ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npm run build

# 创建运行时所需目录
RUN mkdir -p data qrcode

# 暴露端口：3456 = QR API，8081 = OneBot WebSocket
EXPOSE 3456 8081

# 运行
CMD ["node", "build/index.js"]
