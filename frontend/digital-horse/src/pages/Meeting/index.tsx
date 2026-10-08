/**
 * 会议列表页（Phase 3）
 */

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { MeetingRead, MeetingStatus, meetingApi } from '@/api/meeting';
import { useMeetingStore } from '@/store/meetingStore';
import { meetingInviteApi, JoinResult } from '@/api/meetingInvite';

const STATUS_COLOR: Record<MeetingStatus, string> = {
  preparing: 'default',
  active: 'processing',
  closed: 'success',
};
const STATUS_LABEL: Record<MeetingStatus, string> = {
  preparing: '准备中',
  active: '进行中',
  closed: '已关闭',
};

export default function MeetingListPage() {
  const navigate = useNavigate();
  const meetings = useMeetingStore((s) => s.meetings);
  const loadList = useMeetingStore((s) => s.loadList);
  const createMeeting = useMeetingStore((s) => s.createMeeting);
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  // 用邀请码加入（任何角色都能用）
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    loadList(statusFilter).catch((e) =>
      message.error(`加载会议失败：${e.message}`),
    );
  }, [loadList, statusFilter]);

  const onCreate = async () => {
    const values = await form.validateFields();
    try {
      const m = await createMeeting({
        title: values.title,
        topic: values.topic || null,
        agenda: values.agenda || null,
      });
      message.success(`会议 #${m.id} 已创建`);
      setModalOpen(false);
      form.resetFields();
      navigate(`/meetings/${m.id}`);
    } catch (e: any) {
      message.error(`创建失败：${e.message}`);
    }
  };

  /** 用邀请码加入会议 —— 列表页快捷入口 */
  const onJoinByCode = async () => {
    const code = joinCode.trim();
    if (!code) {
      message.warning('请输入邀请码');
      return;
    }
    setJoinLoading(true);
    try {
      const res: JoinResult = await meetingInviteApi.join(code);
      if (res.joined) {
        message.success(res.message || '加入成功');
        setJoinOpen(false);
        setJoinCode('');
        // 刷新列表（让用户看到刚加入的会议）+ 跳详情
        try { await loadList(statusFilter); } catch { /* ignore */ }
        navigate(`/meetings/${res.meeting_id}`);
      } else {
        message.warning(res.message || '未加入会议');
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? e?.message ?? '加入失败');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          会议
        </Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="按状态筛选"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'active', label: '进行中' },
              { value: 'closed', label: '已关闭' },
              { value: 'preparing', label: '准备中' },
            ]}
          />
          <Button
            icon={<KeyOutlined />}
            onClick={() => setJoinOpen(true)}
          >
            用邀请码加入
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            新建会议
          </Button>
        </Space>
      </Space>

      {meetings.length === 0 ? (
        <Empty description="还没有会议，点击右上角创建一个" />
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}

      <Modal
        title="新建会议"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onCreate}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="会议标题"
            rules={[{ required: true, max: 200 }]}
          >
            <Input placeholder="例如：Q3 风控评审" maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="topic" label="会议主题" rules={[{ max: 500 }]}>
            <Input placeholder="（可选）一句话描述会议核心议题" maxLength={500} />
          </Form.Item>
          <Form.Item name="agenda" label="初始议题" rules={[{ max: 500 }]}>
            <Input placeholder="（可选）希望首先讨论什么" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 用邀请码加入弹窗 —— 列表页入口，任何角色可用 */}
      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#1890ff' }} />
            <span>用邀请码加入会议</span>
          </Space>
        }
        open={joinOpen}
        onCancel={() => { setJoinOpen(false); setJoinCode(''); }}
        onOk={onJoinByCode}
        confirmLoading={joinLoading}
        okText="加入"
        cancelText="取消"
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            请向会议组织者获取 6 位字符串邀请码：
          </Typography.Text>
          <Input
            size="large"
            placeholder="例如：a8K2pZ"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onPressEnter={onJoinByCode}
            maxLength={32}
            style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 18 }}
          />
        </Space>
      </Modal>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: MeetingRead }) {
  const navigate = useNavigate();
  return (
    <Card
      hoverable
      title={meeting.title}
      extra={<Tag color={STATUS_COLOR[meeting.status]}>{STATUS_LABEL[meeting.status]}</Tag>}
      onClick={() => navigate(`/meetings/${meeting.id}`)}
    >
      {meeting.topic && (
        <Typography.Paragraph
          type="success"
          style={{ marginBottom: 4 }}
          ellipsis={{ rows: 1 }}
        >
          主题：{meeting.topic}
        </Typography.Paragraph>
      )}
      {meeting.agenda && (
        <Typography.Paragraph
          type="warning"
          style={{ marginBottom: 4 }}
          ellipsis={{ rows: 1 }}
        >
          议题：{meeting.agenda}
        </Typography.Paragraph>
      )}
      {meeting.current_phase && (
        <Typography.Text type="secondary">
          当前阶段：{meeting.current_phase}
        </Typography.Text>
      )}
    </Card>
  );
}