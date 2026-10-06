import React, { useState } from 'react';
import { Card, Row, Col, Typography, Tag, Space, Button, Table, Badge, Progress, Tooltip, Modal, Steps, Popconfirm, message } from 'antd';
import {
  RobotOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

interface AgentTask {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  duration?: string;
  agents: string[];
}

interface AgentInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'online' | 'busy' | 'offline';
  taskCount: number;
  description: string;
}

const AgentCenter: React.FC = () => {
  const { t } = useTranslation();

  const agents: AgentInfo[] = [
    { id: '1', name: t('agent.agentMeeting') || '会议助手', icon: <RobotOutlined />, status: 'online', taskCount: 5, description: t('agent.agentMeetingDesc') || '全流程自动化处理会议：预定、排纪要、同步待办。' },
    { id: '2', name: t('agent.agentDoc') || '文档解析', icon: <RobotOutlined />, status: 'busy', taskCount: 3, description: t('agent.agentDocDesc') || '智能解析合同、报告、文档，提取关键信息。' },
    { id: '3', name: t('agent.agentReg') || '法规检索', icon: <RobotOutlined />, status: 'online', taskCount: 8, description: t('agent.agentRegDesc') || '实时追踪金融监管动态，解读新规要求。' },
    { id: '4', name: t('agent.agentQa') || '知识问答', icon: <RobotOutlined />, status: 'online', taskCount: 12, description: t('agent.agentQaDesc') || '基于企业知识库智能回答业务问题。' },
    { id: '5', name: t('agent.agentData') || '数据分析', icon: <RobotOutlined />, status: 'offline', taskCount: 0, description: t('agent.agentDataDesc') || '自动生成多维度数据统计分析报告。' },
  ];

  const initialTasks: AgentTask[] = [
    { id: 't1', name: t('agent.taskMinutes') || '季度会议纪要生成', type: t('agent.agentMeeting') || '会议助手', status: 'running', progress: 65, createdAt: '2026-07-24 14:30', agents: [t('agent.agentMeeting') || '会议助手', t('agent.agentQa') || '知识问答'], duration: t('agent.dur1') || '2 分 30 秒' },
    { id: 't2', name: t('agent.taskCompliance') || '合规文档解析', type: t('agent.agentDoc') || '文档解析', status: 'completed', progress: 100, createdAt: '2026-07-24 14:00', agents: [t('agent.agentDoc') || '文档解析'], duration: t('agent.dur2') || '5 分 12 秒' },
    { id: 't3', name: t('agent.taskRegulation') || '央行新规解读', type: t('agent.agentReg') || '法规检索', status: 'completed', progress: 100, createdAt: '2026-07-24 13:45', agents: [t('agent.agentReg') || '法规检索', t('agent.agentQa') || '知识问答'], duration: t('agent.dur3') || '1 分 15 秒' },
    { id: 't4', name: t('agent.taskReport') || 'Q2 销售报告生成', type: t('agent.agentData') || '数据分析', status: 'failed', progress: 40, createdAt: '2026-07-24 13:30', agents: [t('agent.agentData') || '数据分析'], duration: t('agent.dur4') || '3 分 10 秒' },
    { id: 't5', name: t('agent.taskSchedule') || '产品评审会议预约', type: t('agent.agentMeeting') || '会议助手', status: 'idle', progress: 0, createdAt: '2026-07-24 15:00', agents: [t('agent.agentMeeting') || '会议助手'] },
  ];

  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [taskList, setTaskList] = useState<AgentTask[]>(initialTasks);

  const getStatusTag = (status: AgentTask['status']) => {
    const config: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      idle: { color: 'default', text: t('agent.statusIdle'), icon: <ClockCircleOutlined /> },
      running: { color: 'processing', text: t('agent.statusRunning'), icon: <PlayCircleOutlined /> },
      completed: { color: 'success', text: t('agent.statusCompleted'), icon: <CheckCircleOutlined /> },
      failed: { color: 'error', text: t('agent.statusFailed'), icon: <ExclamationCircleOutlined /> },
    };
    return <Tag color={config[status].color} icon={config[status].icon}>{config[status].text}</Tag>;
  };

  const getAgentStatus = (status: AgentInfo['status']) => {
    const config: Record<string, { color: string; text: string }> = {
      online: { color: 'success', text: t('agent.statusOnline') },
      busy: { color: 'warning', text: t('agent.statusBusy') },
      offline: { color: 'default', text: t('agent.statusOffline') },
    };
    return <Badge status={config[status].color as any} text={config[status].text} />;
  };

  const columns: ColumnsType<AgentTask> = [
    { title: t('agent.taskName'), dataIndex: 'name', key: 'name', ellipsis: true, render: (text) => <Text strong>{text}</Text> },
    { title: t('agent.taskType'), dataIndex: 'type', key: 'type', width: 120, ellipsis: true, render: (text) => <Tag>{text}</Tag> },
    { title: t('agent.status'), dataIndex: 'status', key: 'status', width: 100, render: (status) => getStatusTag(status) },
    { title: t('agent.progress'), dataIndex: 'progress', key: 'progress', width: 160, render: (p, record) => <Progress percent={p} size="small" status={record.status === 'failed' ? 'exception' : undefined} /> },
    { title: t('agent.duration'), dataIndex: 'duration', key: 'duration', width: 120, render: (d) => d || '-' },
    { title: t('agent.agents'), dataIndex: 'agents', key: 'agents', width: 160, ellipsis: true, render: (agents) => <Space size={2} wrap>{agents.map(a => <Tag key={a} color="blue">{a}</Tag>)}</Space> },
    {
      title: t('common.action'),
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title={t('agent.viewDetail')}>
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedTask(record); setDetailVisible(true); }} />
          </Tooltip>
          {record.status === 'running' && (
            <Tooltip title={t('agent.pause')}>
              <Button type="text" size="small" icon={<PauseCircleOutlined />} danger onClick={() => message.warning(t('agent.pauseSuccess'))} />
            </Tooltip>
          )}
          {record.status === 'failed' && (
            <Tooltip title={t('agent.retry')}>
              <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => message.success(t('agent.retryRunning'))} />
            </Tooltip>
          )}
          <Popconfirm title={t('agent.deleteConfirm')} description={t('agent.deleteConfirmContent', { name: record.name })} onConfirm={() => { setTaskList(prev => prev.filter(t => t.id !== record.id)); message.success(t('agent.deleteSuccess')); }} okText={t('common.confirm')} cancelText={t('common.cancel')}>
            <Tooltip title={t('agent.delete')}>
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 20, background: '#F7F9FC', minHeight: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#1D2129' }}>
          <RobotOutlined style={{ marginRight: 8 }} />
          {t('agent.title')}
        </Title>
        <Text type="secondary">{t('agent.subtitle')}</Text>
      </div>

      <Card title={t('agent.activeAgents')}>
        <Row gutter={16}>
          {agents.map((agent) => (
            <Col span={8} key={agent.id} style={{ marginBottom: 12 }}>
              <Card
                hoverable
                style={{ border: '1px solid #E8EDF4' }}
                styles={{ body: { padding: 16 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      background: '#0F2B5B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 18,
                      marginRight: 12,
                    }}
                  >
                    {agent.icon}
                  </div>
                  <div>
                    <Text strong>{agent.name}</Text>
                    <div>{getAgentStatus(agent.status)}</div>
                  </div>
                </div>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: 12, marginBottom: 8 }}>
                  {agent.description}
                </Paragraph>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('agent.currentTasks')}: {agent.taskCount}
                  </Text>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      Modal.info({
                        title: t('agent.viewLog'),
                        width: 600,
                        content: (
                          <div style={{ maxHeight: 400, overflow: 'auto' }}>
                            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>
                              {`[14:30:00] ${t('agent.taskParse')}...\n[14:30:05] ${t('agent.agentDispatch')}...\n[14:30:06] Meeting ${t('agent.statusRunning')}...\n[14:31:30] Meeting ${t('agent.statusCompleted')}\n[14:31:31] QA ${t('agent.statusRunning')}...\n[14:32:00] ${t('agent.statusRunning')}... (65%)\n[14:32:30] QA ${t('agent.statusCompleted')}\n[14:32:31] ${t('agent.stepMerging')}\n[14:32:45] ${t('agent.statusCompleted')}`}
                            </pre>
                          </div>
                        ),
                        okText: t('common.close'),
                      });
                    }}
                  >
                    {t('agent.viewLog')}
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={t('agent.taskList')}>
        <Table columns={columns} dataSource={taskList} rowKey="id" pagination={false} scroll={{ x: 760 }} />
      </Card>

      <Modal
        title={t('agent.taskDetail')}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>{t('common.close')}</Button>,
          <Button
            key="rerun"
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => {
              message.success(t('agent.rerunSuccess'));
              setDetailVisible(false);
            }}
          >
            {t('agent.rerun')}
          </Button>,
        ]}
        style={{ width: 700, maxWidth: 'calc(100vw - 32px)' }}
      >
        {selectedTask && (
          <Space orientation="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text type="secondary">{t('agent.taskName')}：</Text>
              <Text strong>{selectedTask.name}</Text>
            </div>
            <div>
              <Text type="secondary">{t('agent.executionSteps')}：</Text>
              <Steps
                current={selectedTask.status === 'completed' ? 3 : selectedTask.status === 'failed' ? 2 : Math.floor(selectedTask.progress / 30)}
                items={[
                  { title: t('agent.taskParse'), description: t('agent.taskParseDesc') },
                  { title: t('agent.agentDispatch'), description: t('agent.agentDispatchDesc') },
                  { title: t('agent.stepExecuting'), description: `${selectedTask.progress}%` },
                  { title: t('agent.stepMerging'), description: t('agent.stepMergingDesc') },
                ]}
              />
            </div>
            <div>
              <Text type="secondary">{t('agent.agents')}：</Text>
              <Space>{selectedTask.agents.map(a => <Tag key={a} color="blue">{a}</Tag>)}</Space>
            </div>
            <div>
              <Text type="secondary">{t('agent.executionLog')}：</Text>
              <div style={{ background: '#F7F9FC', padding: 12, borderRadius: 6, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {`[14:30:00] ${t('agent.taskParse')}...\n[14:30:05] ${t('agent.agentDispatch')}...\n[14:30:06] ${t('agent.statusRunning')}...\n[14:31:30] ${t('agent.statusCompleted')}\n[14:31:31] QA ${t('agent.running')}...\n[14:32:00] ${t('agent.stepExecuting')}... (${selectedTask.progress}%)\n[14:32:30] ${t('agent.stepMerging')}\n[14:32:45] ${t('agent.statusCompleted')}`}
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AgentCenter;
