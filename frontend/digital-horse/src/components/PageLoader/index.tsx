import React from 'react';

/**
 * 全局路由级加载占位。
 *
 * 为什么必须有这个组件：
 * AppLayout / SimpleLayout 的 <Outlet> 包了一堆 lazy() 页面，
 * 路由切换时如果 chunk 还没回来，Outlet 是空的 -> 整片闪白。
 * 用 Suspense + PageLoader 让用户在 chunk load 期间看到一致的旋转 loader。
 */
const PageLoader: React.FC<{ tip?: string }> = ({ tip = '加载中…' }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 400,
      height: '100%',
      width: '100%',
      color: 'var(--color-text-secondary, #666)',
      fontSize: 14,
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        border: '3px solid var(--color-border, #e8edf4)',
        borderTop: '3px solid var(--color-primary, #0F2B5B)',
        borderRadius: '50%',
        animation: 'page-loader-spin 1s linear infinite',
        marginRight: 12,
      }}
    />
    <span>{tip}</span>
    <style>{`
      @keyframes page-loader-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export default PageLoader;