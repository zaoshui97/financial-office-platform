# 合规沙箱真判别 — 演示启动指南

## 1. 启动后端

```powershell
cd D:\Apexis\financial-office-platform
# 1) 跑 SQL 种子（首次部署时执行）
mysql -uroot -p financial_office < migrations\2026_10_08_seed_policy_rules.sql

# 2) 启动 FastAPI
python -m uvicorn app.main:app --port 8030 --reload
```

后端会注册新接口：
- `POST /api/v1/compliance/sandbox/check` — 4 层防御 + 9 大类规则 + 审计
- `POST /api/v1/ai/chat` — 代理 DeepSeek/豆包/Qwen（Key 在后端 .env）

## 2. 启动前端（关键环境变量）

```powershell
cd D:\Apexis\financial-office-platform\frontend\digital-horse
VITE_USE_BACKEND_SANDBOX=true npm run dev
```

访问 `http://localhost:5173/sandbox`，进入"启动合规沙箱"。

## 3. 5 个演示用例

| # | 测试场景 | 期望结果 |
|---|---------|---------|
| 1 | "我行理财保本保收益，年化 12%，稳赚不赔" | blocked=true，命中 IP-001 / IP-004，法规 REG-AR-2018-19 |
| 2 | "客户 13800138000 身份证 320582199001011234" | blocked=true，命中 DP-001/002，手机号身份证自动 `***` 脱敏 |
| 3 | "拆分存款规避申报，地下钱庄换汇，跑分代收代付" | blocked=true，命中 AML-001/002/003 |
| 4 | "客户经理代客理财，飞单体外循环" | blocked=true，命中 CI-001/002 |
| 5 | "本产品非保本浮动收益，过往业绩不预示未来" | passed=true，score=5.0，可提交人工复审 |

演示时复制每段到 SandboxRunner 文本框 → 点"启动合规沙箱"。

## 4. CLI 连通性测试

```powershell
cd D:\Apexis\financial-office-platform
python tools\test_sandbox_check.py
```

会登录拿 token，对 5 个用例各打一次 `/compliance/sandbox/check`，打印 score / passed / blocked / issues / PII 脱敏字段。

## 5. Kill Switch 演示

在"管理后台 → 合规沙箱"页（如果有）或通过 API：

```powershell
# 开启熔断
curl -X POST http://127.0.0.1:8030/api/v1/compliance/sandbox/kill-switch `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"enabled": true, "operator": "admin", "reason": "演示"}'

# 此时再跑用例，会立即返回 blocked=true，提示"沙箱已熔断"
# 关闭熔断
curl -X POST http://127.0.0.1:8030/api/v1/compliance/sandbox/kill-switch/resume `
  -H "Authorization: Bearer <token>"
```

## 6. 审计日志查询

```powershell
curl -X GET "http://127.0.0.1:8030/api/v1/compliance/sandbox/audit?page=1&page_size=10" `
  -H "Authorization: Bearer <token>"
```

返回近 10 条沙箱审查记录，每条带 `audit_id / blocked / pii_detected / risk_category / latency_ms / 7 段链路指纹`。

## 7. 失败 fallback

`VITE_USE_BACKEND_SANDBOX` 不设或设为 `false` → 前端走本地 mock（`runSandboxCheck`），保证演示不依赖后端。
后端调用失败（如 500 / 网络断开）→ 前端自动 fallback 到本地 mock，**演示不会中断**。

## 8. 关键演示话术

> "我们合规沙箱走的是 **4 层防御**：L1 Kill Switch 紧急熔断 → L2 风险词硬匹配 → L3 PII 脱敏（手机号身份证自动 `***`）→ L4 LLM Judge 语义判断。本次演示我们用 L2 内置规则库，覆盖 9 大类 47 条规则、关联 30+ 真实法规（包括资管新规、网络安全法、个保法、反洗钱法等）。所有审查记录都进 `compliance_audit_logs` 表，带 SHA-256 摘要 + SM3 链式哈希防篡改。"
