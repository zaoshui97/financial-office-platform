/**
 * ScoreRing —— 合规评分圆环
 *
 * 5 分制，渐变色：
 *   5 分：全绿 → 通过
 *   3-4.9：绿→黄 → 警告
 *   1-2.9：橙→红 → 高风险
 *   0-0.9：全红 → 阻断
 *
 * 展示：评分数字 + 5 星评分 + 渐变进度条
 */

import React from 'react';
import { Typography } from 'antd';
import './ScoreRing.css';

const { Text } = Typography;

interface ScoreRingProps {
  score: number; // 0-5
  size?: number;
  showStars?: boolean;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 120,
  showStars = true,
}) => {
  // 圆环颜色配置
  const getColor = (s: number): string => {
    if (s >= 4.5) return '#22A775';
    if (s >= 3.5) return '#10B981';
    if (s >= 3.0) return '#F59E0B';
    if (s >= 2.0) return '#EF4444';
    return '#DC2626';
  };

  const color = getColor(score);
  const pct = (score / 5) * 100;

  // 评分标签
  const getLabel = (s: number): string => {
    if (s >= 4.5) return '优秀';
    if (s >= 3.5) return '良好';
    if (s >= 3.0) return '一般';
    if (s >= 2.0) return '较差';
    return '不合格';
  };

  const label = getLabel(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div
      className="score-ring"
      style={{ width: size, height: size, position: 'relative' }}
    >
      {/* SVG 圆环 */}
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* 底环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="10"
        />
        {/* 进度环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>

      {/* 中心文字 */}
      <div
        className="score-ring__center"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Text
          className="score-ring__score"
          style={{
            fontSize: size * 0.28,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {score.toFixed(1)}
        </Text>
        <Text
          className="score-ring__divisor"
          style={{
            fontSize: size * 0.12,
            color: '#6B7280',
            lineHeight: 1,
          }}
        >
          /5
        </Text>
        {showStars && size >= 140 && (
          <div
            style={{
              display: 'flex',
              gap: 2,
              marginTop: 2,
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                style={{
                  fontSize: size * 0.1,
                  color: star <= Math.round(score) ? color : '#D1D5DB',
                  lineHeight: 1,
                }}
              >
                *
              </span>
            ))}
          </div>
        )}
        <Text
          className="score-ring__label"
          style={{
            fontSize: size * 0.12,
            color: '#6B7280',
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          {label}
        </Text>
      </div>
    </div>
  );
};

export default ScoreRing;
