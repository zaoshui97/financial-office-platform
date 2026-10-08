import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Space,
  Tabs,
  Avatar,
  Alert,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Dropdown,
  App,
  Empty,
  Progress,
  Typography,
  Descriptions,
  Spin,
  Steps,
  Tooltip,
  message as antdMessage,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  FileTextOutlined,
  DownloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  KeyOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { formatDate, generateId } from '@/utils/format';
import type { Meeting, ActionItem, MeetingStatus } from '@/types/api';
import { useMeetingWorkItemStore } from '@/store/meetingWorkItemStore';
import i18n from '@/i18n';
import TaskPipeline from '@/components/TaskPipeline';
import { meetingInviteApi, type InviteCode, type JoinResult } from '@/api/meetingInvite';
import { http } from '@/utils/request';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// mock dataMock mock data
const getMockUsers = () => [
  { id: 'user-001', name: '张三' },
  { id: 'user-002', name: '李四' },
  { id: 'user-003', name: '王五' },
  { id: 'user-004', name: '赵六' },
  { id: 'user-005', name: '钱七' },
];

// mock dataMock mock data
const getMockMeeting = (): Meeting => {
  const users = getMockUsers();

  const mockZhTranscript = `会议开始，主持人介绍本次评审的议程...\n\n第一项：张三分享了 Q1 产品数据 - 用户增长 15%，DAU 提升 8%。\n\n讨论：\n- 李四：分析了增长来源，认为新功能贡献最大\n- 王五：建议加强用户留存优化\n\n第二项：李四介绍了技术方案，包括微服务迁移计划。\n\n关键技术要点：\n1. 拆分为 5 个独立服务\n2. 采用 Docker 容器化部署\n3. 引入 K8s 进行服务编排\n\n决议：\n1. Q2 优先优化用户留存\n2. 3 月启动微服务迁移试点\n3. 2 月第一周组织技术分享会`;

  const mockZhSummary = `## 会议摘要\n\n本次产品评审会重点回顾了 Q1 产品数据并规划 Q2 工作。\n\n**关键结论：**\n- Q1 用户增长 15%，表现良好\n- Q2 优先优化用户留存\n- 3 月启动微服务迁移试点\n\n**后续行动：**\n- 完成缓存方案详细设计（负责人：李四，截止 1 月 25 日）\n- 编写微服务迁移文档（负责人：王五，截止 1 月 28 日）`;

  return {
    id: 'meeting-001',
    title: '产品迭代评审会 - Q1 Sprint',
    startTime: '2024-01-20T14:00:00+08:00',
    endTime: '2024-01-20T15:30:00+08:00',
    participants: ['user-001', 'user-002', 'user-003', 'user-004'],
    status: 'ended',
    transcript: mockZhTranscript,
    summary: mockZhSummary,
    actionItems: [
      {
        id: 'action-001',
        description: '完成缓存方案详细设计',
        assignee: 'user-002',
        assigneeName: users[1].name,
        dueDate: '2024-01-25',
        status: 'todo',
      },
      {
        id: 'action-002',
        description: '编写微服务迁移文档',
        assignee: 'user-003',
        assigneeName: users[2].name,
        dueDate: '2024-01-28',
        status: 'in_progress',
      },
      {
        id: 'action-003',
        description: '组织技术分享会',
        assignee: 'user-001',
        assigneeName: users[0].name,
        dueDate: '2024-02-01',
        status: 'done',
      },
    ],
    createdAt: '2024-01-18T10:00:00+08:00',
    updatedAt: '2024-01-20T16:00:00+08:00',
  };
};

const MeetingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  // 闭环：会议行动项 → 审批（创建工单 + 跳转审批页）
  const createWorkItem = useMeetingWorkItemStore((s) => s.createWorkItem);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [audioVisualizerBars, setAudioVisualizerBars] = useState<number[]>(Array(16).fill(0));
  const [form] = Form.useForm();
  const [mockUsers, setMockUsers] = useState(getMockUsers());

  // ===== 会议邀请码状态 =====
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  // 「用邀请码加入」入口已统一放 MeetingHub 顶栏，本页不再单独提供

  // mock data
  useEffect(() => {
    if (!transcribing) {
      setAudioVisualizerBars(Array(16).fill(0));
      return;
    }
    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      const bars = Array.from({ length: 16 }, (_, i) => {
        const base = Math.sin(frame * 0.3 + i * 0.5) * 0.5 + 0.5;
        const noise = Math.random() * 0.5;
        return Math.min(1, base + noise);
      });
      setAudioVisualizerBars(bars);
    }, 80);
    return () => clearInterval(interval);
  }, [transcribing]);

  // mock datamock mock data（仅当没有真实数据时 language change 才重置）
  useEffect(() => {
    const handleLanguageChange = () => {
      setMockUsers(getMockUsers());
      // mock data 没真实数据时（demo 路径）才重置
      if (meeting && (meeting.id === 'meeting-001' || !meeting.id)) {
        setMeeting(getMockMeeting());
      }
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [meeting]);

  // 拉真实会议数据，失败兜底 mock
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const mid = Number(id ?? 0);
      // 没有 id 或非数字 id（mock 详情页） → 直接显示 mock
      if (!mid || Number.isNaN(mid)) {
        setMeeting(getMockMeeting());
        setLoading(false);
        return;
      }
      try {
        const data = await http.get(`/meetings/${mid}`);
        if (cancelled) return;
        if (data) {
          setMeeting({
            id: String(data.id ?? mid),
            title: data.title ?? data.topic ?? `会议 #${mid}`,
            startTime: data.scheduled_at ?? data.startTime ?? '',
            endTime: data.endTime ?? '',
            participants: data.participants ?? [],
            status: data.status ?? 'pending',
            transcript: data.transcript ?? '',
            summary: data.summary ?? '',
            actionItems: data.actionItems ?? [],
            createdAt: data.created_at ?? data.createdAt ?? '',
            updatedAt: data.updated_at ?? data.updatedAt ?? '',
          });
        } else {
          setMeeting(getMockMeeting());
        }
      } catch {
        // 后端没接上，兜底 mock
        setMeeting(getMockMeeting());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  const getUserName = (userId: string) => {
    return mockUsers.find((u) => u.id === userId)?.name || userId;
  };

  const getStatusConfig = (status: MeetingStatus) => {
    // 兼容后端枚举（preparing/active/closed）与旧 mock（pending/ongoing/ended）
    const config: Record<string, { color: string; text: string }> = {
      preparing: { color: 'default',    text: '准备中' },
      pending:   { color: 'default',    text: '准备中' },
      active:    { color: 'processing', text: '进行中' },
      ongoing:   { color: 'processing', text: '进行中' },
      closed:    { color: 'success',    text: '已结束' },
      ended:     { color: 'success',    text: '已结束' },
    };
    return config[status] ?? { color: 'default', text: status };
  };

  const getActionStatusConfig = (status: ActionItem['status']) => {
    const config = {
      todo: { color: 'default', text: t('meeting.statusPending'), icon: <ClockCircleOutlined /> },
      in_progress: { color: 'processing', text: t('meeting.statusInProgress'), icon: <SyncOutlined spin /> },
      done: { color: 'success', text: t('meeting.statusDone'), icon: <CheckCircleOutlined /> },
    };
    return config[status];
  };

  const handleStatusChange = (actionId: string, newStatus: ActionItem['status']) => {
    if (!meeting) return;
    setMeeting({
      ...meeting,
      actionItems: meeting.actionItems?.map((item) =>
        item.id === actionId ? { ...item, status: newStatus } : item
      ),
    });
    message.success(t('common.success'));
  };

  /** 生成/重置会议邀请码（主持人） */
  const handleGenerateInvite = async () => {
    const mid = Number(id ?? 0);
    if (!mid) {
      message.error('会议 ID 缺失');
      return;
    }
    setInviteLoading(true);
    try {
      const data = await meetingInviteApi.generate(mid, 7);
      setInviteCode(data);
      setInviteModalOpen(true);
    } catch (e: any) {
      message.error(e?.message ?? '生成邀请码失败');
    } finally {
      setInviteLoading(false);
    }
  };

  /** 复制邀请码到剪贴板 */
  const handleCopyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode.invite_code);
      message.success('邀请码已复制');
    } catch {
      message.error('复制失败，请手动选中');
    }
  };

  const handleDeleteAction = (actionId: string) => {
    if (!meeting) return;
    setMeeting({
      ...meeting,
      actionItems: meeting.actionItems?.filter((item) => item.id !== actionId),
    });
    message.success(t('common.success'));
  };

  const handleAddAction = async () => {
    try {
      const values = await form.validateFields();
      const users = getMockUsers();
      const newAction: ActionItem = {
        id: generateId('action'),
        description: values.description,
        assignee: values.assignee,
        assigneeName: users.find(u => u.id === values.assignee)?.name || values.assignee,
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        status: 'todo',
      };

      setMeeting({
        ...meeting!,
        actionItems: [...(meeting?.actionItems || []), newAction],
      });

      message.success(t('common.success'));
      setIsActionModalOpen(false);
      form.resetFields();
    } catch {
      // Form validation failed
    }
  };

  const handleUpload = async (file: File) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(file.type)) {
      message.error(t('meeting.audioFormatError'));
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(() => {
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploading(false);
      setTranscribing(true);
      message.success(t('meeting.uploadSuccess'));

      setTimeout(() => {
        setTranscribing(false);
        setMeeting({
          ...meeting!,
          transcript: getMockMeeting().transcript,
        });
        message.success(t('meeting.transcribeComplete'));
      }, 2000);
    }, 2000);

    setIsUploadModalOpen(false);
    return false;
  };

  const handleGenerateSummary = () => {
    setGenerating(true);
    message.loading(t('meeting.generatingSummary'), 0);

    setTimeout(() => {
      setGenerating(false);
      message.destroy();
      const mockData = getMockMeeting();
      setMeeting({
        ...meeting!,
        summary: mockData.summary,
        actionItems: mockData.actionItems,
      });
      message.success(t('meeting.summaryGenerated'));
    }, 3000);
  };

  const handlePushWebhook = () => {
    setPushing(true);
    message.loading(t('meeting.pushingToDingtalk'), 0);

    setTimeout(() => {
      setPushing(false);
      message.destroy();
      message.success(t('meeting.pushSuccess'));
    }, 2000);
  };

  const handleSaveSummary = () => {
    setMeeting({ ...meeting!, summary: editedSummary });
    setIsEditMode(false);
    message.success(t('common.success'));
  };

  /**
   * 派发行动项到审批流（闭环：会议行动项 → 审批模块 → 回写工单）
   * 步骤：
   *   1. 创建会议工单（useMeetingWorkItemStore），状态 assigned
   *   2. 行动项状态切换为 in_progress
   *   3. 跳转 /approval，并把 workItemId 放进 location.state
   *   4. Approval 页面 useEffect 读取 workItemId，弹出对应工单详情
   */
  const handleDispatchToApproval = (item: ActionItem) => {
    if (!meeting) return;
    const workItem = createWorkItem({
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      title: item.description,
      text: `会议：${meeting.title}\n负责人：${item.assigneeName}\n截止：${item.dueDate}\n\n纪要摘要：${meeting.summary || '（无）'}`,
      assignee: item.assigneeName,
      dueDate: item.dueDate,
      priority: 'high',
      meetingSegmentSnippet: item.description.slice(0, 80),
    });

    // 标记行动项已派发
    handleStatusChange(item.id, 'in_progress');
    message.success(`已派发至审批流：「${item.description}」`);

    // 跳转审批模块（带上 workItemId，触发 Approval 页联动逻辑）
    setTimeout(() => {
      navigate('/approval', { state: { workItemId: workItem.id } });
    }, 600);
  };

  const statusDropdownItems: MenuProps['items'] = [
    { key: 'todo', label: t('meeting.statusPending'), icon: <ClockCircleOutlined /> },
    { key: 'in_progress', label: t('meeting.statusInProgress'), icon: <SyncOutlined /> },
    { key: 'done', label: t('meeting.statusDone'), icon: <CheckCircleOutlined /> },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" indicator={<LoadingOutlined spin />} tip={t('common.loading')} />
      </div>
    );
  }

  if (!meeting) {
    return <Empty description={t('meeting.notFound')} />;
  }

  const statusConfig = getStatusConfig(meeting.status);

  const tabItems = [
    {
      key: 'summary',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {t('meeting.minutes')}
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          {!meeting.summary ? (
            <Card>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <p style={{ color: '#999', marginBottom: 16 }}>{t('meeting.noSummary')}</p>
                    <Button
                      type="primary"
                      icon={<FileTextOutlined />}
                      onClick={handleGenerateSummary}
                      loading={generating}
                    >
                      {generating ? t('meeting.generating') : t('meeting.generateSummary')}
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <>
              {isEditMode ? (
                <Card
                  title={t('meeting.editSummary')}
                  extra={
                    <Space>
                      <Button onClick={() => setIsEditMode(false)}>{t('common.cancel')}</Button>
                      <Button type="primary" onClick={handleSaveSummary}>
                        {t('common.save')}
                      </Button>
                    </Space>
                  }
                >
                  <TextArea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    rows={20}
                    placeholder={t('meeting.summaryPlaceholder')}
                  />
                </Card>
              ) : (
                <>
                  <Card
                    title={t('meeting.meetingSummary')}
                    extra={
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditedSummary(meeting.summary || '');
                            setIsEditMode(true);
                          }}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          icon={<FileTextOutlined />}
                          onClick={handleGenerateSummary}
                          loading={generating}
                        >
                          {t('meeting.regenerate')}
                        </Button>
                      </Space>
                    }
                  >
                    <div className="markdown-content">
                      <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                    </div>
                  </Card>

                  {meeting.transcript && (
                    <Card title={t('meeting.originalTranscript')} style={{ marginTop: 16 }}>
                      <Alert
                        message={t('meeting.originalTranscript')}
                        description={
                          <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>
                            {meeting.transcript}
                          </Paragraph>
                        }
                        type="info"
                        showIcon
                      />
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: (
        <span>
          <CheckCircleOutlined style={{ marginRight: 8 }} />
          {t('meeting.actionItems')} ({meeting.actionItems?.length || 0})
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          {/* mock data */}
          <TaskPipeline
            meetingTitle={meeting.title}
            actionItems={meeting.actionItems || []}
            onPushWebhook={() => handlePushWebhook()}
            pushing={pushing}
          />

          {/* mock data */}
          <Card
            title={t('meeting.actionItemsList')}
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsActionModalOpen(true)}>
                {t('meeting.addAction')}
              </Button>
            }
            style={{ marginTop: 16 }}
          >
            {(!meeting.actionItems || meeting.actionItems.length === 0) ? (
              <Empty description={t('meeting.noActions')} />
            ) : (
              <div>
                {meeting.actionItems.map((item) => {
                  const statusConfig = getActionStatusConfig(item.status);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <Avatar style={{ backgroundColor: '#1890ff', marginRight: 12 }}>
                          {item.assigneeName?.charAt(0) || 'U'}
                        </Avatar>
                        <div>
                          <Text>{item.description}</Text>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {t('meeting.assignee')}: {item.assigneeName}  |  {t('meeting.dueDate')}: {item.dueDate}
                            </Text>
                          </div>
                        </div>
                      </div>
                      <Space>
                        <Dropdown
                          menu={{
                            items: statusDropdownItems,
                            onClick: ({ key }) => handleStatusChange(item.id, key as ActionItem['status']),
                          }}
                          trigger={['click']}
                        >
                          <Tag
                            color={statusConfig.color}
                            icon={statusConfig.icon}
                            style={{ cursor: 'pointer' }}
                          >
                            {statusConfig.text}
                          </Tag>
                        </Dropdown>
                        {/* 派发到审批流（闭环：会议行动项 → 审批模块） */}
                        {item.status === 'todo' && (
                          <Tooltip title="派发到审批流：自动创建对应审批单，关联会议纪要">
                            <Button
                              type="primary"
                              size="small"
                              ghost
                              icon={<SendOutlined />}
                              onClick={() => handleDispatchToApproval(item)}
                              style={{ borderColor: '#0F2B5B', color: '#0F2B5B' }}
                            >
                              派发
                            </Button>
                          </Tooltip>
                        )}
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteAction(item.id)}
                        />
                      </Space>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* mock data*/}
          <Card style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handlePushWebhook}
                loading={pushing}
                disabled={!meeting.actionItems?.length}
              >
                {t('meeting.pushToDingtalk')}
              </Button>
              <Text type="secondary">{t('meeting.pushDescription')}</Text>
            </Space>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 16 }}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/meeting')}>
              {t('meeting.goBack')}
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {meeting.title}
            </Title>
            <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
          </Space>

          <Descriptions size="small" column={3}>
            <Descriptions.Item label={t('meeting.startTime')}>
              {formatDate(meeting.startTime, 'YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('meeting.endTime')}>
              {formatDate(meeting.endTime, 'YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('meeting.participants')}>
              <Avatar.Group size="small" max={{ count: 5 }}>
                {meeting.participants.map((userId) => (
                  <Avatar key={userId} style={{ backgroundColor: '#1890ff' }}>
                    {getUserName(userId).charAt(0)}
                  </Avatar>
                ))}
              </Avatar.Group>
            </Descriptions.Item>
          </Descriptions>

          {/* ===== 会议邀请码（生成 + 加入） =====
              仅「准备中 preparing」/「进行中 active」会议才显示：
              已结束的会议不需要再邀请人进来。 */}
          {(meeting.status === 'preparing' || meeting.status === 'active') && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'linear-gradient(90deg, #e6f7ff 0%, #f0f5ff 100%)', border: '1px solid #91d5ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space size={12}>
              <Tag color="cyan" style={{ fontSize: 12, margin: 0 }}>v1.2</Tag>
              <Text style={{ fontSize: 13, color: '#0050b3' }}>
                通过邀请码快速召集参会人，无需逐个添加
              </Text>
            </Space>
            <Space size={8}>
              <Button
                type="primary"
                size="small"
                icon={<KeyOutlined />}
                loading={inviteLoading}
                onClick={handleGenerateInvite}
              >
                生成邀请码
              </Button>
            </Space>
          </div>
          )}

          {/* ===== 会议生命周期时间线（嵌入顶栏） ===== */}
          <div style={{ background: '#fafafa', padding: '12px 16px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
            <Space style={{ marginBottom: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                会议生命周期
              </Text>
              {meeting.status === 'ended' && (
                <Tag color="blue" style={{ fontSize: 11 }}>
                  已归档 {((meeting.actionItems?.length ?? 0)) > 0 && `· ${(meeting.actionItems ?? []).filter(a => a.status === 'done').length}/${(meeting.actionItems ?? []).length} 行动项已完成`}
                </Tag>
              )}
            </Space>
            <Steps
              size="small"
              current={
                meeting.status === 'scheduled' ? 0 :
                meeting.status === 'ongoing' ? 1 :
                meeting.status === 'ended' ? ((meeting.actionItems?.length ?? 0) > 0 ? 2 : 3) : 3
              }
              status={meeting.status === 'ongoing' ? 'process' : 'finish'}
              items={[
                {
                  title: '创建会议',
                  description: formatDate(meeting.createdAt, 'MM-DD HH:mm'),
                  icon: <PlusOutlined />,
                },
                {
                  title: '会议进行',
                  description: meeting.status === 'ongoing' ? '进行中…' : formatDate(meeting.startTime, 'MM-DD HH:mm'),
                  icon: meeting.status === 'ongoing' ? <LoadingOutlined /> : <ClockCircleOutlined />,
                },
                {
                  title: 'AI 生成纪要',
                  description: meeting.summary ? '已生成' : '待生成',
                  icon: <FileTextOutlined />,
                },
                {
                  title: '行动项派发',
                  description: ((meeting.actionItems?.length ?? 0)) > 0
                    ? `${(meeting.actionItems ?? []).filter(a => a.status === 'done').length}/${(meeting.actionItems ?? []).length} 已完成`
                    : '无行动项',
                  icon: <SendOutlined />,
                },
              ]}
            />
          </div>

          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setIsUploadModalOpen(true)}>
              {t('meeting.uploadAudio')}
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={handleGenerateSummary}
              loading={generating}
            >
              {t('meeting.generateSummary')}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: t('meeting.exportPDF'),
                  content: t('meeting.exportPDFTip'),
                  okText: t('common.confirm'),
                  cancelText: t('common.cancel'),
                  onOk: () => {
                    const content = `# ${meeting.title}\n\n## ${t('meeting.summary')}\n\n${meeting.summary || ''}\n\n## ${t('meeting.transcript')}\n\n${meeting.transcript || ''}`;
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${meeting.title}.txt`;
                    link.click();
                    URL.revokeObjectURL(url);
                    message.success(t('meeting.exportSuccess'));
                  },
                });
              }}
            >
              {t('meeting.exportPDF')}
            </Button>
          </Space>

          {/* mock data/mock data */}
          {(uploading || transcribing || generating) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {uploading && (
                <Card size="small" style={{ borderColor: '#1890ff', borderLeft: '4px solid #1890ff', background: '#f0f7ff' }}>
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Space>
                      <LoadingOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                      <Text strong style={{ color: '#1890ff' }}>{t('meeting.uploading')}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('meeting.uploadingTip')}</Text>
                    </Space>
                    <Progress
                      percent={uploadProgress}
                      status="active"
                      strokeColor="#1890ff"
                      size="small"
                      format={(p) => <Text type="secondary" style={{ fontSize: 12 }}>{p}%</Text>}
                    />
                  </Space>
                </Card>
              )}

              {transcribing && (
                <Card size="small" style={{ borderColor: '#22A775', borderLeft: '4px solid #22A775', background: 'rgba(34, 167, 117, 0.03)' }}>
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Space>
                      <SyncOutlined spin style={{ color: '#22A775', fontSize: 16 }} />
                      <Text strong style={{ color: '#22A775' }}>{t('meeting.transcribing')}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('meeting.transcribingTip')}</Text>
                    </Space>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40, padding: '4px 0' }}>
                      {audioVisualizerBars.map((barHeight, i) => (
                        <div
                          key={i}
                          style={{
                            width: 5,
                            height: Math.max(4, barHeight * 36),
                            background: '#22A775',
                            borderRadius: 2,
                            transition: 'height 0.08s ease',
                          }}
                        />
                      ))}
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{t('meeting.transcribing')}</Text>
                    </div>
                  </Space>
                </Card>
              )}

              {generating && (
                <Card size="small" style={{ borderColor: '#C9A459', borderLeft: '4px solid #C9A459', background: 'rgba(201, 164, 89, 0.03)' }}>
                  <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                    <Space>
                      <SyncOutlined spin style={{ color: '#C9A459', fontSize: 16 }} />
                      <Text strong style={{ color: '#C9A459' }}>{t('meeting.generatingSummary')}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('meeting.generatingSummaryTip')}</Text>
                    </Space>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[
                        t('meeting.stepRecognize'),
                        t('meeting.stepSummarize'),
                        t('meeting.stepExtract'),
                        t('meeting.stepFormat'),
                      ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: '#C9A459',
                            }}
                          />
                          <Text type="secondary" style={{ fontSize: 11 }}>{step}</Text>
                        </div>
                      ))}
                    </div>
                  </Space>
                </Card>
              )}
            </div>
          )}
        </Space>
      </Card>

      <Card>
        <Tabs selectedKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      <Modal
        title={t('meeting.uploadAudio')}
        open={isUploadModalOpen}
        onCancel={() => setIsUploadModalOpen(false)}
        footer={null}
      >
        <div
          style={{
            border: '2px dashed #d9d9d9',
            borderRadius: 8,
            padding: 48,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          <UploadOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <div>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => document.getElementById('audio-input')?.click()}>
              {t('meeting.selectAudio')}
            </Button>
            <input
              id="audio-input"
              type="file"
              accept=".mp3,.wav,.m4a"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            {t('meeting.audioFormatTip')}
          </Text>
        </div>
      </Modal>

      <Modal
        title={t('meeting.addAction')}
        open={isActionModalOpen}
        onOk={handleAddAction}
        onCancel={() => {
          setIsActionModalOpen(false);
          form.resetFields();
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="description"
            label={t('meeting.actionDescription')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <TextArea rows={3} placeholder={t('meeting.actionDescriptionPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="assignee"
            label={t('meeting.assignee')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select placeholder={t('meeting.selectAssignee')}>
              {mockUsers.map((user) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dueDate"
            label={t('meeting.dueDate')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .markdown-content h1 { font-size: 1.5em; margin-top: 1em; margin-bottom: 0.5em; }
        .markdown-content h2 { font-size: 1.25em; margin-top: 1em; margin-bottom: 0.5em; }
        .markdown-content h3 { font-size: 1.1em; margin-top: 1em; margin-bottom: 0.5em; }
        .markdown-content ul, .markdown-content ol { padding-left: 1.5em; }
        .markdown-content li { margin: 0.5em 0; }
        .markdown-content p { margin: 0.5em 0; }
        .markdown-content code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px; }
        .markdown-content blockquote { border-left: 3px solid #d9d9d9; padding-left: 1em; color: #666; }
      `}</style>

      {/* ===== 生成邀请码弹窗 ===== */}
      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#1890ff' }} />
            <span>会议邀请码</span>
          </Space>
        }
        open={inviteModalOpen}
        onCancel={() => setInviteModalOpen(false)}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopyInvite}>
            复制邀请码
          </Button>,
          <Button key="close" type="primary" onClick={() => setInviteModalOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        {inviteCode && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>会议</Text>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{inviteCode.meeting_title}</div>
            </div>
            <div style={{ background: '#f5f5f5', padding: '16px 20px', borderRadius: 8, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>邀请码</Text>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 4, color: '#1890ff' }}>
                {inviteCode.invite_code}
              </div>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              把这个邀请码发给参会人，他们在前端"用邀请码加入"即可一键参会。
              {inviteCode.expires_at && (
                <> 有效期至 {new Date(inviteCode.expires_at).toLocaleString('zh-CN')}。</>
              )}
            </Text>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default MeetingDetail;
