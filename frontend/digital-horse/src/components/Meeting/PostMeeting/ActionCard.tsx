/**
 * ActionCard — 单个工单卡片（含状态机操作 + 跳转审批）
 *
 * 业务联动（会议生成待办 → 工单/审批 一键跳转）：
 *   - "打开工单"按钮不再 window.open，而是走 SPA 内部跳转 /approval?workItemId=xxx
 *   - 通过 router state 把 workItemId / meetingId 透传给 Approval 页，
 *     让 Approval 页能精准定位到这个会议派单产生的工单
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Space, Button, Avatar, Tooltip, message, Modal, Input } from 'antd';
import {
  CheckOutlined,
  UserOutlined,
  CalendarOutlined,
  FlagOutlined,
  LinkOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { closeOutAction } from '@/services/postMeetingService';

export interface ActionCardData {
  workItemId: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'done';
  url: string;
  createdAt: string;
  /** 关联会议 ID（用于跳转审批后回填上下文，可选） */
  meetingId?: string;
  /** 关联会议标题（可选） */
  meetingTitle?: string;
}

export interface ActionCardProps {
  action: ActionCardData;
  onClose?: (workItemId: string) => void;
}

const priorityColor = {
  high: 'red',
  medium: 'orange',
  low: 'green',
} as const;

const priorityLabel = {
  high: 'postMeeting.priorityHigh',
  medium: 'postMeeting.priorityMedium',
  low: 'postMeeting.priorityLow',
};

export const ActionCard: React.FC<ActionCardProps> = ({ action, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const [remark, setRemark] = useState('');

  const handleClose = async () => {
    Modal.confirm({
      title: t('postMeeting.confirmClose'),
      content: (
        <div>
          <p>{t('postMeeting.confirmCloseDesc')}</p>
          <Input.TextArea
            rows={2}
            placeholder={t('postMeeting.closeRemark')}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: t('postMeeting.closeIt'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        setClosing(true);
        try {
          await closeOutAction(action.workItemId, { remark });
          message.success(t('postMeeting.closeSuccess'));
          onClose?.(action.workItemId);
        } catch (e) {
          message.error(t('postMeeting.closeFailed'));
        } finally {
          setClosing(false);
          setRemark('');
        }
      },
    });
  };

  // 一键跳转审批（会议待办 → 工单/审批 业务联动）
  // 跳转 /approval?workItemId=xxx，Approval 页根据 workItemId 定位到对应工单
  const handleGotoApproval = () => {
    navigate('/approval', {
      state: {
        workItemId: action.workItemId,
        meetingId: action.meetingId,
        meetingTitle: action.meetingTitle,
      },
    });
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderLeft: `4px solid var(--ant-color-${priorityColor[action.priority]})`,
        opacity: action.status === 'done' ? 0.6 : 1,
      }}
      bodyStyle={{ padding: 12 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Space size={4} style={{ marginBottom: 6 }} wrap>
            <Tag color={priorityColor[action.priority]} icon={<FlagOutlined />}>
              {t(priorityLabel[action.priority])}
            </Tag>
            {action.status === 'done' ? (
              <Tag color="success" icon={<CheckOutlined />}>
                {t('postMeeting.statusDone')}
              </Tag>
            ) : (
              <Tag color="processing">
                {t('postMeeting.statusPending')}
              </Tag>
            )}
            <Tooltip title={action.workItemId}>
              <Tag icon={<LinkOutlined />} color="default" style={{ fontSize: 10 }}>
                {action.workItemId.slice(0, 16)}...
              </Tag>
            </Tooltip>
            {action.meetingTitle && (
              <Tooltip title={`会议：${action.meetingTitle}`}>
                <Tag color="blue" style={{ fontSize: 10 }}>{action.meetingTitle.slice(0, 14)}</Tag>
              </Tooltip>
            )}
          </Space>

          <div style={{ fontSize: 13, color: '#1F2937', marginBottom: 6 }}>
            {action.description}
          </div>

          <Space size={12} wrap style={{ fontSize: 12, color: '#6B7280' }}>
            <Space size={4}>
              <Avatar size={18} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <span>{action.assignee}</span>
            </Space>
            <Space size={4}>
              <CalendarOutlined />
              <span>{action.dueDate}</span>
            </Space>
          </Space>
        </div>

        <Space direction="vertical" size={4}>
          {action.status !== 'done' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleClose}
              loading={closing}
            >
              {t('postMeeting.close')}
            </Button>
          )}
          {/* 一键跳转审批：会议派单工单 → /approval?workItemId= */}
          <Button
            size="small"
            type="link"
            icon={<SendOutlined />}
            onClick={handleGotoApproval}
          >
            {'一键跳转审批'}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default ActionCard;
