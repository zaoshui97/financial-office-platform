/**
 * Blackboard — 多 Agent 共享黑板可视化
 *
 * 展示 4 类产出：事实 / 决策 / 待办 / 风险
 * 每个 Agent 把自己的结果写到 Blackboard，其他 Agent 可以读到（已通过 store 单例共享）
 */

import React from 'react';
import { Empty, Tag, Space, Typography, Card, List, Divider, Progress } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FlagOutlined,
  AimOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useBlackboard } from '@/services/useMultiAgent';

const { Text, Paragraph } = Typography;

interface BlackboardProps {
  isZh: boolean;
}

export const Blackboard: React.FC<BlackboardProps> = () => {
  const bb = useBlackboard();
  const isEmpty =
    bb.facts.length === 0 &&
    bb.decisions.length === 0 &&
    bb.actions.length === 0 &&
    bb.risks.length === 0 &&
    bb.topics.length === 0;

  if (isEmpty) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={'黑板暂无内容，4 个 Agent 会话开始后会自动写入'}
        style={{ padding: '24px 0' }}
      />
    );
  }

  const priorityColor: Record<string, string> = {
    high: 'red',
    medium: 'orange',
    low: 'blue',
  };

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Topics */}
      {bb.topics.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Space size={4} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <AimOutlined /> {'议题'}：
            </Text>
            {bb.topics.map((t) => (
              <Tag color="blue" key={t}>
                {t}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      {/* Decisions */}
      {bb.decisions.length > 0 && (
        <Card
          size="small"
          title={
            <Space size={6}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text strong style={{ fontSize: 13 }}>
                {'决策'} ({bb.decisions.length})
              </Text>
            </Space>
          }
          style={{ marginBottom: 10 }}
        >
          <List
            size="small"
            dataSource={bb.decisions}
            renderItem={(d, i) => (
              <List.Item style={{ padding: '6px 0' }}>
                <Space align="start" style={{ width: '100%' }}>
                  <Tag color="green">{i + 1}</Tag>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 12 }}>
                      {d.topic}
                    </Text>
                    <Paragraph type="secondary" style={{ fontSize: 11, margin: '2px 0 0' }}>
                      {d.decision}
                    </Paragraph>
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        @{d.owner}
                      </Text>
                      <Progress
                        percent={d.confidence * 100}
                        size="small"
                        showInfo={false}
                        style={{ width: 60 }}
                        strokeColor="#52c41a"
                      />
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {Math.round(d.confidence * 100)}%
                      </Text>
                    </Space>
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Actions */}
      {bb.actions.length > 0 && (
        <Card
          size="small"
          title={
            <Space size={6}>
              <FlagOutlined style={{ color: '#0F2B5B' }} />
              <Text strong style={{ fontSize: 13 }}>
                {'待办'} ({bb.actions.length})
              </Text>
            </Space>
          }
          style={{ marginBottom: 10 }}
        >
          <List
            size="small"
            dataSource={bb.actions}
            renderItem={(a, i) => (
              <List.Item style={{ padding: '6px 0' }}>
                <Space align="start" style={{ width: '100%' }}>
                  <Tag color={priorityColor[a.priority]} style={{ marginTop: 2 }}>
                    {a.priority}
                  </Tag>
                  <div style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12 }}>{a.description}</Text>
                    <div>
                      <Space size={4}>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          → @{a.assignee}
                        </Text>
                        {a.dueDate && (
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            截止：{a.dueDate}
                          </Text>
                        )}
                      </Space>
                    </div>
                  </div>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Risks */}
      {bb.risks.length > 0 && (
        <Card
          size="small"
          title={
            <Space size={6}>
              <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
              <Text strong style={{ fontSize: 13 }}>
                {'风险信号'} ({bb.risks.length})
              </Text>
            </Space>
          }
          style={{ marginBottom: 10 }}
        >
          {bb.risks.map((r, i) => (
            <div
              key={i}
              style={{
                padding: '6px 10px',
                background: '#fff7e6',
                borderLeft: '3px solid #fa8c16',
                marginBottom: 4,
                fontSize: 12,
              }}
            >
              {r}
            </div>
          ))}
        </Card>
      )}

      {/* Facts (collapse-able, show recent 3) */}
      {bb.facts.length > 0 && (
        <Card
          size="small"
          title={
            <Space size={6}>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              <Text strong style={{ fontSize: 13 }}>
                {'事实记录'} ({bb.facts.length})
              </Text>
            </Space>
          }
        >
          {bb.facts.slice(-3).reverse().map((f) => (
            <div
              key={f.id}
              style={{
                padding: '4px 0',
                fontSize: 12,
                borderBottom: '1px dashed #f0f0f0',
              }}
            >
              <Text type="secondary" style={{ fontSize: 10 }}>
                [{new Date(f.ts).toLocaleTimeString()}] {f.speaker}:
              </Text>
              <Paragraph style={{ fontSize: 12, margin: '2px 0' }} ellipsis={{ rows: 2 }}>
                {f.content}
              </Paragraph>
            </div>
          ))}
          {bb.facts.length > 3 && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              + {bb.facts.length - 3} 条更早记录
            </Text>
          )}
        </Card>
      )}
    </div>
  );
};
