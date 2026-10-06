/**
 * SandboxHistory —— 沙箱运行历史
 *
 * 展示最近 20 次沙箱调用记录
 * 用于：Sandbox 页侧边栏 / 报告页历史区
 */

import React from 'react';
import { Card, Timeline, Typography, Tag, Button, Space, Empty } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSandboxLogs } from '@/components/Sandbox/useSandboxLogs';
import { exportSandboxLogCsv } from '@/services/sandbox/sandboxApiContract';

const { Text } = Typography;

export const SandboxHistory: React.FC = () => {
  const { t } = useTranslation();
  const { logs, refresh } = useSandboxLogs();

  const getStatusIcon = (passed: boolean, blocked: boolean) => {
    if (blocked) return <CloseCircleOutlined style={{ color: '#DC2626' }} />;
    if (passed) return <CheckCircleOutlined style={{ color: '#22A775' }} />;
    return <WarningOutlined style={{ color: '#F59E0B' }} />;
  };

  const getScoreTag = (score: number) => {
    if (score >= 4.5) return <Tag color="success">{score.toFixed(1)}</Tag>;
    if (score >= 3.0) return <Tag color="warning">{score.toFixed(1)}</Tag>;
    return <Tag color="error">{score.toFixed(1)}</Tag>;
  };

  const getSourceLabel = (source: string) => {
    const map: Record<string, string> = {
      approval: '审批助手',
      report: '报告生成',
      qa: '智能问答',
      sandbox_page: '合规沙箱',
      demo: '演示模式',
    };
    return map[source] || source;
  };

  const recent = logs.slice(0, 20);

  return (
    <Card
      size="small"
      title={
        <Space>
          <ClockCircleOutlined style={{ color: '#0F2B5B' }} />
          <span>{'运行历史'}</span>
          <Tag>{recent.length}</Tag>
        </Space>
      }
      extra={
        <Space size={4}>
          <Button size="small" icon={<ReloadOutlined />} onClick={refresh} title={'刷新'} />
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={() => exportSandboxLogCsv()}
            disabled={logs.length === 0}
            title={'导出 CSV'}
          >
            {'导出'}
          </Button>
        </Space>
      }
      styles={{ body: { padding: '8px 12px' } }}
    >
      {recent.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={'暂无运行记录'}
          style={{ padding: '16px 0' }}
        />
      ) : (
        <Timeline
          size="small"
          style={{ fontSize: 12 }}
          items={recent.map((log) => ({
            color:
              log.blocked ? 'red' : log.passed ? 'green' : 'orange',
            dot: getStatusIcon(log.passed, log.blocked),
            children: (
              <div>
                {/* 输入预览 */}
                <Text
                  type="secondary"
                  style={{ fontSize: 11, display: 'block' }}
                  ellipsis={{ tooltip: log.inputPreview }}
                >
                  {log.inputPreview}
                </Text>
                {/* 元信息行 */}
                <Space size={4} wrap style={{ marginTop: 4 }}>
                  {getScoreTag(log.score)}
                  <Tag style={{ fontSize: 11 }}>
                    {log.issueCount > 0
                      ? `${log.issueCount} 项风险`
                      : '合规'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {log.durationMs}ms
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {getSourceLabel(log.source)}
                  </Text>
                </Space>
                {/* 时间 */}
                <Text
                  type="secondary"
                  style={{ fontSize: 10, display: 'block', marginTop: 2 }}
                >
                  {new Date(log.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
};

export default SandboxHistory;
