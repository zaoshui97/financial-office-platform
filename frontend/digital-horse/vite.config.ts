import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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

export default defineConfig({
  plugins: [react(), forceUtf8Headers()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      // 前端 baseURL='/api/v1'，请求形如 /api/v1/...
      // dev 默认转发到 8010（uvicorn 默认端口）；docker 部署在 8000 请设 VITE_DEV_BACKEND=http://127.0.0.1:8000
      '/api': {
        target: process.env.VITE_DEV_BACKEND || 'http://127.0.0.1:8010',
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
