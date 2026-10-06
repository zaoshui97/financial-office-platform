/**
 * AgentCard — 单个 Agent 状态卡片
 *
 * 展示：
 *   - Agent 头像 / 角色名 / 当前状态（idle/thinking/streaming/done/failed）
 *   - 进度条
 *   - 最近一次输出（打字机流式）
 *   - 操作日志（thinking steps）
 */

import React, { useEffect, useState } from 'react';
import { Card, Tag, Progress, Space, Typography, Tooltip, Badge } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { AGENT_META, AgentRole } from '@/services/multiAgentBus';
import { AgentRunState } from '@/services/multiAgentOrchestrator';

const { Text, Paragraph } = Typography;

interface AgentCardProps {
  role: AgentRole;
  state: AgentRunState;
  isZh: boolean;
  compact?: boolean;
}

export const AgentCard: React.FC<AgentCardProps> = ({ role, state, isZh, compact }) => {
  const meta = AGENT_META[role];

  const statusConfig: Record<
    AgentRunState['status'],
    { color: string; text: string; icon: React.ReactNode }
  > = {
    idle: {
      color: 'default',
      text: '待机',
      icon: <PauseCircleOutlined />,
    },
    thinking: {
      color: 'processing',
      text: '思考中',
      icon: <LoadingOutlined spin />,
    },
    streaming: {
      color: 'processing',
      text: '输出中',
      icon: <ThunderboltOutlined />,
    },
    done: {
      color: 'success',
      text: '完成',
      icon: <CheckCircleOutlined />,
    },
    failed: {
      color: 'error',
      text: '失败',
      icon: <CloseCircleOutlined />,
    },
  };

  const cur = statusConfig[state.status];

  // 持续刷新"耗时"显示：用独立 timer 每秒更新一次，避免父组件高频 stream 渲染时 Date.now() 走进 render body
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (state.status === 'done' || state.status === 'idle' || state.status === 'failed') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  const duration =
    state.startedAt && state.finishedAt
      ? `${((state.finishedAt - state.startedAt) / 1000).toFixed(1)}s`
      : state.startedAt && state.status !== 'done'
      ? `${((now - state.startedAt) / 1000).toFixed(0)}s`
      : '—';

  return (
    <Card
      size="small"
      hoverable
      styles={{
        body: { padding: compact ? 10 : 14 },
      }}
      style={{
        borderColor: state.status === 'streaming' || state.status === 'thinking' ? meta.color : undefined,
        boxShadow:
          state.status === 'streaming' || state.status === 'thinking'
            ? `0 0 0 2px ${meta.color}22`
            : undefined,
        transition: 'all 0.3s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: 10,
            background: `${meta.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: compact ? 18 : 22,
            flexShrink: 0,
            boxShadow: `0 4px 12px ${meta.color}44`,
            ['--agent-color' as string]: meta.color,
            ...(state.status === 'streaming' || state.status === 'thinking'
              ? { animation: 'agent-pulse 2s ease-in-out infinite' }
              : {}),
          }}
          className={
            state.status === 'streaming' || state.status === 'thinking'
              ? 'agent-icon-active'
              : undefined
          }
        >
          {meta.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={4} wrap>
            <Text strong style={{ fontSize: compact ? 13 : 14 }}>
              {meta.name}
            </Text>
            <Tag color={cur.color} icon={cur.icon} style={{ margin: 0 }}>
              {cur.text}
            </Tag>
          </Space>

          {!compact && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              {meta.desc}
            </Text>
          )}
        </div>

        <Tooltip title={'耗时'}>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {duration}
          </Text>
        </Tooltip>
      </div>

      {(state.status === 'streaming' || state.status === 'thinking' || state.progress > 0) && (
        <Progress
          percent={state.progress}
          size="small"
          showInfo={false}
          strokeColor={meta.color}
          style={{ marginTop: 8, marginBottom: 0 }}
        />
      )}

      {state.lastOutput && (
        <div
          style={{
            marginTop: 8,
            padding: '6px 10px',
            background: `${meta.color}0d`,
            borderLeft: `3px solid ${meta.color}`,
            borderRadius: 4,
            fontSize: 12,
            color: 'var(--color-text)',
            maxHeight: compact ? 48 : 72,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {state.lastOutput}
          {(state.status === 'streaming' || state.status === 'thinking') && (
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 12,
                background: meta.color,
                marginLeft: 2,
                animation: 'blink 0.8s infinite',
                verticalAlign: 'middle',
              }}
            />
          )}
        </div>
      )}
    </Card>
  );
};
