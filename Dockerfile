FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p data qrcode

EXPOSE 3456 8081

ENV NODE_ENV=production
ENV CONFIG_FILE=/app/config.yaml

CMD ["node", "build/index.js"]
