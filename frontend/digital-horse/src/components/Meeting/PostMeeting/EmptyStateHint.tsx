/**
 * EmptyStateHint — 通用空状态提示组件
 *
 * 用于：报告页/派单面板等场景的友好提示
 * 中英双语，支持图标 + 标题 + 描述
 */

import React from 'react';
import { Empty, Typography, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export interface EmptyStateHintProps {
  /** 图标，可自定义，默认 InboxOutlined */
  icon?: React.ReactNode;
  /** 标题 */
  title?: string;
  /** 描述文字 */
  description?: string;
  /** 额外操作区 */
  extra?: React.ReactNode;
  /** 空状态类型预设 */
  type?: 'no-data' | 'no-actions' | 'no-decisions' | 'no-report' | 'loading';
}

export const EmptyStateHint: React.FC<EmptyStateHintProps> = ({
  icon,
  title,
  description,
  extra,
  type,
}) => {
  const { t } = useTranslation();

  // 预设文案
  const presets: Record<
    NonNullable<EmptyStateHintProps['type']>,
    { title: string; desc: string }
  > = {
    'no-data': {
      title: '暂无数据',
      desc: '这里还没有内容',
    },
    'no-actions': {
      title: '暂无待办事项',
      desc: '会议中没有识别到待办任务',
    },
    'no-decisions': {
      title: '未识别到决策',
      desc: '会议中没有识别到明确的决策',
    },
    'no-report': {
      title: '暂无报告',
      desc: '会议报告尚未生成',
    },
    loading: {
      title: '正在生成…',
      desc: 'AI 正在整理会议内容',
    },
  };

  const preset = type ? presets[type] : null;

  return (
    <div
      style={{
        padding: '32px 16px',
        textAlign: 'center',
        background: 'var(--color-bg-hover, #f8f9fc)',
        borderRadius: 8,
        border: '1px dashed var(--color-border, #e8edf4)',
      }}
    >
      <div style={{ marginBottom: 12, color: 'var(--color-text-hint, #8a94a6)' }}>
        {icon || <InboxOutlined style={{ fontSize: 36 }} />}
      </div>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>
        {title || preset?.title}
      </Text>
      <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
        {description || preset?.desc}
      </Text>
      {extra && (
        <div style={{ marginTop: 12 }}>{extra}</div>
      )}
    </div>
  );
};

export default EmptyStateHint;
