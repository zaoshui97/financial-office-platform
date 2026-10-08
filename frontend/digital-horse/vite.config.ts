import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const stat = promisify(fs.stat);

/**
 * 4 位战略会议主持人的 MP4 视频源目录。
 * 视频不放入 public/（避免 600MB 拷入 dist），直接从此处按 Range 流式返回。
 * 仅 dev 生效；生产环境请改用静态文件服务/CDN 替代。
 */
const STRATEGY_VIDEO_DIR = 'C:/Users/fjlyh/Desktop/服务外包材料/sc';
const STRATEGY_VIDEO_FILES = new Set(['jm.mp4', 'lbw.mp4', 'lyt.mp4', 'syr.mp4']);

/**
 * 中文 Windows 编码兼容补丁：forceUtf8Headers
 *
 * 问题：Vite dev server 通过 sirv 把 text/javascript 设置为无 charset，
 *       浏览器按系统 ANSI（中文=GBK）解码 → JS 模块里中文注释/字符串变乱码，
 *       i18n 初始化里的中文 console.error 抛错导致整个 i18n 不可用，
 *       t() fallback 到 key 字符串原样输出。
 *
 * 解决：劫持 res.writeHead 和 res.end，在响应头发送之前补上 charset=utf-8。
 *
 * 仅 dev 生效；生产构建产物不带此问题。
 */
function forceUtf8Headers() {
  return {
    name: 'force-utf8-headers',
    apply: 'serve' as const,
    configureServer(server: any) {
      // 拦截每个请求的 res.writeHead / res.end，
      // 在响应头发出前给 JS / JSON / CSS 等文本资源补上 charset=utf-8。
      // 解决中文 Windows 浏览器按 GBK 解码导致 JS 模块里的中文乱码问题。
      server.middlewares.use((_req: any, res: any, next: any) => {
        const origWriteHead = res.writeHead.bind(res);
        const origEnd = res.end.bind(res);
        const fixCharset = () => {
          try {
            const ct = res.getHeader('Content-Type');
            if (typeof ct !== 'string' || /charset=/i.test(ct)) return;
            const lower = ct.toLowerCase();
            if (
              lower.startsWith('text/javascript') ||
              lower.startsWith('application/javascript') ||
              lower.startsWith('application/json') ||
              lower.startsWith('application/xml') ||
              lower.startsWith('text/css') ||
              lower.startsWith('text/html') ||
              lower.startsWith('text/plain')
            ) {
              res.setHeader('Content-Type', `${ct}; charset=utf-8`);
            }
          } catch {
            /* ignore */
          }
        };
        // @ts-ignore
        res.writeHead = function (...args: any[]) { fixCharset(); return origWriteHead(...args); };
        // @ts-ignore
        res.end = function (...args: any[]) { fixCharset(); return origEnd(...args); };
        next();
      });
    },
  };
}

/**
 * /videos/<file>.mp4 直接从桌面目录读取并流式返回（支持 Range 拖动）。
 * 仅 serve 模式；构建产物不带此插件。
 */
function strategyVideos() {
  return {
    name: 'strategy-videos',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/videos', async (req: any, res: any, next: any) => {
        try {
          // req.url = "/jm.mp4" 之类
          const m = req.url.match(/^\/([\w-]+\.mp4)(?:\?.*)?$/);
          if (!m) return next();
          const file = m[1];
          if (!STRATEGY_VIDEO_FILES.has(file)) return next();
          const abs = path.join(STRATEGY_VIDEO_DIR, file);
          const info = await stat(abs);
          if (!info.isFile()) return next();
          const total = info.size;
          const range = req.headers.range;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          if (range) {
            const match = /bytes=(\d*)-(\d*)/.exec(range);
            const start = match?.[1] ? parseInt(match[1], 10) : 0;
            const end = match?.[2] ? parseInt(match[2], 10) : total - 1;
            const chunk = end - start + 1;
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
            res.setHeader('Content-Length', String(chunk));
            res.setHeader('Content-Type', 'video/mp4');
            fs.createReadStream(abs, { start, end }).pipe(res);
          } else {
            res.statusCode = 200;
            res.setHeader('Content-Length', String(total));
            res.setHeader('Content-Type', 'video/mp4');
            fs.createReadStream(abs).pipe(res);
          }
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), forceUtf8Headers(), strategyVideos()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // 监听所有接口，方便通过自定义 hosts（如 apexis.com.cn）本地访问。
    // 这样 Chrome 屏幕共享蓝条显示的 origin 就是 apexis.com.cn 而不是 127.0.0.1:5173，
    // 看起来像"已部署"。vite 5+ 的 allowedHosts 默认拒绝非常规 host，
    // 这里显式放行 apexis.com.cn / localhost / 本机 IP。
    // 强制 IPv4 监听（Windows 上 vite+host:true 默认走 IPv6 ::1，
    // 导致 127.0.0.1 无法访问 → 浏览器打不开）
    host: '0.0.0.0',
    allowedHosts: ['apexis.com.cn', '.apexis.com.cn', 'localhost', '127.0.0.1'],
    proxy: {
      // 前端 baseURL='/api/v1'，请求形如 /api/v1/...
      // dev 默认转发到 8030（本机常用端口）；
      // 8000 是 Docker Desktop 的 com.docker.backend 进程会占用，绝不能代理到那。
      // 如需连 docker 部署的 8000 后端请设 VITE_DEV_BACKEND=http://127.0.0.1:8000 后重启 vite
      '/api': {
        target: process.env.VITE_DEV_BACKEND || 'http://127.0.0.1:8030',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  define: {
    'process.env': {},
  },
});
