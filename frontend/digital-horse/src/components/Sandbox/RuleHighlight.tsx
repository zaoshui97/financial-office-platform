/**
 * RuleHighlight —— 命中文本高亮渲染
 *
 * 将原始文本中命中规则的片段标红/标黄/标蓝
 * 用于：右侧结果显示区
 */

import React from 'react';
import { Typography, Tooltip, Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { CATEGORY_META } from '@/services/sandbox/complianceRules';
import type { HitSpan } from '@/services/sandbox/sandboxEngine';

const { Text } = Typography;

interface RuleHighlightProps {
  text: string;
  hitSpans: HitSpan[];
}

export const RuleHighlight: React.FC<RuleHighlightProps> = ({ text, hitSpans }) => {
  if (!hitSpans || hitSpans.length === 0) {
    return (
      <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{text}</Text>
    );
  }

  // 按起始位置排序
  const sorted = [...hitSpans].sort((a, b) => a.start - b.start);

  // 去重合并重叠片段
  const merged: Array<{ start: number; end: number; span: HitSpan }> = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      // 重叠：取更严重的
      last.end = Math.max(last.end, span.end);
    } else {
      merged.push({ start: span.start, end: span.end, span });
    }
  }

  const getHighlightStyle = (severity: HitSpan['severity']) => {
    switch (severity) {
      case 'block':
        return {
          background: 'rgba(220, 38, 38, 0.2)',
          borderBottom: '2px solid #DC2626',
          color: '#991B1B',
          padding: '1px 2px',
          borderRadius: 3,
          cursor: 'pointer',
        };
      case 'high':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '2px solid #EF4444',
          color: '#B91C1C',
          padding: '1px 2px',
          borderRadius: 3,
          cursor: 'pointer',
        };
      case 'medium':
        return {
          background: 'rgba(245, 158, 11, 0.15)',
          borderBottom: '2px solid #F59E0B',
          color: '#92400E',
          padding: '1px 2px',
          borderRadius: 3,
          cursor: 'pointer',
        };
      case 'low':
        return {
          background: 'rgba(59, 130, 246, 0.1)',
          borderBottom: '2px solid #3B82F6',
          color: '#1E40AF',
          padding: '1px 2px',
          borderRadius: 3,
          cursor: 'pointer',
        };
    }
  };

  const getTooltip = (span: HitSpan) => {
    const meta = CATEGORY_META[span.category];
    return (
      <div style={{ maxWidth: 280 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {meta.name}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
          {meta.description}
        </div>
        <Tag color={span.severity === 'block' ? 'error' : span.severity === 'high' ? 'error' : span.severity === 'medium' ? 'warning' : 'processing'}>
          {span.text}
        </Tag>
      </div>
    );
  };

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const item of merged) {
    // 普通文本
    if (cursor < item.start) {
      parts.push(
        <span key={`text-${cursor}`}>
          {text.slice(cursor, item.start)}
        </span>
      );
    }
    // 高亮文本
    parts.push(
      <Tooltip key={`hl-${item.start}`} title={getTooltip(item.span)} placement="top">
        <span style={getHighlightStyle(item.span.severity)}>
          {text.slice(item.start, item.end)}
        </span>
      </Tooltip>
    );
    cursor = item.end;
  }

  // 尾部普通文本
  if (cursor < text.length) {
    parts.push(<span key={`text-end`}>{text.slice(cursor)}</span>);
  }

  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        background: '#FAFAFA',
        padding: 12,
        borderRadius: 6,
        border: '1px solid var(--color-border)',
      }}
    >
      {parts}
    </div>
  );
};

export default RuleHighlight;
