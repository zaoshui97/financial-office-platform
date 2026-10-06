/**
 * Logo · 睿枢 Apexis
 *
 * 平台品牌图片 logo —— 使用 src/public/logo2.0.png。
 *
 * - 自适应 size：传入 size 等同于图片在 UI 中占据的尺寸（height = size，width 按比例自适应）
 * - 矢量干净：原图为 1024×1024 高分辨率 PNG，缩到 16~96px 仍清晰
 * - 白底圆角容器：原图是非透明 PNG（暗色背景上易糊），自动套白底圆角背板，保证在任何背景下都可辨
 */

import React from 'react';

export interface LogoProps {
  size?: number;
  className?: string;
  /** 是否显示白色圆角背板（默认开 —— 深色背景下强烈建议开启） */
  withBg?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 24, className, withBg = true }) => {
  const innerSize = withBg ? Math.round(size * 0.78) : size;

  if (!withBg) {
    return (
      <img
        src="/logo2.0.png"
        alt="Apexis"
        width={size}
        height={size}
        className={className}
        style={{
          display: 'block',
          width: size,
          height: size,
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    );
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: '#fff',
        borderRadius: Math.max(6, Math.round(size * 0.18)),
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <img
        src="/logo2.0.png"
        alt="Apexis"
        width={innerSize}
        height={innerSize}
        style={{
          display: 'block',
          width: innerSize,
          height: innerSize,
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </span>
  );
};

export default Logo;
