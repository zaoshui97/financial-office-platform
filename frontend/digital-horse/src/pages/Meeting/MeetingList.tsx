import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  Select as UserSelect,
  Tag,
  Avatar,
  Space,
  Popconfirm,
  message,
  Tabs,
  Typography,
  Badge,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  VideoCameraOutlined,
  EnterOutlined,
  CalendarOutlined,
  SoundOutlined,
  TeamOutlined,
  ExperimentOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Meeting, MeetingStatus } from '@/types/api';
import { formatDate, generateId } from '@/utils/format';
import { useTranslation } from 'react-i18next';
import i18n, { isZh } from '@/i18n';
import { useDemoMode } from '@/hooks/useDemoMode';

const { RangePicker } = DatePicker;
const { Text } = Typography;

// Mock 用户
const getMockUsers = () => {
  return [
    { id: 'user-001', name: '张三', avatar: '#1890ff' },
    { id: 'user-002', name: '李四', avatar: '#52c41a' },
    { id: 'user-003', name: '王五', avatar: '#fa8c16' },
    { id: 'user-004', name: '赵六', avatar: '#0F2B5B' },
    { id: 'user-005', name: '钱七', avatar: '#eb2f96' },
  ];
};

// Mock 会议数据
const getInitialMeetings = (): Meeting[] => {
  return [
    {
      id: 'meeting-001',
      title: '2024年Q1产品规划会议',
      startTime: '2024-01-20T14:00:00+08:00',
      endTime: '2024-01-20T15:30:00+08:00',
      participants: ['user-001', 'user-002', 'user-003', 'user-004'],
      status: 'ended',
      summary: '本次会议讨论了Q1产品规划，确定了核心功能优先级，分配了各模块负责人。',
      createdAt: '2024-01-18T10:00:00+08:00',
      updatedAt: '2024-01-20T16:00:00+08:00',
    },
    {
      id: 'meeting-002',
      title: '技术架构评审会',
      startTime: '2024-01-22T09:00:00+08:00',
      endTime: '2024-01-22T12:00:00+08:00',
      participants: ['user-001', 'user-005'],
      status: 'ended',
      createdAt: '2024-01-15T08:00:00+08:00',
      updatedAt: '2024-01-22T12:30:00+08:00',
    },
    {
      id: 'meeting-003',
      title: '年度战略规划研讨会',
      startTime: '2024-02-05T10:00:00+08:00',
      endTime: '2024-02-05T17:00:00+08:00',
      participants: ['user-001', 'user-003', 'user-004'],
      status: 'pending',
      createdAt: '2024-01-20T14:00:00+08:00',
      updatedAt: '2024-01-20T14:00:00+08:00',
    },
    {
      id: 'meeting-004',
      title: '产品周会',
      startTime: '2024-01-24T15:00:00+08:00',
      endTime: '2024-01-24T16:00:00+08:00',
      participants: ['user-002', 'user-003'],
      status: 'ongoing',
      createdAt: '2024-01-23T09:00:00+08:00',
      updatedAt: '2024-01-24T15:00:00+08:00',
    },
    {
      id: 'meeting-005',
      title: '客户需求评审',
      startTime: '2024-01-26T14:00:00+08:00',
      endTime: '2024-01-26T15:30:00+08:00',
      participants: ['user-001', 'user-002', 'user-005'],
      status: 'pending',
      createdAt: '2024-01-24T11:00:00+08:00',
      updatedAt: '2024-01-24T11:00:00+08:00',
    },
  ];
};

// 模拟正在进行的会议
const getOngoingMeetings = (): Meeting[] => {
  return getInitialMeetings().filter(m => m.status === 'ongoing');
};

const MeetingList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDemoMode, enterDemoMode, autoRunDemo } = useDemoMode();
  const [meetings, setMeetings] = useState<Meeting[]>(getInitialMeetings);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [mockUsers, setMockUsers] = useState(getMockUsers());
  const [activeTab, setActiveTab] = useState('ongoing');

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChange = () => {
      setMockUsers(getMockUsers());
      setMeetings(getInitialMeetings());
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const ongoingMeetings = meetings.filter(m => m.status === 'ongoing');

  const getStatusTag = (status: MeetingStatus) => {
    const config: Record<MeetingStatus, { color: string; text: string }> = {
      pending: { color: 'default', text: t('meeting.pending') },
      ongoing: { color: 'processing', text: t('meeting.inProgress') },
      ended: { color: 'success', text: t('meeting.ended') },
    };
    return config[status] || { color: 'default', text: status };
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      const matchesSearch =
        !searchText || meeting.title.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus = !statusFilter || meeting.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [meetings, searchText, statusFilter]);

  const handleCreateMeeting = async () => {
    try {
      const values = await form.validateFields();
      const newMeeting: Meeting = {
        id: generateId('meeting'),
        title: values.title,
        startTime: values.timeRange[0].toISOString(),
        endTime: values.timeRange[1].toISOString(),
        participants: values.participants,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMeetings((prev) => [newMeeting, ...prev]);
      message.success(t('common.success'));
      setIsModalOpen(false);
      form.resetFields();
    } catch {
      // Form validation failed
    }
  };

  // 加入已有会议
  const handleJoinMeeting = async () => {
    try {
      const values = await joinForm.validateFields();
      const meeting = meetings.find(m => m.id === values.meetingId);
      
      if (meeting) {
        // 更新会议状态为进行中
        setMeetings(prev => prev.map(m => 
          m.id === values.meetingId ? { ...m, status: 'ongoing' as MeetingStatus } : m
        ));
        navigate(`/meeting-room/${values.meetingId}`);
      } else {
        message.error(t('meeting.notFound'));
      }
      setIsJoinModalOpen(false);
      joinForm.resetFields();
    } catch {
      // Form validation failed
    }
  };

  // 开始新会议
  const handleStartMeeting = (meetingId: string) => {
    setMeetings(prev => prev.map(m => 
      m.id === meetingId ? { ...m, status: 'ongoing' as MeetingStatus } : m
    ));
    navigate(`/meeting-room/${meetingId}`);
  };

  const handleDelete = (id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    message.success(t('common.success'));
  };

  const columns: ColumnsType<Meeting> = [
    {
      title: t('meeting.agenda'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 220,
      fixed: 'left',
      render: (title: string) => <b>{title}</b>,
    },
    {
      title: t('meeting.startTime'),
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      ellipsis: true,
      render: (time: string) => formatDate(time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: t('meeting.endTime'),
      dataIndex: 'endTime',
      key: 'endTime',
      width: 160,
      ellipsis: true,
      render: (time: string) => formatDate(time, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: t('meeting.participants'),
      dataIndex: 'participants',
      key: 'participants',
      width: 140,
      ellipsis: true,
      render: (participants: string[]) => (
        <Avatar.Group size="small" max={{ count: 3 }}>
          {participants.map((userId) => {
            const user = mockUsers.find((u) => u.id === userId);
            return (
              <Tooltip key={userId} title={user?.name}>
                <Avatar style={{ backgroundColor: user?.avatar || '#1890ff' }}>
                  {user?.name.charAt(0) || 'U'}
                </Avatar>
              </Tooltip>
            );
          })}
        </Avatar.Group>
      ),
    },
    {
      title: t('meeting.status'),
      dataIndex: 'status',
      key: 'status',
      width: 96,
      render: (status: MeetingStatus) => {
        const { color, text } = getStatusTag(status);
        return <Tag color={color} style={{ borderRadius: 4, margin: 0 }}>{text}</Tag>;
      },
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4} wrap>
          {record.status === 'ongoing' && (
            <Button
              size="small"
              type="primary"
              icon={<EnterOutlined />}
              onClick={() => navigate(`/meeting-room/${record.id}`)}
            >
              {t('meeting.joinMeeting')}
            </Button>
          )}
          {record.status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<VideoCameraOutlined />}
                onClick={() => handleStartMeeting(record.id)}
              >
                {t('meeting.start')}
              </Button>
              <Button
                size="small"
                icon={<ExperimentOutlined />}
                onClick={() => navigate(`/meeting-rehearsal/${record.id}`)}
              >
                {'预演'}
              </Button>
            </>
          )}
          {record.status === 'ended' && (
            <>
              <Button
                size="small"
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/meeting/${record.id}`)}
              >
                {t('common.view')}
              </Button>
              <Button
                size="small"
                type="link"
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/meeting/${record.id}/report`)}
              >
                {'报告'}
              </Button>
            </>
          )}
          <Popconfirm
            title={t('common.confirm')}
            description={t('common.delete') + '?'}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 会议选择项（用于加入会议）
  const meetingOptions = meetings
    .filter(m => m.status === 'pending')
    .map(m => ({
      value: m.id,
      label: `${m.title} (${formatDate(m.startTime, 'MM-DD HH:mm')})`,
    }));

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* 快捷入口卡片 */}
      <div style={{ marginBottom: 24 }}>
        <Space size="middle" wrap>
          <Button
            type="primary"
            size="large"
            icon={<VideoCameraOutlined />}
            onClick={() => setIsJoinModalOpen(true)}
            style={{ height: 56, paddingLeft: 24, paddingRight: 24 }}
          >
            {t('meeting.joinMeeting')}
          </Button>
          <Button
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
            style={{ height: 56, paddingLeft: 24, paddingRight: 24 }}
          >
            {t('meeting.newMeeting')}
          </Button>
          <Button
            size="large"
            icon={<ExperimentOutlined />}
            onClick={() => {
              enterDemoMode();
              // 添加一个演示会议到列表，然后直接进入
              const demoMeeting: Meeting = {
                id: 'demo-meeting-q4-budget',
                title: '2024年Q4预算审批与合规整改专题会',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                participants: ['user-001', 'user-002', 'user-003', 'user-004'],
                status: 'ended',
                summary: '演示模式会议',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setMeetings((prev) => {
                if (prev.find((m) => m.id === demoMeeting.id)) return prev;
                return [demoMeeting, ...prev];
              });
              autoRunDemo(
                t('meeting.demoMode.running'),
                t('meeting.demoMode.completed')
              );
              navigate('/meeting/demo-meeting-q4-budget/report');
            }}
            style={{
              height: 56,
              paddingLeft: 24,
              paddingRight: 24,
              background: '#0F2B5B',
              borderColor: '#0a1e40',
              color: '#fff',
            }}
          >
            {'进入演示模式'}
          </Button>
        </Space>
        {isDemoMode && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#0F2B5B' }}>
            <ExperimentOutlined /> {'演示模式已开启：点击"查看报告"体验完整闭环'}
          </div>
        )}
      </div>

      {/* 正在进行中的会议 */}
      {ongoingMeetings.length > 0 && (
        <Card
          title={
            <Space>
              <Badge status="processing" />
              <span>{t('meeting.ongoingMeetings')}</span>
              <Tag color="processing">{ongoingMeetings.length}</Tag>
            </Space>
          }
          style={{ marginBottom: 16, borderColor: '#1890ff' }}
          styles={{ body: { padding: 0 } }}
        >
          {ongoingMeetings.map((meeting) => (
              <div
                key={meeting.id}
                style={{ padding: '12px 24px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => navigate(`/meeting-room/${meeting.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'rgba(24, 144, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <VideoCameraOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  </div>
                  <div>
                    <Space>
                      {meeting.title}
                      <Badge status="processing" />
                    </Space>
                    <div>
                      <Space>
                        <span><TeamOutlined /> {meeting.participants.length} {t('meeting.participants')}</span>
                        <Text type="secondary">·</Text>
                        <span><SoundOutlined /> {t('meeting.liveTranscribing')}</span>
                      </Space>
                    </div>
                  </div>
                </div>
                <Button type="primary" icon={<EnterOutlined />}>
                  {t('meeting.joinNow')}
                </Button>
              </div>
          ))}
        </Card>
      )}

      <Card
        title={<h2 style={{ margin: 0 }}>{t('meeting.title')}</h2>}
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              {t('meeting.newMeeting')}
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            if (key === 'all') {
              setStatusFilter('');
            } else {
              setStatusFilter(key as MeetingStatus);
            }
          }}
          items={[
            {
              key: 'all',
              label: t('common.all'),
            },
            {
              key: 'ongoing',
              label: (
                <Space>
                  {t('meeting.inProgress')}
                  {ongoingMeetings.length > 0 && <Badge count={ongoingMeetings.length} size="small" />}
                </Space>
              ),
            },
            {
              key: 'pending',
              label: t('meeting.pending'),
            },
            {
              key: 'ended',
              label: t('meeting.ended'),
            },
          ]}
        />

        <div style={{ marginBottom: 16 }}>
          <Space size="middle" wrap>
            <Input
              placeholder={t('meeting.agenda') + '...'}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 150 }}
              placeholder={t('meeting.status')}
              allowClear
            >
              <Select.Option value="">{t('common.all')}</Select.Option>
              <Select.Option value="pending">{t('meeting.pending')}</Select.Option>
              <Select.Option value="ongoing">{t('meeting.inProgress')}</Select.Option>
              <Select.Option value="ended">{t('meeting.ended')}</Select.Option>
            </Select>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredMeetings}
          rowKey="id"
          scroll={{ x: 960 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => t('common.total') + `: ${total}`,
          }}
        />
      </Card>

      {/* 新建会议弹窗 */}
      <Modal
        title={t('meeting.newMeeting')}
        open={isModalOpen}
        onOk={handleCreateMeeting}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label={t('meeting.agenda')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('meeting.agenda') + '...'} />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label={t('meeting.startTime') + ' - ' + t('meeting.endTime')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="participants"
            label={t('meeting.participants')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <UserSelect
              mode="multiple"
              placeholder={t('meeting.participants') + '...'}
              optionLabelProp="label"
            >
              {mockUsers.map((user) => (
                <UserSelect.Option key={user.id} value={user.id} label={user.name}>
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: user.avatar }}>
                      {user.name.charAt(0)}
                    </Avatar>
                    {user.name}
                  </Space>
                </UserSelect.Option>
              ))}
            </UserSelect>
          </Form.Item>
        </Form>
      </Modal>

      {/* 加入会议弹窗 */}
      <Modal
        title={t('meeting.joinMeeting')}
        open={isJoinModalOpen}
        onOk={handleJoinMeeting}
        onCancel={() => {
          setIsJoinModalOpen(false);
          joinForm.resetFields();
        }}
        okText={t('meeting.join')}
        cancelText={t('common.cancel')}
      >
        <Form form={joinForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="meetingId"
            label={t('meeting.selectMeeting')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select
              placeholder={t('meeting.selectMeeting') + '...'}
              options={meetingOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MeetingList;