# 阿里云 ACR 镜像部署完整教程（financial-office-platform）

> **适用项目**：financial-office-platform（前端 React + 后端 FastAPI + MySQL + Redis + Qdrant）
> **镜像仓库**：阿里云 ACR 个人版，地域华东 1（杭州）
> **命名空间**：`financial-project`（已创建）
> **目标**：把整个项目打成 2 个 Docker 镜像推上 ACR，主办方机器拉下来 + 拉 3 个公共中间件镜像，一键 `docker compose up -d` 起服务

---

## 凭证速查表（交付时核对）

| 项 | 值 | 用途 |
|---|---|---|
| ACR Registry | `cr.cn-hangzhou.aliyuncs.com` | 推送/拉取镜像 |
| 命名空间 | `financial-project` |  |
| 仓库 1（后端） | `financial-project/finoffice-backend:v1` |  |
| 仓库 2（前端） | `financial-project/finoffice-frontend:v1` |  |
| Docker 登录账号 | `19730583619` | `docker login --username=19730583619 cr.cn-hangzhou.aliyuncs.com` |
| Docker 登录密码 | AccessKey Secret（**见 AccessKey 交付单，不在本文档**） | 推送端凭证 |
| `MYSQL_ROOT_PASSWORD` | `f30126dcf7c9ed5e30a9f50f83e4bddabc2cc033bcc3bdf69eacf28261503a0a` | 数据库 root 密码 |
| `MYSQL_PASSWORD` | `932653ddfdfe66c8621cb050a344c64f88c9c63f54a530bc93d485781c13b7d1` | 数据库业务用户密码 |
| `JWT_SECRET` | `0fa39f2c8b5be024d91fd857b256177cb7450a6cfa77497076a7ae232ebd10e3` | JWT 签名 |
| 初始管理员账号 | `admin` / `ajbPRPTfFShYCUR` | 首次登录（**登录后请立即修改**） |

---

## 整体架构（先看明白再动手）

```
┌─────────────── 阿里云 ACR 镜像仓库（cr.cn-hangzhou.aliyuncs.com/financial-project/）───────────────┐
│                                                                                                  │
│   ┌──────────────────────────┐        ┌──────────────────────────┐                               │
│   │ finoffice-frontend:v1   │        │  finoffice-backend:v1    │                               │
│   │ (nginx + 前端 dist)      │   +    │ (python + FastAPI)      │                               │
│   └──────────────────────────┘        └──────────────────────────┘                               │
│                                                                                                  │
│   ┌──────────────────────────┐        ┌──────────────────────────┐   ┌──────────────────────┐    │
│   │ mysql:8.4               │        │ redis:7-alpine          │   │ qdrant/qdrant:latest │    │
│   │ (主办方机器本地直查)   │        │                          │   │                      │    │
│   └──────────────────────────┘        └──────────────────────────┘   └──────────────────────┘    │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

主办方机器：
  frontend (80) ──> backend (8000) ──> mysql (3306)
                              ├──> redis (6379)
                              └──> qdrant (6333)
```

**关键**：本项目要打 **2 个镜像**（frontend + backend），MySQL / Redis / Qdrant 这 3 个用阿里云 Docker Hub 镜像加速器直接拉官方公共镜像即可。

---

## 第一部分 · 开发人员本地操作（推送镜像到 ACR）

### Step 0：前置准备（5 分钟）

✅ 已完成：
- ✅ Docker Desktop 已安装（Windows / Mac / Linux）
- ✅ 阿里云账号已注册
- ✅ ACR 个人版实例已创建（华东 1 杭州）
- ✅ 命名空间 `financial-project` 已创建
- ✅ 仓库 `finoffice-backend` 和 `finoffice-frontend` 已创建（或不需要预创建，push 时自动创建）

❓ 需要确认：
- AccessKey ID + Secret（控制台右上角头像 → AccessKey 管理 → 创建）

### Step 1：登录阿里云 Docker Registry

打开 PowerShell（Windows）或 Terminal（Mac/Linux），执行：

```powershell
docker login --username=你的阿里云账号 cr.cn-hangzhou.aliyuncs.com
```

**注意**：
- 用户名填阿里云账号（手机号或邮箱）
- 密码填 **AccessKey Secret**（不是登录密码！）

登录成功会显示：`Login Succeeded`

> ⚠️ 安全提示：演示完成后立即去 ACR 控制台删除该 AccessKey。

### Step 2：配置 Docker 国内镜像加速器（避免拉基础镜像超时）

打开 Docker Desktop → **Settings** → **Docker Engine**，把下面这段贴进去（替换原内容），点 **Apply & restart**：

```json
{
  "registry-mirrors": [
    "https://docker.nju.edu.cn",
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
```

验证加速器生效：

```powershell
docker info | Select-String -Pattern "Registry Mirrors"
```

应该能看到上面 3 个地址。

### Step 3：构建后端镜像

打开 PowerShell，**进入项目根目录**：

```powershell
cd D:\Apexis\financial-office-platform
```

构建镜像（首次构建会拉 `python:3.12-slim` + 装依赖，约 3-5 分钟）：

```powershell
docker build -t finoffice-backend:v1 -f Dockerfile .
```

**参数说明**：
- `-t finoffice-backend:v1`：镜像名:标签
- `-f Dockerfile`：指定 Dockerfile 路径（项目根目录的）
- 末尾 `.`：构建上下文（当前目录）

### Step 4：构建前端镜像

进入前端目录：

```powershell
cd frontend\digital-horse
```

构建镜像（首次构建会拉 `node:22-alpine` + 装 npm 依赖 + nginx，约 5-8 分钟）：

```powershell
docker build -t finoffice-frontend:v1 -f Dockerfile .
```

### Step 5：验证本地镜像

```powershell
docker images | Select-String -Pattern "finoffice"
```

应该看到：
```
finoffice-frontend   v1   xxxxx   xxxxx   xxx MB
finoffice-backend    v1   xxxxx   xxxxx   xxx MB
```

### Step 6：给镜像打阿里云 ACR 标签

**后端**：

```powershell
docker tag finoffice-backend:v1 cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-backend:v1
```

**前端**：

```powershell
docker tag finoffice-frontend:v1 cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-frontend:v1
```

**规则**：`cr.cn-hangzhou.aliyuncs.com/命名空间/仓库名:标签`

### Step 7：推送镜像到阿里云 ACR

**后端**：

```powershell
docker push cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-backend:v1
```

**前端**：

```powershell
docker push cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-frontend:v1
```

推送成功后，到 ACR 控制台 → 镜像仓库 → 选 `financial-project` 命名空间，能看到 2 个仓库各有 1 个 `v1` 版本。

---

## 第二部分 · 主办方机器部署操作

### Step A：环境准备

- 机器已安装 Docker Desktop 或 Docker Engine
- 已配置国内镜像加速器（同 Step 2）
- 机器可以访问公网（拉镜像需要）

### Step B：登录 ACR 私有仓库

```bash
docker login --username=你的阿里云账号 cr.cn-hangzhou.aliyuncs.com
```

> 凭证由开发人员当面交付或通过安全渠道传递。

### Step C：拉取项目镜像

```bash
docker pull cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-backend:v1
docker pull cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-frontend:v1
```

### Step D：创建项目目录与配置文件

```bash
mkdir -p finoffice && cd finoffice
```

创建 `.env.prod` 文件（**复制下面整段粘贴**，把密码改为开发人员提供的值）：

```bash
cat > .env.prod <<'EOF'
# 数据库密码（强随机 32 位 hex）
MYSQL_ROOT_PASSWORD=f30126dcf7c9ed5e30a9f50f83e4bddabc2cc033bcc3bdf69eacf28261503a0a
MYSQL_USER=finoffice
MYSQL_PASSWORD=932653ddfdfe66c8621cb050a344c64f88c9c63f54a530bc93d485781c13b7d1
MYSQL_DATABASE=financial_office

# Redis（不需要密码）
REDIS_URL=redis://redis:6379/0

# Qdrant
QDRANT_URL=http://qdrant:6333

# 后端
API_IMAGE_TAG=v1
RUN_MIGRATIONS_ON_START=true
WAIT_FOR_DB=true
DB_WAIT_TIMEOUT=120
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=2
TZ=Asia/Shanghai

# JWT 密钥（强随机 32 位 hex）
JWT_SECRET=0fa39f2c8b5be024d91fd857b256177cb7450a6cfa77497076a7ae232ebd10e3

# 钉钉/企微/邮件 webhook（演示用可留空）
DINGTALK_WEBHOOK=
WECOM_WEBHOOK=
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=

# 第三方 AI 接口（演示用可留空，走本地 mock）
DEEPSEEK_API_KEY=
EMBEDDING_API_KEY=

# 其它
APP_ENV=production
LOG_LEVEL=INFO
EOF
```

创建 `docker-compose.prod.yml`（**复制下面整段粘贴**，无需修改）：

```bash
cat > docker-compose.prod.yml <<'EOF'
# 主办方部署版 docker-compose
# 用法：docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

name: finoffice-prod

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "20m"
    max-file: "5"

services:
  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-financial_office}
      MYSQL_USER: ${MYSQL_USER:?MYSQL_USER is required}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}
      TZ: Asia/Shanghai
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --default-time-zone=+08:00
      - --max_connections=500
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    ports:
      - "3306:3306"
    networks: [finoffice_net]
    logging: *default-logging

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [finoffice_net]
    logging: *default-logging

  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      QDRANT__SERVICE__GRPC_PORT: 6334
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://127.0.0.1:6333/healthz || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 5
    networks: [finoffice_net]
    logging: *default-logging

  backend:
    image: cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-backend:${API_IMAGE_TAG:-v1}
    restart: unless-stopped
    depends_on:
      mysql:    { condition: service_healthy }
      redis:    { condition: service_healthy }
      qdrant:   { condition: service_healthy }
    env_file: [.env.prod]
    environment:
      DATABASE_HOST: mysql
      DATABASE_PORT: "3306"
      DATABASE_USER: ${MYSQL_USER}
      DATABASE_PASSWORD: ${MYSQL_PASSWORD}
      DATABASE_NAME: ${MYSQL_DATABASE:-financial_office}
      REDIS_URL: redis://redis:6379/0
      QDRANT_URL: http://qdrant:6333
      RUN_MIGRATIONS_ON_START: "true"
      WAIT_FOR_DB: "true"
      DB_WAIT_TIMEOUT: "120"
      API_HOST: 0.0.0.0
      API_PORT: "8000"
      API_WORKERS: "2"
      PYTHONUNBUFFERED: "1"
      TZ: Asia/Shanghai
    volumes:
      - backend_storage:/srv/app/storage
      - backend_uploads:/srv/app/storage/uploads
      - backend_logs:/srv/app/logs
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request, sys; sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/system/health/live', timeout=3).status == 200 else -1\""]
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 60s
    networks: [finoffice_net]
    logging: *default-logging

  frontend:
    image: cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-frontend:${API_IMAGE_TAG:-v1}
    restart: unless-stopped
    depends_on:
      backend: { condition: service_healthy }
    networks: [finoffice_net]
    logging: *default-logging

  nginx-edge:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      frontend: { condition: service_started }
      backend:  { condition: service_healthy }
    volumes:
      - ./nginx-edge.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:80"
    networks: [finoffice_net]
    logging: *default-logging

networks:
  finoffice_net:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
  qdrant_data:
  backend_storage:
  backend_uploads:
  backend_logs:
EOF
```

创建边缘 nginx 配置 `nginx-edge.conf`（**前端 → 后端反代**）：

```bash
cat > nginx-edge.conf <<'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 50m;

    # 前端静态资源
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API 反代
    location /api/ {
        proxy_pass http://backend:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # 健康检查
    location /healthz {
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }
}
EOF
```

### Step E：启动所有服务

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

首次启动会：
1. 拉取 mysql:8.4 / redis:7-alpine / qdrant:latest / nginx:1.27-alpine 4 个公共镜像（已配置加速器，速度快）
2. 拉取 ACR 上的 2 个项目镜像
3. 启动 6 个容器（mysql / redis / qdrant / backend / frontend / nginx-edge）
4. 后端容器启动时自动跑 `alembic upgrade head`（数据库迁移）

观察启动日志（可选）：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
```

`Ctrl+C` 退出日志跟踪（容器仍在后台运行）。

### Step F：验证服务

#### F1. 查看容器状态

```bash
docker compose -f docker-compose.prod.yml ps
```

应该全部 `Up` 或 `Up (healthy)`。等待约 60 秒让后端跑完迁移。

#### F2. 健康检查

```bash
# 边缘 nginx
curl http://localhost/healthz
# 期望返回：ok

# 后端直接（绕过前端）
curl http://localhost:8080/api/v1/system/health/live
# 期望返回：{"status":"ok"}

# MySQL 连通性
docker compose -f docker-compose.prod.yml exec mysql mysqladmin -uroot -p$MYSQL_ROOT_PASSWORD ping
# 期望返回：mysqld is alive

# Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
# 期望返回：PONG

# Qdrant
curl http://localhost:6333/healthz
# 期望返回：{"title":"qdrant - vector search engine","version":"..."}
```

#### F3. 访问前端

浏览器打开：`http://localhost`

应该能看到登录页（演示默认账号在下方「附：演示账号」）。

### Step G：创建超级管理员账号

后端容器跑完迁移后，执行：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
  python scripts/create_user.py --username admin --email admin@example.com \
    --password-env ADMIN_PASSWORD --superuser
```

如果脚本不支持 `--password-env`，改为：

```bash
docker compose -f docker-compose.prod.yml exec -e ADMIN_PASSWORD=ajbPRPTfFShYCUR backend \
  python scripts/create_user.py --username admin --email admin@example.com \
    --password "$ADMIN_PASSWORD" --superuser
```

> 默认初始管理员账号 = `admin` / `ajbPRPTfFShYCUR`（见文档开头凭证速查表）。登录后请立即修改密码！

---

## 第三部分 · 常用维护命令（主办方收藏）

```bash
# 查看所有容器状态
docker compose -f docker-compose.prod.yml ps

# 查看后端日志（最近 100 行）
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# 实时跟踪后端日志
docker compose -f docker-compose.prod.yml logs -f backend

# 重启后端
docker compose -f docker-compose.prod.yml restart backend

# 停止所有服务（保留数据）
docker compose -f docker-compose.prod.yml stop

# 启动所有服务
docker compose -f docker-compose.prod.yml start

# 销毁所有服务（⚠️ 会删除数据卷！需先备份）
docker compose -f docker-compose.prod.yml down -v

# 进入后端容器调试
docker compose -f docker-compose.prod.yml exec backend bash

# 进入 MySQL 客户端
docker compose -f docker-compose.prod.yml exec mysql mysql -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE

# 拉取最新镜像并重启
docker compose -f docker-compose.prod.yml pull backend frontend
docker compose -f docker-compose.prod.yml up -d
```

---

## 第四部分 · 数据备份与恢复（主办方重要）

### 备份

```bash
# 备份 MySQL
docker compose -f docker-compose.prod.yml exec mysql \
  sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" $MYSQL_DATABASE' \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份文件上传目录（用户头像、文档等）
docker compose -f docker-compose.prod.yml exec backend \
  tar czf - /srv/app/storage/uploads \
  > uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz
```

### 恢复

```bash
# 恢复 MySQL
cat backup_20261002_153000.sql | docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" $MYSQL_DATABASE

# 恢复上传目录
cat uploads_backup_20261002_153000.tar.gz | docker compose -f docker-compose.prod.yml exec -T backend \
  tar xzf - -C /
```

---

## 附：演示账号（启动后默认数据）

迁移完成后，数据库会自动播种演示数据。常用账号：

| 用户名 | 密码 | 角色 |
|---|---|---|
| `admin` | `ajbPRPTfFShYCUR`（见凭证速查表） | 超级管理员 |
| `demo_manager` | `Demo@123` | 部门经理 |
| `demo_staff` | `Demo@123` | 普通员工 |

> **演示前请务必修改默认密码。** `admin` 用凭证速查表里的强密码；`demo_*` 用弱密码仅适合纯演示环境。

---

## 第五部分 · 故障排查速查表

| 现象 | 可能原因 | 排查方法 |
|---|---|---|
| `docker pull` 拉不下来 | 网络不通 / 镜像加速器未配 | `docker info` 检查 Registry Mirrors |
| 后端起不来，健康检查失败 | MySQL 迁移未完成 / 配置错 | `logs backend`，检查 `DATABASE_*` / `JWT_SECRET` |
| 前端能打开但 API 404 | nginx-edge 配置错 / backend 未起 | `curl http://localhost/api/v1/system/health/live` |
| `docker compose up` 报端口占用 | 80/3306/6379/6333 被占用 | `netstat -ano \| findstr :80` (Windows) |
| push 镜像报 `denied` | AccessKey 没 ACR 写权限 | 控制台 → RAM → 给 AccessKey 授权 `AliyunContainerRegistryFullAccess` |
| pull 镜像报 `unauthorized` | 命名空间 / 仓库名错 | 核对 `cr.cn-hangzhou.aliyuncs.com/financial-project/xxx:v1` |

---

## 第六部分 · 文档备注

1. **本项目镜像托管于阿里云 ACR 个人版容器镜像仓库**，国内校园网、家庭宽带均可正常访问，无需特殊网络。
2. ACR 个人版仅用于项目演示、开发测试场景。
3. **私有镜像仓库需要登录凭证才能拉取镜像**，交付完成后**及时删除该 AccessKey**，保证项目镜像安全。
4. 主办方机器建议配置国内镜像加速器（同开发端 Step 2），避免拉 `mysql:8.4` 等公共镜像超时。
5. **强烈建议**主办方机器至少 4C8G 配置（MySQL + Qdrant 占用较高内存）。
6. 演示完毕后销毁 ACR 命名空间前，先确认所有数据已导出备份。

---

## 附：Docker 国内镜像加速器配置（主办方 Docker Desktop）

打开 Docker Desktop 设置 → Docker Engine，粘贴下面配置，点击 Apply & restart：

```json
{
  "registry-mirrors": [
    "https://docker.nju.edu.cn",
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run"
  ]
}
```

---

## 版本更新流程（演示中改了代码想升级）

```powershell
# 1. 在本地重新构建（v1 → v2）
cd D:\Apexis\financial-office-platform
docker build -t finoffice-backend:v2 -f Dockerfile .
cd frontend\digital-horse
docker build -t finoffice-frontend:v2 -f Dockerfile .

# 2. 打 ACR 标签
docker tag finoffice-backend:v2 cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-backend:v2
docker tag finoffice-frontend:v2 cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-frontend:v2

# 3. 推送
docker push cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-backend:v2
docker push cr.cn-hangzhou.aliyuncs.com/financial-project/finoffice-frontend:v2

# 4. 主办方机器更新（cd 到 finoffice 目录）
# 编辑 .env.prod 把 API_IMAGE_TAG=v2
sed -i 's/API_IMAGE_TAG=v1/API_IMAGE_TAG=v2/' .env.prod   # Linux/Mac
# Windows PowerShell:
(Invoke-Content .env.prod) -replace 'v1','v2' | Set-Content .env.prod

# 5. 拉新镜像 + 重启
docker compose -f docker-compose.prod.yml --env-file .env.prod pull backend frontend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```