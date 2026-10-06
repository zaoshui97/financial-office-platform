# 前端多阶段构建：node 构建 -> nginx 托管
# 阶段 1：用 node 22 alpine 构建静态资源
FROM node:22-alpine AS builder

ENV NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

WORKDIR /srv/web

# 利用 docker 层缓存
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# 复制源代码与配置
COPY . .

# 构建参数：
#   - VITE_API_BASE_URL：相对路径 /api/v1，由运行时 nginx 反代到 backend:8000
#   - VITE_USE_MOCK=false 严格走真实后端
#   - 业务方如需切换 mock，请通过构建参数覆盖
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_USE_MOCK=false
ARG VITE_APP_TITLE=金融智能办公平台
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_USE_MOCK=${VITE_USE_MOCK} \
    VITE_APP_TITLE=${VITE_APP_TITLE}

RUN npm run build

# 阶段 2：nginx 1.27 alpine 托管静态资源
FROM nginx:1.27-alpine AS runtime

# 替换默认站点配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 把构建产物拷到 nginx 默认目录
COPY --from=builder /srv/web/dist /usr/share/nginx/html

# 健康检查：访问 / 看 nginx 是否返回 200
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]