# 生产部署检查清单（Phase 3）

> 本文档给出从零部署到生产环境的完整步骤，配合 `Dockerfile` + `docker-compose.prod.yml`。

## 1. 镜像构建

### 后端

```bash
docker build -t finoffice-backend:v1.0.0 -f Dockerfile .
# 或通过 CI/CD（推荐 GitHub Actions / GitLab CI）：
docker buildx build --platform linux/amd64,linux/arm64 \
  -t registry.cn-hangzhou.aliyuncs.com/your-ns/finoffice-backend:v1.0.0 \
  --push .
```

### 前端

```bash
cd frontend/digital-horse
docker build -t finoffice-frontend:v1.0.0 -f Dockerfile .
# push 到阿里云 ACR
docker tag finoffice-frontend:v1.0.0 registry.cn-hangzhou.aliyuncs.com/your-ns/finoffice-frontend:v1.0.0
docker push registry.cn-hangzhou.aliyuncs.com/your-ns/finoffice-frontend:v1.0.0
```

## 2. 配置 .env.prod

```bash
cp .env.prod.example .env.prod
openssl rand -hex 32  # 多次，填入 SECRET_KEY / MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD
vim .env.prod
```

关键变量：
- `SECRET_KEY` ≥ 32 字符，强随机（影响 JWT 签名）
- `MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` 用不同值
- `DOUBAO_API_KEY` / `QWEN_API_KEY` / `DEEPSEEK_API_KEY`（至少配 1 家）

## 3. 启动服务

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 等待健康检查通过
docker compose -f docker-compose.prod.yml ps
# 期望：mysql/redis/qdrant/backend 都 healthy
```

## 4. 初始化

```bash
# 跑迁移（start.sh 已自动跑一次）
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 创建超级管理员
docker compose -f docker-compose.prod.yml exec backend \
  python scripts/create_user.py --username admin --email admin@example.com \
  --password 'YourSecurePassword' --superuser
```

## 5. 验证

### REST API

```bash
# 不依赖 DB 的活性检查
curl http://your-domain.com/api/v1/system/health/live
# → {"status": "alive"}

# 依赖 DB 的就绪检查
curl http://your-domain.com/api/v1/system/health/ready
# → {"status": "ready", "database": "ok"}

# 登录
curl -X POST http://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=YourSecurePassword"
# → {"access_token": "...", "token_type": "bearer", "expires_in": 3600}
```

### WebSocket

```bash
# 用 wscat 测试
npx wscat -c "ws://your-domain.com/api/v1/meetings/ws/1" \
  -H "Authorization: Bearer <token>"
# 期望：先收到 snapshot，再实时收到 blackboard_update
```

### AI 链路

```bash
# 三方模型健康检查
curl http://your-domain.com/api/v1/ai/diagnostics \
  -H "Authorization: Bearer <token>"
# → [{"provider": "deepseek", "success": true, "latency_ms": ...}, ...]
```

## 6. 性能基线（基于 2026-10-03 压测）

| 指标 | 数值 | 备注 |
|---|---|---|
| 单链触发链 mean | 234 ms | LLM mock 50ms × 4 + 业务 34ms |
| 10 会议并发吞吐 | 0.19 chains/sec | 真实 LLM 链路，4 agent 串行 |
| 真实 LLM 延迟 (qwen) | 1.6 s | 单次 |
| 真实 LLM 延迟 (doubao) | 2.3 s | 单次 |
| 真实 LLM 延迟 (deepseek) | 3.7 s | 单次（含 reasoning） |

详见 `docs/perf/meeting-chain-baseline.md` 和 `docs/perf/meeting-chain-concurrent.md`。

## 7. 监控

### 日志

```bash
# 实时查看后端
docker compose -f docker-compose.prod.yml logs -f backend

# 单容器最近 100 行
docker logs --tail 100 finoffice-backend
```

### 健康端点接入 LB

| 端点 | 用途 | 是否依赖 DB |
|---|---|---|
| `/api/v1/system/health/live` | liveness probe（k8s） | 否 |
| `/api/v1/system/health/ready` | readiness probe（k8s） | 是 |

K8s deployment 示例：

```yaml
livenessProbe:
  httpGet: { path: /api/v1/system/health/live, port: 8000 }
  initialDelaySeconds: 30
  periodSeconds: 30
readinessProbe:
  httpGet: { path: /api/v1/system/health/ready, port: 8000 }
  initialDelaySeconds: 10
  periodSeconds: 10
```

## 8. 回滚

```bash
# 镜像 tag 回退
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  up -d --no-deps backend \
  --image registry.cn-hangzhou.aliyuncs.com/your-ns/finoffice-backend:v0.9.0
```

## 9. 故障排查

| 现象 | 排查 |
|---|---|
| 后端启动卡 "waiting for MySQL" | `docker logs mysql` 看是否启动成功；`docker exec mysql mysqladmin ping` |
| 401 频繁 | JWT_SECRET_KEY 与上次部署不一致 → 重新签发 |
| LLM 500 | `curl /api/v1/ai/diagnostics` 看 provider 状态；检查 API_KEY 是否过期 |
| WS 断连频繁 | 检查 nginx `proxy_read_timeout` 是否 ≥ 90s（默认 60s 短） |

## 10. 安全 checklist

- [ ] `.env.prod` 已加进 `.gitignore`
- [ ] 所有密钥 ≥ 32 字节强随机
- [ ] MySQL root 密码与业务用户密码分离
- [ ] JWT SECRET 与 REFRESH SECRET 不同
- [ ] HTTPS 已配（certbot 或 LB 终止）
- [ ] CORS 仅放行你的前端域名
- [ ] Docker 镜像版本 tag 锁定（不要用 latest）
- [ ] 定期 `alembic upgrade head`（建议加 CI 检查）
- [ ] 数据库每日自动备份
- [ ] 沙箱 LLM Judge 启用（防止敏感词漏检）