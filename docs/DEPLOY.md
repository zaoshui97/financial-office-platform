# 部署教程（Phase 1）

> 适用版本：前端 `/api/v1` 与后端 FastAPI（`API_V1_PREFIX=/api/v1`）联通，使用 Docker Compose 编排。

## 0. 目录速览

```
financial-office-platform/
├── Dockerfile                 # 后端镜像（python:3.12-slim）
├── docker-compose.prod.yml    # 生产编排（前端 + 后端 + MySQL + Redis + Qdrant）
├── .env.prod                  # ⚠️ 由 .env.deploy 改名而来；绝对不要提交到 git
├── scripts/
│   ├── start.sh               # 容器内启动：等 DB → 跑迁移 → uvicorn
│   └── create_user.py         # 创建初始用户（admin）
└── frontend/digital-horse/
    ├── Dockerfile             # 前端镜像（node 22 → nginx 1.27）
    └── nginx.conf             # SPA + /api/ 反代 backend:8000
```

## 1. 准备服务器

- Linux x86_64（Ubuntu 22.04 / Debian 12 推荐），建议 ≥ 4C8G
- 开放端口：80 / 443（前端 + edge Nginx）、后端 8000 仅容器内
- 安装 Docker 24+ 与 docker compose plugin：

  ```bash
  curl -fsSL https://get.docker.com | bash
  usermod -aG docker $USER
  # 退出重新登录生效
  docker --version
  docker compose version
  ```

## 2. 准备 `.env.prod`

```bash
cd /path/to/financial-office-platform
cp .env.deploy .env.prod
```

`.env.prod` 必须修改的关键字段（**不要沿用示例值**）：

| 字段 | 说明 | 生成命令示例 |
|------|------|--------------|
| `SECRET_KEY` | JWT 签名密钥（≥32 字符） | `openssl rand -hex 32` |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | `openssl rand -hex 32` |
| `MYSQL_PASSWORD` | 应用访问 MySQL 的密码 | `openssl rand -hex 32` |
| `MYSQL_USER` | 应用用户（建议非 root） | 自定义 |
| `MYSQL_DATABASE` | 数据库名 | `financial_office` |
| `CORS_ORIGINS` | 允许的前端域名（生产请改成 `https://your-domain.com`） | JSON 数组 |
| `API_IMAGE_TAG` | 镜像标签（CI/CD 用） | `v0.1.0` |

> 生产 CORS 必须**只放正式域名**；否则安全审计过不去。

### AI / 向量相关（可后续再配）

`.env.prod` 里的 `AI_API_KEY` / `EMBEDDING_API_KEY` / `QWEN_API_KEY` 等可以先留空，等接模型阶段再补：
- 不配 → 业务路由报"未配置 AI key"，但不影响登录、迁移、健康检查。

## 3. 构建并启动

```bash
# 构建镜像（首次约 5-10 分钟）
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# 后台启动
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 查看日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f --tail=200
```

启动顺序：
1. MySQL / Redis / Qdrant 各自跑健康检查
2. Backend 启动：先 `wait-for-db` → 跑 `alembic upgrade head` → 启 uvicorn
3. Frontend 启动：build 阶段已经完成，runtime 直接 nginx

> **迁移策略**：`DATABASE_CHECK_ON_STARTUP=false`，迁移由容器启动脚本显式跑（`RUN_MIGRATIONS_ON_START=true`）。
> 如果只想先起容器再手动迁移，把 backend env 的 `RUN_MIGRATIONS_ON_START` 设为 `false`，然后：
> ```bash
> docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend alembic upgrade head
> ```

## 4. 创建初始 admin

**推荐做法**：把密码放在 shell 环境变量，避免进 history：

```bash
export ADMIN_PASSWORD="$(openssl rand -hex 16)"
echo "$ADMIN_PASSWORD" > /root/.admin_password   # 临时存一下；妥善保管
unset HISTFILE   # 或者直接执行下一条命令，不要进 .bash_history

docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T backend \
  python scripts/create_user.py \
    --username admin \
    --email admin@example.com \
    --password-env ADMIN_PASSWORD \
    --full-name 管理员 \
    --superuser
```

成功会输出：

```
[ok] 用户创建成功
  id          = 1
  username    = admin
  email       = admin@example.com
  full_name   = 管理员
  is_active   = True
  is_superuser= True
  api_v1      = /api/v1
```

> 不要硬编码默认密码。本脚本支持 `--password-env <ENV_VAR>` / `--password <value>` / 交互式输入三种方式，**严禁**提交含真实密码的 `.env.prod` 或 compose 文件。

可选：再创建几个普通用户：

```bash
export USER_PASSWORD="..."  # 同样问题这里也复现
docker compose exec -T backend python scripts/create_user.py \
  --username finance01 --email finance01@example.com \
  --password-env USER_PASSWORD --full-name 财务张三
```

## 5. 验证

### 5.1 后端存活

```bash
# 容器内
docker compose -f docker-compose.prod.yml exec backend \
  curl -s http://127.0.0.1:8000/api/v1/system/health/live | jq

# 期望：
# { "status": "alive", "service": "金融企业智能办公平台", "version": "0.1.0" }

# 就绪（会访问 MySQL）
docker compose -f docker-compose.prod.yml exec backend \
  curl -s http://127.0.0.1:8000/api/v1/system/health/ready | jq
```

### 5.2 登录拿到 token（CLI 测试）

```bash
# OAuth2PasswordRequestForm 用 form 表单
curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=$ADMIN_PASSWORD" | jq

# 期望：
# {
#   "access_token": "eyJ...",
#   "token_type": "bearer",
#   "expires_in": 7200
# }
```

### 5.3 校验 token

```bash
TOKEN="eyJ..."
curl -s http://127.0.0.1:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
# 期望返回 admin 的 UserRead
```

### 5.4 前端

`docker compose ps` 里 `frontend` 应为 healthy。访问宿主机 `http://<server-ip>/`：

1. 自动落到 `/login`
2. 输入 admin 账号 + 上面设置的密码
3. 登录成功 → 自动跳 `/dashboard`
4. 浏览器 DevTools Network 看到 `/api/v1/auth/login` → 200，`/api/v1/auth/me` → 200

### 5.5 Nginx HTTPS 由部署层处理

本文档不直接处理证书。两种常见方案：

#### 方案 A：用一台边缘 Nginx 反代 `frontend` 容器

```nginx
# /etc/nginx/conf.d/finoffice.conf
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 反代到 frontend 容器
    location / {
        proxy_pass         http://127.0.0.1:8080;   # 宿主机端口映射或 docker network IP
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto  https;
    }
}
```

把 `frontend` 容器端口暴露给宿主机（例如 `- 8080:80`），再让边缘 Nginx 反代。

#### 方案 B：certbot 自动签证书

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5.6 日志与排查

```bash
# 实时日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f frontend

# 进入容器排查
docker compose exec backend bash
> ls /srv/app/logs          # JSON 滚动日志
> ls /srv/app/storage       # 上传文件
```

## 6. 升级

```bash
# 1. 拉新代码
git pull

# 2. 修改 .env.prod（如有新增字段），不要变更 SECRET_KEY / MYSQL_PASSWORD
# 3. 重新构建
docker compose -f docker-compose.prod.yml --env-file .env.prod build backend frontend
# 4. 滚动重启（迁移会在 backend 启动时自动跑）
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d backend frontend
```

## 7. 备份与恢复

```bash
# MySQL 备份
docker compose -f docker-compose.prod.yml --env-file .env.prod exec mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' > backup_$(date +%F).sql

# Qdrant 快照（生产按需启用）
docker compose -f docker-compose.prod.yml --env-file .env.prod exec qdrant \
  curl -X POST http://127.0.0.1:6333/snapshots
```

## 8. 常见问题

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 容器反复 restart | MySQL 没就绪 / `SECRET_KEY` 不足 32 位 | 看 `docker compose logs backend` |
| 前端 `/api/v1/*` 502 | backend 容器未 healthy / 反代配置错 | `curl backend:8000/api/v1/system/health/live` |
| 登录 401 | 用户名不存在 / 账号 `is_active=False` | 重新跑 `create_user.py`；或 SQL 启用账号 |
| 登录后 403 | 用户角色不匹配 | Phase 1 仅 SUPER_ADMIN / USER；中间状态等 Phase 2 |
| CORS 报错 | `.env.prod` 中 `CORS_ORIGINS` 没含访问域名 | 改成 `https://your-domain.com`，重启 backend |

## 9. 已确认 ✅ vs 仍 Mock ⚠️（Phase 1）

✅ 已接真实后端
- `/api/v1/auth/login`（OAuth2PasswordRequestForm）
- `/api/v1/auth/me`
- `/api/v1/system/health/live|ready`
- 创建初始用户脚本（admin / 普通用户）
- 前端 `/api/v1` 真实路由鉴权 + Login 跳回 from
- Dockerfile / docker-compose.prod.yml / Nginx 反代

⚠️ 仍依赖 Mock（待 Phase 2）
- Dashboard / Meeting / Knowledge / IndustryNews / Approval / Sandbox / Report / Contacts 等业务页面的列表 / 详情
- `src/api/modules.ts` 中 `userApi / knowledgeApi / meetingApi / documentApi / insightApi` 等 mock 风格定义
- `src/mock/**`、`useDemoMode` 等演示数据
- `src/api/ai.ts` 直接调用 DeepSeek 公共 API（**生产安全风险**，待后端代理迁移）

详见同目录 `docs/PHASE2_MOCK_REMNANTS.md`。