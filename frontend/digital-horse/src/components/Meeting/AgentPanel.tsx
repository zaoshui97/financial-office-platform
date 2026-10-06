/**
 * AgentPanel — 多 Agent 协作面板
 *
 * 布局：
 *   ┌──────────────────────────────┐
 *   │   Moderator  [Running]     │
 *   │   Notetaker   [Done]       │
 *   │  ️ Decision    [Streaming]   │
 *   │   Action      [Idle]       │
 *   ├──────────────────────────────┤
 *   │  Blackboard 共享黑板          │
 *   │  - 决策 / 待办 / 风险         │
 *   ├──────────────────────────────┤
 *   │  [模拟输入]   [一键预演]      │
 *   │  [结束会议 → 一键生成纪要]   │
 *   └──────────────────────────────┘
 */

import React, { useState } from 'react';
import { Card, Button, Input, Space, Typography, Empty, Tabs, message, Tag, Tooltip } from 'antd';
import {
  SendOutlined,
  PlayCircleOutlined,
  StopOutlined,
  BulbOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { AgentCard } from './AgentCard';
import { Blackboard } from './Blackboard';
import {
  useAllAgentRunStates,
  useBlackboard,
} from '@/services/useMultiAgent';
import {
  fanoutChunk,
  runClosingSummary,
  resetMeeting,
} from '@/services/multiAgentOrchestrator';

const { Text, Paragraph } = Typography;

interface AgentPanelProps {
  meetingId: string;
  isZh: boolean;
  onClose?: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ meetingId, isZh, onClose }) => {
  const agents = useAllAgentRunStates();
  const bb = useBlackboard();
  const [speaker, setSpeaker] = useState('张三');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState('agents');

  // 一键喂入
  const handleSend = async () => {
    if (!content.trim()) {
      message.warning('请输入发言内容');
      return;
    }
    const s = speaker;
    const c = content;
    setContent('');
    await fanoutChunk(s, c);
  };

  // 一键结束会议 → 自动生成结构化纪要
  const handleCloseMeeting = async () => {
    message.loading({ content: '正在汇总会议纪要…', key: 'closing' });
    await runClosingSummary();
    message.success({ content: '会议纪要已生成', key: 'closing' });
    if (onClose) onClose();
  };

  // 模拟一段连续讨论
  const handleSimulate = async () => {
    const lines = [
      { speaker: '张三', content: '今天的核心议题是 Q3 预算重新评估。' },
      { speaker: '李四', content: '我担心现金流，需要紧急安排跨部门协调。' },
      { speaker: '王五', content: '决定：Q3 预算方案下周确定，李四负责跟进。' },
      { speaker: '赵六', content: '新合规要求必须月底前完成，请张三分担。' },
      { speaker: '张三', content: '收到，我会尽快完成合规整改。' },
    ];
    for (const l of lines) {
      await fanoutChunk(l.speaker, l.content);
      await new Promise((r) => setTimeout(r, 600));
    }
  };

  // Phase 标签
  const phaseConfig: Record<string, { color: string; text: string }> = {
    scheduled: { color: 'default', text: '待开始' },
    rehearsed: { color: 'cyan', text: '已预演' },
    in_progress: { color: 'processing', text: '进行中' },
    summarizing: { color: 'warning', text: '汇总中' },
    actioning: { color: 'gold', text: '派单中' },
    closed: { color: 'success', text: '已闭环' },
  };
  const curPhase = phaseConfig[bb.phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border)',
          background: '#0F2B5B0D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space size={8}>
          <ThunderboltOutlined style={{ color: '#0F2B5B', fontSize: 16 }} />
          <Text strong style={{ fontSize: 14 }}>
            {'多 Agent 协作中心'}
          </Text>
          <Tag color={curPhase.color}>{curPhase.text}</Tag>
        </Space>
        <Tooltip title={'切换会议时重置状态'}>
          <Button
            size="small"
            type="text"
            icon={<StopOutlined />}
            onClick={() => {
              resetMeeting(meetingId);
              message.info('已重置');
            }}
          />
        </Tooltip>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        items={[
          {
            key: 'agents',
            label: (
              <span>
                <TeamOutlined />
                {'Agent 状态'}
              </span>
            ),
            children: (
              <div style={{ padding: '8px 10px', overflow: 'auto', flex: 1 }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <AgentCard role="moderator" state={agents.moderator} isZh={isZh} compact />
                  <AgentCard role="notetaker" state={agents.notetaker} isZh={isZh} compact />
                  <AgentCard role="decision" state={agents.decision} isZh={isZh} compact />
                  <AgentCard role="action" state={agents.action} isZh={isZh} compact />
                </Space>
              </div>
            ),
          },
          {
            key: 'blackboard',
            label: (
              <span>
                <BulbOutlined />
                {'共享黑板'}
                {bb.actions.length + bb.decisions.length > 0 && (
                  <Tag color="blue" style={{ marginLeft: 6 }}>
                    {bb.actions.length + bb.decisions.length}
                  </Tag>
                )}
              </span>
            ),
            children: (
              <div style={{ padding: '8px 10px', overflow: 'auto', flex: 1 }}>
                <Blackboard isZh={isZh} />
              </div>
            ),
          },
        ]}
      />

      {/* Input */}
      <div
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: 10,
          background: 'var(--color-bg-card)',
        }}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 6 }}>
          <Input
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            placeholder={'发言人'}
            style={{ width: 90 }}
          />
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'输入发言，自动触发 4 Agent 并行分析…'}
            onPressEnter={handleSend}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
            {'发送'}
          </Button>
        </Space.Compact>
        <Space size={6} style={{ width: '100%' }} wrap>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={handleSimulate}
          >
            {'模拟一段讨论'}
          </Button>
          <Button
            size="small"
            type="primary"
            danger
            icon={<FileTextOutlined />}
            onClick={handleCloseMeeting}
            disabled={bb.facts.length === 0}
          >
            {'结束会议 → 生成纪要'}
          </Button>
        </Space>
      </div>
    </div>
  );
};
