import React, { useState } from 'react';
import { Card, Steps, Button, Space, Tag, Typography, Progress, Tooltip, message } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  CalendarOutlined,
  BellOutlined,
  CheckCircleOutlined,
  SendOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './index.css';

const { Text, Title } = Typography;

interface ActionItem {
  id: string;
  description: string;
  assigneeName: string;
  dueDate: string;
  status: 'todo' | 'in_progress' | 'done';
}

interface TaskPipelineProps {
  meetingTitle: string;
  actionItems: ActionItem[];
  onPushWebhook?: (items: ActionItem[]) => void;
  pushing?: boolean;
}

const TaskPipeline: React.FC<TaskPipelineProps> = ({
  meetingTitle,
  actionItems,
  onPushWebhook,
  pushing = false,
}) => {
  const { t } = useTranslation();

  // 计算进度
  const totalItems = actionItems.length;
  const completedItems = actionItems.filter((item) => item.status === 'done').length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // 检查是否有紧急项（今天或过期）
  const today = new Date().toISOString().split('T')[0];
  const urgentItems = actionItems.filter(
    (item) => item.status !== 'done' && item.dueDate <= today
  );

  // 待办闭环流程步骤
  const steps = [
    {
      key: 'summary',
      title: t('meeting.minutes'),
      icon: <FileTextOutlined />,
      description: 'AI 生成',
    },
    {
      key: 'extract',
      title: t('taskPipeline.extractTasks'),
      icon: <SyncOutlined />,
      description: '智能拆解',
    },
    {
      key: 'assign',
      title: t('taskPipeline.assignTasks'),
      icon: <TeamOutlined />,
      description: '分配负责人',
    },
    {
      key: 'track',
      title: t('taskPipeline.trackTasks'),
      icon: <CalendarOutlined />,
      description: '截止日提醒',
    },
    {
      key: 'push',
      title: t('taskPipeline.pushTasks'),
      icon: <SendOutlined />,
      description: '推送第三方',
    },
    {
      key: 'done',
      title: t('taskPipeline.taskDone'),
      icon: <CheckCircleOutlined />,
      description: '状态更新',
    },
  ];

  // 当前活跃步骤
  const currentStep = progress === 100 ? 5 : progress > 0 ? Math.max(1, Math.floor(progress / 20)) : 0;

  const handlePush = () => {
    if (onPushWebhook) {
      onPushWebhook(actionItems);
    } else {
      message.success(t('meeting.pushSuccess'));
    }
  };

  return (
    <Card className="task-pipeline">
      {/* 流程图标题 */}
      <div className="pipeline-header">
        <Title level={5} style={{ margin: 0 }}>
          <SyncOutlined style={{ marginRight: 8 }} />
          {t('taskPipeline.title')}
        </Title>
        <Text type="secondary">{t('taskPipeline.subtitle')}</Text>
      </div>

      {/* 流程图 */}
      <div className="pipeline-steps">
        <Steps
          current={currentStep}
          size="small"
          items={steps.map((step, index) => ({
            title: step.title,
            icon: step.icon,
            description: step.description,
          }))}
        />
      </div>

      {/* 进度统计 */}
      <div className="pipeline-stats">
        <Card className="pipeline-progress-card">
          <div className="pipeline-progress-header">
            <Text strong>{t('taskPipeline.overallProgress')}</Text>
            <Text type="secondary">{completedItems}/{totalItems} {t('taskPipeline.tasksCompleted')}</Text>
          </div>
          <Progress
            percent={progress}
            status={progress === 100 ? 'success' : 'active'}
            strokeColor={{
              '0%': '#0F2B5B',
              '100%': '#C9A459',
            }}
          />
        </Card>

        {/* 紧急提醒 */}
        {urgentItems.length > 0 && (
          <Card className="pipeline-urgent-card">
            <div className="urgent-header">
              <ExclamationCircleOutlined style={{ color: '#D64045' }} />
              <Text strong style={{ color: '#D64045' }}>
                {t('taskPipeline.urgentTasks')} ({urgentItems.length})
              </Text>
            </div>
            <ul className="urgent-list">
              {urgentItems.map((item) => (
                <li key={item.id} className="urgent-item">
                  <ClockCircleOutlined style={{ color: '#E69948', marginRight: 8 }} />
                  <Text>{item.description}</Text>
                  <Tag color="red" style={{ marginLeft: 8 }}>{item.dueDate}</Tag>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="pipeline-actions">
        <Space>
          <Tooltip title={t('taskPipeline.pushTip')}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handlePush}
              loading={pushing}
              disabled={totalItems === 0}
            >
              {t('meeting.pushToDingtalk')}
            </Button>
          </Tooltip>
          <Button icon={<BellOutlined />}>
            {t('taskPipeline.setReminder')}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default TaskPipeline;
