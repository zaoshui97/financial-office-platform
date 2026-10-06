/**
 * ActionDispatchPanel — 派单结果面板
 * 显示 closeMeeting() 自动派单产生的全部工单
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Space, Typography, Empty, Statistic, Row, Col, Tag, Button, Spin, Alert } from 'antd';
import {
  AppstoreOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { listMeetingActions } from '@/services/postMeetingService';
import { ActionCard, ActionCardData } from './ActionCard';

const { Text } = Typography;

export interface ActionDispatchPanelProps {
  meetingId: string;
  /** 派单批次的初始数据（如有） */
  initialDispatch?: {
    dispatchBatchId: string;
    workItems: Array<{ workItemId: string; sourceActionId: string; status: string; url: string; createdAt: string }>;
    allSuccess: boolean;
  };
  onRefresh?: () => void;
}

export const ActionDispatchPanel: React.FC<ActionDispatchPanelProps> = ({
  meetingId,
  initialDispatch,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<ActionCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | undefined>();
  // 防止 initialDispatch 引用每次都新（父级重渲染）触发反复写状态
  const lastInitialDispatchRef = useRef<typeof initialDispatch>(undefined);

  // 业务联动：会议生成待办 → 一键跳转审批中心
  // 把整批工单的第一个跳到 /approval（其余由 Approval 页 → 会议工单 store 展示）
  const handleGotoApprovalAll = () => {
    const first = items[0];
    if (!first) return;
    navigate('/approval', {
      state: {
        workItemId: first.workItemId,
        meetingId: first.meetingId,
        meetingTitle: first.meetingTitle,
      },
    });
  };

  // 把 onRefresh 锁定到 ref，避免父组件每次渲染传新回调导致 refresh 引用变化触发反复轮询
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMeetingActions(meetingId);
      setItems(data as ActionCardData[]);
      onRefreshRef.current?.();
    } catch (e) {
      console.error('[ActionDispatchPanel] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, [meetingId]); // 故意不依赖 onRefresh，避免父级 prop 变化触发反复轮询

  // 只在 meetingId 变化或挂载时刷新一次
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  // 合并初始派单结果
  useEffect(() => {
    if (!initialDispatch) return;
    if (lastInitialDispatchRef.current === initialDispatch) return;
    lastInitialDispatchRef.current = initialDispatch;
    setBatchId(initialDispatch.dispatchBatchId);
    // 把初始批次数据塞进列表（refresh 后会被覆盖）
    const initialItems: ActionCardData[] = initialDispatch.workItems.map((w) => ({
      workItemId: w.workItemId,
      description: '工单（详见关联会议纪要）',
      assignee: '参会人',
      dueDate: new Date().toISOString().slice(0, 10),
      priority: 'medium',
      status: w.status as any,
      url: w.url,
      createdAt: w.createdAt,
      meetingId,
    }));
    // 仅当当前列表为空时才填充初始数据
    setItems((prev) => (prev.length === 0 ? initialItems : prev));
  }, [initialDispatch, meetingId]);

  const handleClose = (workItemId: string) => {
    setItems((prev) => prev.filter((i) => i.workItemId !== workItemId));
  };

  // 统计
  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    inProgress: items.filter((i) => i.status === 'in_progress').length,
    done: items.filter((i) => i.status === 'done').length,
    high: items.filter((i) => i.priority === 'high' && i.status !== 'done').length,
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <AppstoreOutlined style={{ color: '#0F2B5B' }} />
          <span>{t('postMeeting.dispatchPanel')}</span>
          {batchId && <Tag color="blue">#{batchId.slice(0, 12)}</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<SendOutlined />}
            onClick={handleGotoApprovalAll}
            disabled={items.length === 0}
          >
            {'一键跳转审批'}
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            {t('common.refresh')}
          </Button>
        </Space>
      }
    >
      {/* 概览统计 */}
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic
            title={t('postMeeting.statTotal')}
            value={stats.total}
            valueStyle={{ fontSize: 18, color: '#0F2B5B' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('postMeeting.statPending')}
            value={stats.pending}
            valueStyle={{ fontSize: 18, color: '#F59E0B' }}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('postMeeting.statHighPriority')}
            value={stats.high}
            valueStyle={{ fontSize: 18, color: '#EF4444' }}
            prefix={<WarningOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('postMeeting.statDone')}
            value={stats.done}
            valueStyle={{ fontSize: 18, color: '#10B981' }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
      </Row>

      {initialDispatch && !initialDispatch.allSuccess && (
        <Alert
          type="warning"
          showIcon
          message={t('postMeeting.partialFailure')}
          description={t('postMeeting.partialFailureDesc')}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* 工单列表 */}
      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text type="secondary">{t('postMeeting.noActions')}</Text>
            }
          />
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {items.map((item) => (
              <ActionCard key={item.workItemId} action={item} onClose={handleClose} />
            ))}
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default ActionDispatchPanel;
