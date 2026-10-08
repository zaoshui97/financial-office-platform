# 🎮 多人联机会议测试 — 队友访问手册

> 主持端：你本机 (`192.168.144.1`)
> 队友：局域网内任意电脑（同一 wifi/网段）

---

## 一、访问地址

| 入口 | URL |
|------|-----|
| **前端（主入口）** | `http://192.168.144.1:5173` |
| 后端 API（不需要直接打开） | `http://192.168.144.1:8030/api/v1/...` |

> 前端会通过 Vite proxy 把 `/api/*` 转发到 8030，**队友只关心 5173**。

---

## 二、账号清单（已就绪，密码都已设置好）

| 用户名 | 密码 | 角色 | 用途 |
|--------|------|------|------|
| `zhangsan` | `123456` | 主持人 | 你自己用 |
| `lisi` | `123456` | 参会人 | 备用 |
| `wangwu` | `123456` | 参会人 | 备用 |
| `zhaoliu` | `123456` | 参会人 | 备用 |
| **`teammate1`** | `team12345` | 参会人 | **新队友** |
| **`teammate2`** | `team12345` | 参会人 | **新队友** |

> teammate1 / teammate2 已经通过邀请码加入了会议 id=70「测试会议」，登录后直接看得到。

---

## 三、队友操作步骤

1. 打开浏览器（推荐 Chrome / Edge）
2. 访问 `http://192.168.144.1:5173`
3. 用 `teammate1` / `team12345` 登录
4. 左侧菜单点「会议」→「会议中心」
5. 应该能看到「测试会议」(id=70) 卡片
6. 点击进入即可

> 如果看不到卡片：右上角点「用邀请码加入」→ 输入 **`C6SV6Q`** → 加入

---

## 四、你（主持端）准备新会议 / 给新邀请码

1. 登录 `zhangsan` / `123456`
2. 进入「会议中心」→「新建会议」→ 创建
3. 点进会议 → 蓝色 banner 右侧「**生成邀请码**」→ 复制
4. 把邀请码发给队友

---

## 五、当前所有有效邀请码

| 会议 ID | 标题 | 邀请码 | 过期 |
|---------|------|--------|------|
| 70 | 测试会议 | `C6SV6Q` | 2026-10-14 |
| 69 | 自动化测试会议 | `FSMBSY` | 2026-10-14 |
| 68 | 自动化测试会议 | `CR23UM` | 2026-10-14 |
| 67 | 自动化测试会议 | `CHC78J` | 2026-10-14 |

---

## 六、网络要求（重要）

✅ **能联机的条件**：
- 队友和你在同一局域网（同 wifi / 同有线网段 / 同 VPN）
- 队友能 `ping 192.168.144.1` 通

❌ **不能联机的情况**：
- 不在同一局域网（不同 wifi / 不同公司网）
- 队友在公司网但你在家用宽带
- 队友走 4G/5G

> 如果不在同局域网，需要做内网穿透（frp / ngrok / cloudflared）或者部署到公网服务器。

---

## 七、端口/进程自检命令

```powershell
# 看端口监听状态
powershell -File C:\Users\fjlyh\AppData\Local\Temp\list_ports.ps1

# 看 8030 从外部 IP 是否可达
powershell -File C:\Users\fjlyh\AppData\Local\Temp\test_ext.ps1

# 杀掉 8030 后端（要重启时用）
powershell -File C:\Users\fjlyh\AppData\Local\Temp\kill_port.ps1 -Port 8030

# 重启 8030 后端（绑 0.0.0.0）
cd D:\Apexis\financial-office-platform
Start-Process -FilePath 'C:\Users\fjlyh\miniconda3\python.exe' -ArgumentList '-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8030','--log-level','info' -WorkingDirectory 'D:\Apexis\financial-office-platform' -WindowStyle Hidden
```

---

## 八、已做的关键改动（备忘）

1. **后端** `app/features/meeting/service.py::list_meetings`
   - 改：原本只列「我主持的会议」
   - 现在：也列「我作为参会人加入的会议」
   - 影响：队友通过邀请码加入会议后，列表页能看见

2. **前端** `MeetingHub.tsx` 顶栏 + `Meeting/index.tsx` 列表页
   - 加了「🔑 用邀请码加入」按钮 + 弹窗
   - 任意角色都能用

3. **后端** 改绑 `0.0.0.0:8030`（原来是 `127.0.0.1:8030`）
4. **MySQL 3306** 已在 `::` 监听（外网可连）
5. **Vite 5173** 已在 `::` 监听（外网可连）
