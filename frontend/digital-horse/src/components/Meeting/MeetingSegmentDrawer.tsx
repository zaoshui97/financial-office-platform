/**
 * MeetingSegmentDrawer —— 会议片段回溯抽屉
 *
 * 用途：从工单 → 一键跳到触发生成该工单的会议原文片段
 *
 * 演示模式：从 store 内 getMeetingSegment() 合成片段
 * 真实对接：fetch(`/api/meetings/{meetingId}/segments/{segmentId}`)
 */

import React, { useEffect, useState } from 'react';
import { Drawer, Typography, Tag, Space, Empty, Spin, Descriptions } from 'antd';
import { AudioOutlined, FieldTimeOutlined, UserOutlined } from '@ant-design/icons';
import { useMeetingWorkItemStore, type MeetingSegment } from '@/store/meetingWorkItemStore';

const { Paragraph, Text } = Typography;

interface MeetingSegmentDrawerProps {
  workItemId: string | null;
  open: boolean;
  onClose: () => void;
}

export const MeetingSegmentDrawer: React.FC<MeetingSegmentDrawerProps> = ({
  workItemId,
  open,
  onClose,
}) => {
  const getMeetingSegment = useMeetingWorkItemStore((s) => s.getMeetingSegment);
  const getById = useMeetingWorkItemStore((s) => s.getById);
  const [segment, setSegment] = useState<MeetingSegment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !workItemId) return;
    setLoading(true);
    // 模拟异步加载
    const t = window.setTimeout(() => {
      const seg = getMeetingSegment(workItemId);
      setSegment(seg || null);
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, workItemId, getMeetingSegment]);

  const workItem = workItemId ? getById(workItemId) : undefined;

  return (
<Drawer
        title={
          <Space>
            <AudioOutlined />
            <span>会议片段回溯</span>
            {workItem?.meetingTitle && <Tag color="blue">{workItem.meetingTitle}</Tag>}
          </Space>
        }
        placement="right"
        open={open}
        onClose={onClose}
        styles={{ wrapper: { width: 560, maxWidth: 'calc(100vw - 32px)' } }}
      >
      {loading ? (
        <Spin />
      ) : !workItem ? (
        <Empty description="未找到工单" />
      ) : !segment ? (
        <Empty description="该工单未关联会议片段" />
      ) : (
        <>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={<><UserOutlined /> 说话人</>}>{segment.speaker}</Descriptions.Item>
            <Descriptions.Item label={<><FieldTimeOutlined /> 时间戳</>}>
              {new Date(segment.ts).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="片段 ID">
              <Text code>{segment.segmentId}</Text>
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>会议原文</div>
            <Paragraph
              style={{
                background: 'rgba(15,43,91,0.04)',
                borderLeft: '3px solid #0F2B5B',
                padding: '12px 16px',
                borderRadius: 4,
                marginBottom: 0,
              }}
            >
              “{segment.text}”
            </Paragraph>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>由该片段触发的工单</div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="工单标题">{workItem.title}</Descriptions.Item>
              <Descriptions.Item label="负责人">{workItem.assignee}</Descriptions.Item>
              <Descriptions.Item label="截止日期">{workItem.dueDate}</Descriptions.Item>
              <Descriptions.Item label="优先级">
                <Tag color={workItem.priority === 'high' ? 'red' : workItem.priority === 'medium' ? 'gold' : 'default'}>
                  {workItem.priority.toUpperCase()}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>
        </>
      )}
    </Drawer>
  );
};

export default MeetingSegmentDrawer;
