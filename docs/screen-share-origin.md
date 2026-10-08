# 屏幕共享蓝条 origin 美化（apexis.com.cn → 127.0.0.1）

## 问题

Chrome 在屏幕共享时，会在被共享标签页顶部固定显示一行蓝条：

```
正在与 http://127.0.0.1:5173 共享此标签页       [停止共享]
```

`http://127.0.0.1:5173` 这一段是**当前被共享页面的 origin**，Chrome 从地址栏取的，**前端无法关闭**。

它会暴露两个问题：

1. 一看 `127.0.0.1` + `:5173`（Vite 默认端口），参会人会以为项目还在开发环境
2. 蓝条一直挂在 PPT 顶部很扎眼

## 方案

让被共享的页面从 `apexis.com.cn` 这个域名访问，而不是 `127.0.0.1:5173`：

```
正在与 apexis.com.cn 共享此标签页              [停止共享]
```

实现：hosts 把 `apexis.com.cn` 解析到 `127.0.0.1`。

## 一次性配置（Windows）

```powershell
# 在项目根目录下，右键 → 用 PowerShell 运行（管理员）
powershell -ExecutionPolicy Bypass -File .\tools\setup-host.ps1
```

或者手动编辑 `C:\Windows\System32\drivers\etc\hosts`，加一行：

```
127.0.0.1   apexis.com.cn   # apexis-meeting-screen-share
```

> 需要**管理员权限**保存。

## Vite 已就绪

`vite.config.ts` 已经配置：

```ts
server: {
  port: 5173,
  host: true,                   // 监听所有接口
  allowedHosts: ['apexis.com.cn', '.apexis.com.cn', 'localhost', '127.0.0.1'],
  proxy: { ... }
}
```

重启 Vite 后即可生效。

## 开会流程

1. 打开浏览器访问：**`http://apexis.com.cn:5173`**（不是 127.0.0.1）
2. 进入"会议" → 点"屏幕共享" → 选标签页 / 窗口 / 屏幕
3. 被共享的标签页顶部蓝条会显示：

   ```
   正在与 apexis.com.cn 共享此标签页
   ```

   而不再是 `http://127.0.0.1:5173`。

## 进阶：去掉 `:5173` 端口号

Windows hosts 不会管端口，蓝条上始终会带 `:5173`。要让蓝条显示**纯域名**（如 `apexis.com.cn`），需要：

### 选项 A：Vite 直接监听 80 端口（管理员启动）

```ts
// vite.config.ts
server: { port: 80, host: true, ... }
```

启动 Vite 时用**管理员权限**启动 PowerShell（80 是特权端口）。

### 选项 B：nginx 反代

```nginx
server {
    listen 80;
    server_name apexis.com.cn;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

然后 Vite 用默认 5173 不变，nginx 监听 80 端口，浏览器访问 `http://apexis.com.cn`，蓝条显示 `apexis.com.cn`（无端口号）。

### 选项 C：Cloudflare Tunnel / ngrok（公网 HTTPS）

```powershell
# Cloudflare Tunnel（推荐，免费）
cloudflared tunnel --url http://127.0.0.1:5173
# 拿到 https://xxxx.trycloudflare.com 后用这个开会
# 蓝条显示 https://xxxx.trycloudflare.com（甚至带绿色 https 锁）
```

适合**外网参会人**场景，缺点是延迟略高、首次启动慢。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\setup-host.ps1
# → 输入 y 确认移除
```

或者手动编辑 hosts 删掉 `apexis.com.cn` 那一行。