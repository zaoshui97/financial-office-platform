import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Space,
  Typography,
  Tag,
  Button,
  Avatar,
  Tabs,
  Badge,
  Empty,
  App,
  Input,
  Statistic,
  Divider,
  Modal,
  Timeline,
  Tooltip,
  Alert,
  List,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  SearchOutlined,
  BellOutlined,
  CalendarOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
  DollarOutlined,
  TeamOutlined,
  EyeOutlined,
  RobotOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useApprovalDraftStore, type ApprovalDraft } from '@/store/approvalDraftStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useMeetingWorkItemStore, type MeetingWorkItem } from '@/store/meetingWorkItemStore';
import { checkCompliance } from '@/services/sandbox/sandboxApiContract';
import { Can } from '@/components/Can';

const { Title, Text, Paragraph } = Typography;

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'in_progress';
type ApprovalPriority = 'urgent' | 'high' | 'normal' | 'low';
type ApprovalType = 'reimbursement' | 'contract' | 'seal' | 'document' | 'travel' | 'procurement' | 'budget';

interface ApprovalItem {
  id: string;
  title: string;
  type: ApprovalType;
  applicant: string;
  applicantAvatar?: string;
  department: string;
  amount?: number;
  submittedAt: string;
  dueDate: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  description: string;
  attachments?: string[];
  currentApprover: string;
  step: number;
  totalSteps: number;
  aiPrecheck?: {
    passed: boolean;
    warnings: string[];
    suggestions: string[];
  };
  history: Array<{
    operator: string;
    action: string;
    comment?: string;
    time: string;
  }>;
}

// 类型枚举 → 图标映射
const TYPE_META: Record<ApprovalType, { color: string; icon: React.ReactNode }> = {
  reimbursement: { color: '#fa8c16', icon: <DollarOutlined style={{ color: '#fa8c16' }} /> },
  contract: { color: '#0F2B5B', icon: <FileTextOutlined style={{ color: '#0F2B5B' }} /> },
  seal: { color: '#22A775', icon: <SafetyCertificateOutlined style={{ color: '#22A775' }} /> },
  document: { color: '#1890ff', icon: <AuditOutlined style={{ color: '#1890ff' }} /> },
  travel: { color: '#C9A459', icon: <RocketOutlined style={{ color: '#C9A459' }} /> },
  procurement: { color: '#722ED1', icon: <DollarOutlined style={{ color: '#722ED1' }} /> },
  budget: { color: '#13C2C2', icon: <DollarOutlined style={{ color: '#13C2C2' }} /> },
};

// Mock 数据（类型改为英文枚举）
const MOCK_APPROVALS: ApprovalItem[] = [
  {
    id: '1',
    title: '2024 Q4 差旅费报销',
    type: 'reimbursement',
    applicant: '张三',
    department: '技术部',
    amount: 12580,
    submittedAt: '2026-09-08 09:23',
    dueDate: '2026-09-10',
    status: 'pending',
    priority: 'urgent',
    description:
      '客户拜访差旅费报销，包含北京-上海往返机票、住宿3晚、餐饮、市内交通。票据齐全，已扫描上传。',
    attachments: ['机票.pdf', '酒店发票.pdf', '出租车票.zip'],
    currentApprover: '我',
    step: 2,
    totalSteps: 3,
    aiPrecheck: {
      passed: false,
      warnings: ['餐饮费用超出标准 280 元', '出租车票中有 3 张连号，需核实'],
      suggestions: [
        '建议扣除超标部分，最终金额 12300 元',
        '已核对住宿标准符合差旅政策',
      ],
    },
    history: [
      { operator: '张三', action: '提交申请', time: '2026-09-08 09:23' },
      { operator: '李四', action: '部门主管初审通过', comment: '票据齐全，情况属实', time: '2026-09-08 14:15' },
    ],
  },
  {
    id: '2',
    title: '某某基金销售合同 V2.1',
    type: 'contract',
    applicant: '王五',
    department: '合规部',
    submittedAt: '2026-09-07 16:42',
    dueDate: '2026-09-09',
    status: 'pending',
    priority: 'urgent',
    description:
      '与某某基金签订的销售合作协议 V2.1 版本，相比 V2.0 调整了分成比例（从 30% 提升至 35%）和结算周期（从月结改为季结）。',
    attachments: ['销售合同V2.1.docx', '对比说明.docx'],
    currentApprover: '我',
    step: 3,
    totalSteps: 4,
    aiPrecheck: {
      passed: false,
      warnings: [
        '分成比例从 30% 提升至 35%，超出同类合同平均水平',
        '结算周期延长可能增加回款风险',
      ],
      suggestions: [
        '建议法务部门对分成条款进行专项审查',
        '建议附加回款保障条款',
      ],
    },
    history: [
      { operator: '王五', action: '提交申请', time: '2026-09-07 16:42' },
      { operator: '李四', action: '部门主管审核', time: '2026-09-08 10:30' },
      { operator: '赵六', action: '法务初审', comment: '合同条款已审核，技术上合规', time: '2026-09-08 15:20' },
    ],
  },
  {
    id: '3',
    title: '2026 年第三季度预算调整',
    type: 'budget',
    applicant: '李四',
    department: '财务部',
    amount: 580000,
    submittedAt: '2026-09-06 11:15',
    dueDate: '2026-09-12',
    status: 'in_progress',
    priority: 'high',
    description:
      'Q3 预算调整申请：因新产品上线，市场推广费用超预算 58 万，建议从研发备用金中调拨。',
    currentApprover: 'CFO',
    step: 1,
    totalSteps: 3,
    aiPrecheck: {
      passed: true,
      warnings: [],
      suggestions: [
        '调拨金额在备用金范围内（30%）',
        '已通过财务系统自动校验',
      ],
    },
    history: [
      { operator: '李四', action: '提交申请', time: '2026-09-06 11:15' },
    ],
  },
  {
    id: '4',
    title: '研发设备采购申请 - 显卡服务器',
    type: 'procurement',
    applicant: '赵六',
    department: '技术部',
    amount: 230000,
    submittedAt: '2026-09-05 14:30',
    dueDate: '2026-09-08',
    status: 'rejected',
    priority: 'normal',
    description:
      '采购 2 台 NVIDIA A100 显卡服务器，用于大模型训练。已比价 3 家供应商，建议采购某品牌。',
    currentApprover: 'CEO',
    step: 1,
    totalSteps: 3,
    aiPrecheck: {
      passed: false,
      warnings: [
        '单笔采购超过 20 万，建议拆分或走招标流程',
        '供应商选择缺少完整评估报告',
      ],
      suggestions: [
        '建议补全供应商评估报告',
        '建议拆分采购订单以符合内控要求',
      ],
    },
    history: [
      { operator: '赵六', action: '提交申请', time: '2026-09-05 14:30' },
      { operator: '我', action: '已驳回', comment: '请补充供应商评估报告，并拆分采购订单', time: '2026-09-07 10:15' },
    ],
  },
  {
    id: '5',
    title: '上海客户拜访出差申请',
    type: 'travel',
    applicant: '钱七',
    department: '销售部',
    submittedAt: '2026-09-08 08:00',
    dueDate: '2026-09-11',
    status: 'pending',
    priority: 'normal',
    description:
      '拜访上海某某基金客户，沟通 Q4 合作方案。出差时间 9 月 11 日至 9 月 13 日，共 3 天。',
    currentApprover: '销售总监',
    step: 1,
    totalSteps: 2,
    aiPrecheck: {
      passed: true,
      warnings: [],
      suggestions: ['出差标准符合公司政策', '建议提前预定机票可享折扣'],
    },
    history: [
      { operator: '钱七', action: '提交申请', time: '2026-09-08 08:00' },
    ],
  },
  {
    id: '6',
    title: '新产品发布会宣传物料用印',
    type: 'seal',
    applicant: '孙八',
    department: '市场部',
    submittedAt: '2026-09-07 17:30',
    dueDate: '2026-09-10',
    status: 'approved',
    priority: 'high',
    description:
      '新产品发布会宣传物料需加盖公司公章：海报 50 张、宣传册 200 本、邀请函 100 份。',
    currentApprover: '已完成',
    step: 3,
    totalSteps: 3,
    history: [
      { operator: '孙八', action: '提交申请', time: '2026-09-07 17:30' },
      { operator: '市场总监', action: '审核通过', time: '2026-09-08 09:15' },
      { operator: '我', action: '已通过', comment: '同意', time: '2026-09-08 16:20' },
    ],
  },
  {
    id: '7',
    title: '内部通知发文：关于 2026 国庆放假安排',
    type: 'document',
    applicant: '行政部',
    department: '行政部',
    submittedAt: '2026-09-08 10:00',
    dueDate: '2026-09-15',
    status: 'pending',
    priority: 'low',
    description:
      '根据国家法定节假日规定，结合公司实际情况，制定 2026 年国庆放假安排。',
    currentApprover: 'CEO',
    step: 1,
    totalSteps: 2,
    aiPrecheck: {
      passed: true,
      warnings: [],
      suggestions: ['内容格式符合公司发文规范', '已与去年放假安排对比一致'],
    },
    history: [
      { operator: '行政部', action: '提交申请', time: '2026-09-08 10:00' },
    ],
  },
];

const Approval: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const location = useLocation();
  const { consumeDraft, setApprovalResult } = useApprovalDraftStore();
  const { addNotification } = useNotificationStore();
  const meetingWorkItems = useMeetingWorkItemStore((s) => s.items);
  const meetingWorkItemSetStatus = useMeetingWorkItemStore((s) => s.setStatus);
  const [selectedTab, setSelectedTab] = useState<string>('pending');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [detailItem, setDetailItem] = useState<ApprovalItem | null>(null);
  const [approvalList, setApprovalList] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [sandboxDraft, setSandboxDraft] = useState<ApprovalDraft | null>(null);
  // 业务联动：会议生成待办 → 工单/审批 一键跳转带来的会议工单
  const [meetingWorkItem, setMeetingWorkItem] = useState<MeetingWorkItem | null>(null);

  // 消费 Sandbox 跳转带来的草稿 + 消费会议跳转带来的会议工单
  useEffect(() => {
    const draft = consumeDraft();
    if (draft) {
      setSandboxDraft(draft);
    }

    // 来自会议派单的 workItemId
    const locState = (location.state ?? {}) as { workItemId?: string };
    if (locState.workItemId) {
      const wi = meetingWorkItems.find((w) => w.id === locState.workItemId);
      if (wi) {
        setMeetingWorkItem(wi);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      pending: approvalList.filter((i) => i.status === 'pending').length,
      approved: approvalList.filter((i) => i.status === 'approved').length,
      rejected: approvalList.filter((i) => i.status === 'rejected').length,
      inProgress: approvalList.filter((i) => i.status === 'in_progress').length,
      overdue: approvalList.filter(
        (i) => i.status === 'pending' && new Date(i.dueDate) < new Date()
      ).length,
    };
  }, [approvalList]);

  const filteredList = useMemo(() => {
    let list = approvalList;
    if (selectedTab !== 'all') {
      list = list.filter((i) => i.status === selectedTab);
    }
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(kw) ||
          i.applicant.toLowerCase().includes(kw) ||
          i.type.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [approvalList, selectedTab, searchKeyword]);

  // 通过（带备注输入）
  const handleApprove = (id: string) => {
    modal.confirm({
      title: t('approval.approveModal.title'),
      icon: <CheckCircleOutlined style={{ color: '#22A775' }} />,
      content: (
        <Input.TextArea
          id="approval-comment-input"
          placeholder={t('approval.approveModal.commentPlaceholder')}
          rows={2}
          style={{ marginTop: 12 }}
        />
      ),
      okText: t('approval.action.approve'),
      cancelText: t('approval.action.cancel'),
      onOk: () => {
        const comment = (document.getElementById('approval-comment-input') as HTMLTextAreaElement)?.value || t('approval.approveModal.commentPlaceholder');
        setApprovalList((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'approved' as ApprovalStatus,
                  history: [
                    ...item.history,
                    {
                      operator: t('approval.detail.applicant'),
                      action: t('approval.action.approved') || '已通过',
                      comment,
                      time: new Date().toLocaleString(),
                    },
                  ],
                }
              : item
          )
        );
        message.success(t('approval.action.approved'));
        setDetailItem(null);
      },
    });
  };

  // 驳回
  const handleReject = (id: string) => {
    modal.confirm({
      title: t('approval.rejectModal.title'),
      content: t('approval.rejectModal.content'),
      okText: t('approval.action.reject'),
      okType: 'danger',
      cancelText: t('approval.action.cancel'),
      onOk: () => {
        setApprovalList((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'rejected' as ApprovalStatus,
                  history: [
                    ...item.history,
                    {
                      operator: t('approval.detail.applicant'),
                      action: t('approval.action.rejected') || '已驳回',
                      comment: '',
                      time: new Date().toLocaleString(),
                    },
                  ],
                }
              : item
          )
        );
        message.info(t('approval.action.rejected'));
        setDetailItem(null);
      },
    });
  };

  // 催办（接入通知中心）
  const handleUrge = (id: string) => {
    const item = approvalList.find((i) => i.id === id);
    message.loading({ content: t('approval.action.urgeLoading'), duration: 1.5 });
    setTimeout(() => {
      if (item) {
        addNotification({
          type: 'urgent',
          title: t('approval.action.urge'),
          content: `审批「${item.title}」催办通知已发送`,
          timestamp: new Date().toISOString(),
        });
      }
      message.success(t('approval.action.urgeSuccess'));
    }, 1500);
  };

  const getPriorityMeta = (priority: ApprovalPriority) => {
    return {
      color:
        priority === 'urgent'
          ? '#D64045'
          : priority === 'high'
          ? '#fa8c16'
          : priority === 'normal'
          ? '#1890ff'
          : '#999',
      bg:
        priority === 'urgent'
          ? 'rgba(214, 64, 69, 0.1)'
          : priority === 'high'
          ? 'rgba(250, 140, 22, 0.1)'
          : priority === 'normal'
          ? 'rgba(24, 144, 255, 0.1)'
          : 'rgba(153, 153, 153, 0.1)',
    };
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <div style={{ padding: 24 }}>
      {/* 顶部统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                  {t('approval.stats.pending')}
                </Space>
              }
              value={stats.pending}
              valueStyle={{ color: '#fa8c16' }}
              suffix={
                stats.overdue > 0 && (
                  <Tag color="error" style={{ marginLeft: 8 }}>
                    {stats.overdue} {t('approval.stats.overdue')}
                  </Tag>
                )
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#22A775' }} />
                  {t('approval.stats.approved')}
                </Space>
              }
              value={stats.approved}
              valueStyle={{ color: '#22A775' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Space>
                  <ExclamationCircleOutlined style={{ color: '#D64045' }} />
                  {t('approval.stats.rejected')}
                </Space>
              }
              value={stats.rejected}
              valueStyle={{ color: '#D64045' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Space>
                  <BellOutlined style={{ color: '#1890ff' }} />
                  {t('approval.stats.inProgress')}
                </Space>
              }
              value={stats.inProgress}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 会议生成待办 → 一键跳转工单/审批（来自会议派单） */}
      {meetingWorkItem && (
        <Card
          style={{
            marginBottom: 16,
            border: '1px solid #22A775',
            background:
              meetingWorkItem.status === 'approved'
                ? '#ECFDF5'
                : meetingWorkItem.status === 'rejected'
                ? '#FEF2F2'
                : '#FFFBEB',
          }}
        >
          <Row gutter={16} align="middle">
            <Col flex="none">
              <AuditOutlined style={{ fontSize: 28, color: '#22A775' }} />
            </Col>
            <Col flex="auto">
              <Space direction="vertical" size={2}>
                <Space>
                  <Text strong style={{ fontSize: 15 }}>
                    {meetingWorkItem.title}
                  </Text>
                  <Tag color="blue">{t('approval.type.contract')}</Tag>
                  <Tag color="green" icon={<TeamOutlined />}>
                    {'会议派单工单'}
                  </Tag>
                  {meetingWorkItem.priority === 'high' && <Tag color="red">{'高优先级'}</Tag>}
                  {meetingWorkItem.status === 'approved' && <Tag color="success">{'已通过'}</Tag>}
                  {meetingWorkItem.status === 'rejected' && <Tag color="error">{'已驳回'}</Tag>}
                  {meetingWorkItem.status === 'pending' && <Tag color="warning">{'待处理'}</Tag>}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {'会议：'}
                  {meetingWorkItem.meetingTitle || meetingWorkItem.meetingId}
                  {' · 负责人：'}
                  {meetingWorkItem.assignee}
                  {' · 截止：'}
                  {meetingWorkItem.dueDate}
                </Text>
              </Space>
            </Col>
            <Col flex="none">
              {meetingWorkItem.status === 'pending' && (
                <>
                  <Can resource="workitem" action="approve">
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => {
                        meetingWorkItemSetStatus(meetingWorkItem.id, 'approved');
                        setMeetingWorkItem({ ...meetingWorkItem, status: 'approved' });
                        message.success(`工单「${meetingWorkItem.title}」已标记为已通过`);
                      }}
                    >
                      {'通过'}
                    </Button>
                  </Can>
                  <Can resource="workitem" action="reject">
                    <Button
                      size="small"
                      danger
                      icon={<CloseCircleOutlined />}
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        meetingWorkItemSetStatus(meetingWorkItem.id, 'rejected');
                        setMeetingWorkItem({ ...meetingWorkItem, status: 'rejected' });
                        message.info(`工单「${meetingWorkItem.title}」已驳回`);
                      }}
                    >
                      {'驳回'}
                    </Button>
                  </Can>
                </>
              )}
              <Button
                size="small"
                style={{ marginLeft: 8 }}
                onClick={() => setMeetingWorkItem(null)}
              >
                {'忽略'}
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* Sandbox 合规检测草稿横幅 */}
      {sandboxDraft && (
        <Card
          style={{
            marginBottom: 16,
            border: '1px solid #0F2B5B',
            background: sandboxDraft.sandboxResult.blocked
              ? '#FEF2F2'
              : sandboxDraft.sandboxResult.passed
              ? '#ECFDF5'
              : '#FFFBEB',
          }}
        >
          <Row gutter={16} align="middle">
            <Col flex="none">
              <SafetyCertificateOutlined style={{ fontSize: 28, color: '#0F2B5B' }} />
            </Col>
            <Col flex="auto">
              <Space direction="vertical" size={2}>
                <Space>
                  <Text strong style={{ fontSize: 15 }}>
                    {sandboxDraft.title}
                  </Text>
                  <Tag color="blue">{t(`approval.type.${sandboxDraft.approvalType}`)}</Tag>
                  <Tag
                    color={
                      sandboxDraft.sandboxResult.blocked
                        ? 'error'
                        : sandboxDraft.sandboxResult.passed
                        ? 'success'
                        : 'warning'
                    }
                    icon={<RobotOutlined />}
                  >
                    {sandboxDraft.sandboxResult.blocked
                      ? t('approval.sandbox.blocked')
                      : sandboxDraft.sandboxResult.passed
                      ? t('approval.sandbox.passed')
                      : t('approval.sandbox.risk')}
                  </Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('approval.sandbox.score')} {sandboxDraft.sandboxResult.score.toFixed(1)}/5 &nbsp;·&nbsp;
                  {t('approval.sandbox.riskCount', { n: sandboxDraft.sandboxResult.issues.length })} &nbsp;·&nbsp;
                  {t('approval.sandbox.ruleHit', { n: sandboxDraft.sandboxResult.totalHits })}
                  {sandboxDraft.sandboxResult.blocked && (
                    <Text strong style={{ color: '#DC2626', marginLeft: 8 }}>
                      {t('approval.sandbox.blockedWarning')}
                    </Text>
                  )}
                </Text>
              </Space>
            </Col>
            <Col flex="none">
              <Button
                size="small"
                onClick={() => {
                  const r = sandboxDraft.sandboxResult;
                  setDetailItem({
                    id: sandboxDraft.id,
                    title: sandboxDraft.title,
                    type: sandboxDraft.approvalType,
                    applicant: t('approval.detail.applicant'),
                    department: t('approval.detail.department'),
                    submittedAt: new Date(sandboxDraft.createdAt).toLocaleString(),
                    dueDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString(),
                    status: 'pending',
                    priority: r.blocked ? 'urgent' : r.passed ? 'normal' : 'high',
                    description: sandboxDraft.text.slice(0, 200) + (sandboxDraft.text.length > 200 ? '…' : ''),
                    currentApprover: t('approval.detail.currentApprover'),
                    step: 1,
                    totalSteps: 2,
                    aiPrecheck: {
                      passed: r.passed && !r.blocked,
                      warnings: r.issues.slice(0, 3).map((i) => `[${i.severity}] ${i.ruleName}: ${i.suggestion}`),
                      suggestions: r.issues.slice(0, 3).map((i) => i.suggestion),
                    },
                    history: [
                      { operator: t('approval.detail.applicant'), action: t('approval.sandbox.passed'), time: new Date(sandboxDraft.createdAt).toLocaleString() },
                    ],
                  });
                  setSandboxDraft(null);
                }}
              >
                {t('approval.sandbox.viewDetail')}
              </Button>
              <Button
                size="small"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  Modal.confirm({
                    title: t('approval.sandbox.confirmTitle'),
                    content: sandboxDraft.sandboxResult.blocked
                      ? t('approval.sandbox.confirmBlockedContent')
                      : t('approval.sandbox.confirmContent'),
                    okText: t('approval.sandbox.confirmSubmit'),
                    cancelText: t('approval.action.cancel'),
                    onOk: async () => {
                      // 1. 回写会议工单状态（如果此草稿关联了会议工单）
                      const syncResult = setApprovalResult(sandboxDraft.id, 'approved');
                      if (syncResult.synced) {
                        message.success(
                          `${t('approval.sandbox.submitted')} 会议工单「${sandboxDraft.title}」已同步标记为已通过`
                        );
                      } else {
                        message.success(t('approval.sandbox.submitted'));
                      }
                      setSandboxDraft(null);
                    },
                  });
                }}
              >
                {t('approval.sandbox.confirmSubmit')}
              </Button>
              <Button
                size="small"
                danger
                style={{ marginLeft: 8 }}
                onClick={() => {
                  Modal.confirm({
                    title: '驳回此审批',
                    content: '驳回后将回写到关联的会议工单（标记为 rejected），会议报告中将展示驳回状态。',
                    okText: '确认驳回',
                    cancelText: t('approval.action.cancel'),
                    okButtonProps: { danger: true },
                    onOk: () => {
                      const note = 'AI 预审驳回：' + (sandboxDraft.sandboxResult.issues[0]?.ruleName || '合规风险过高');
                      const syncResult = setApprovalResult(sandboxDraft.id, 'rejected', note);
                      if (syncResult.synced) {
                        message.success('已驳回，会议工单已同步标记为 rejected');
                      } else {
                        message.success('已驳回');
                      }
                      setSandboxDraft(null);
                    },
                  });
                }}
              >
                驳回
              </Button>
              <Button
                size="small"
                style={{ marginLeft: 8 }}
                onClick={() => setSandboxDraft(null)}
              >
                {t('approval.sandbox.ignore')}
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 主面板 */}
      <Card
        title={
          <Space>
            <AuditOutlined style={{ color: '#0F2B5B' }} />
            <span>{t('approval.title')}</span>
            <Tag color="blue">{t('approval.aiPrecheck')}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder={t('approval.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => message.success(t('approval.refreshed'))}
            >
              {t('approval.refresh')}
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={selectedTab}
          onChange={setSelectedTab}
          items={[
            {
              key: 'pending',
              label: (
                <span>
                  {t('approval.stats.pending')}
                  {stats.pending > 0 && (
                    <Badge count={stats.pending} style={{ marginLeft: 8 }} offset={[4, -2]} />
                  )}
                </span>
              ),
            },
            { key: 'in_progress', label: t('approval.stats.inProgress') },
            { key: 'approved', label: t('approval.stats.approved') },
            { key: 'rejected', label: t('approval.stats.rejected') },
            { key: 'all', label: '全部' },
          ]}
        />

        {filteredList.length === 0 ? (
          <Empty description={t('approval.noData')} style={{ padding: 40 }} />
        ) : (
          <div>
            {filteredList.map((item) => {
              const pMeta = getPriorityMeta(item.priority);
              const overdue = isOverdue(item.dueDate);
              const typeMeta = TYPE_META[item.type];
              return (
                <Card
                  key={item.id}
                  size="small"
                  style={{
                    marginBottom: 12,
                    borderLeft: `4px solid ${pMeta.color}`,
                    background: item.status === 'pending' ? '#FAFBFC' : 'white',
                  }}
                  hoverable
                >
                  <Row gutter={16} align="middle">
                    <Col flex="auto">
                      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                        {/* 标题行 */}
                        <Space>
                          {typeMeta.icon}
                          <Text strong style={{ fontSize: 15 }}>
                            {item.title}
                          </Text>
                          <Tag color="default">{t(`approval.type.${item.type}`)}</Tag>
                          <Tag
                            color={
                              item.priority === 'urgent'
                                ? 'error'
                                : item.priority === 'high'
                                ? 'warning'
                                : 'default'
                            }
                          >
                            {t('approval.priority.label', { level: t(`approval.priority.${item.priority}`) })}
                          </Tag>
                          {overdue && item.status === 'pending' && (
                            <Tag color="error" icon={<ExclamationCircleOutlined />}>
                              {t('approval.overdueTag')}
                            </Tag>
                          )}
                          {item.aiPrecheck && (
                            <Tooltip
                              title={
                                item.aiPrecheck.passed
                                  ? t('approval.aiCheckPassed')
                                  : t('approval.aiCheckWarning', { n: item.aiPrecheck.warnings.length })
                              }
                            >
                              <Tag
                                color={item.aiPrecheck.passed ? 'success' : 'warning'}
                                icon={<RobotOutlined />}
                              >
                                {t('approval.aiPrecheck')}
                              </Tag>
                            </Tooltip>
                          )}
                        </Space>

                        {/* 申请人信息 */}
                        <Space>
                          <Avatar size="small" icon={<UserOutlined />}>
                            {item.applicant.charAt(0)}
                          </Avatar>
                          <Text type="secondary">{item.applicant}</Text>
                          <Text type="secondary">·</Text>
                          <Text type="secondary">{item.department}</Text>
                          {item.amount && (
                            <>
                              <Text type="secondary">·</Text>
                              <Text type="secondary">{t('approval.detail.amount')}：</Text>
                              <Text strong style={{ color: '#D64045' }}>
                                ¥{item.amount.toLocaleString()}
                              </Text>
                            </>
                          )}
                        </Space>

                        {/* 时间信息 */}
                        <Space size="large">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <CalendarOutlined /> {t('approval.detail.submittedAt')} {item.submittedAt}
                          </Text>
                          <Text
                            type={overdue && item.status === 'pending' ? 'danger' : 'secondary'}
                            style={{ fontSize: 12 }}
                          >
                            <ClockCircleOutlined /> {t('approval.detail.dueDate')} {item.dueDate}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('approval.detail.process')}：{t('approval.detail.step', { current: item.step, total: item.totalSteps })}
                          </Text>
                        </Space>
                      </Space>
                    </Col>

                    {/* 操作按钮 */}
                    <Col>
                      <Space>
                        {item.status === 'pending' && (
                          <>
                            <Button
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              onClick={() => handleApprove(item.id)}
                            >
                              {t('approval.action.approve')}
                            </Button>
                            <Button
                              danger
                              icon={<CloseCircleOutlined />}
                              onClick={() => handleReject(item.id)}
                            >
                              {t('approval.action.reject')}
                            </Button>
                            <Button
                              icon={<BellOutlined />}
                              onClick={() => handleUrge(item.id)}
                            >
                              {t('approval.action.urge')}
                            </Button>
                          </>
                        )}
                        <Button
                          icon={<EyeOutlined />}
                          onClick={() => setDetailItem(item)}
                        >
                          {t('approval.action.view')}
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={t('approval.detail.title')}
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        footer={null}
        style={{ width: 720, maxWidth: 'calc(100vw - 32px)' }}
      >
        {detailItem && (
          <div>
            <Title level={4}>{detailItem.title}</Title>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="default">{t(`approval.type.${detailItem.type}`)}</Tag>
              <Tag
                color={
                  detailItem.priority === 'urgent'
                    ? 'error'
                    : detailItem.priority === 'high'
                    ? 'warning'
                    : 'default'
                }
              >
                {t('approval.priority.label', { level: t(`approval.priority.${detailItem.priority}`) })}
              </Tag>
            </Space>

            <Divider orientation="left" style={{ fontSize: 14 }}>
              {t('approval.detail.basicInfo')}
            </Divider>
            <Row gutter={[16, 12]}>
              <Col span={12}>
                <Text type="secondary">{t('approval.detail.applicant')}：</Text>
                <Text strong>{detailItem.applicant}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">{t('approval.detail.department')}：</Text>
                <Text>{detailItem.department}</Text>
              </Col>
              {detailItem.amount && (
                <Col span={12}>
                  <Text type="secondary">{t('approval.detail.amount')}：</Text>
                  <Text strong style={{ color: '#D64045', fontSize: 16 }}>
                    ¥{detailItem.amount.toLocaleString()}
                  </Text>
                </Col>
              )}
              <Col span={12}>
                <Text type="secondary">{t('approval.detail.submittedAt')}：</Text>
                <Text>{detailItem.submittedAt}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">{t('approval.detail.dueDate')}：</Text>
                <Text>{detailItem.dueDate}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">{t('approval.detail.currentApprover')}：</Text>
                <Text strong>{detailItem.currentApprover}</Text>
              </Col>
            </Row>

            {/* 附件列表 */}
            {detailItem.attachments && detailItem.attachments.length > 0 && (
              <>
                <Divider orientation="left" style={{ fontSize: 14 }}>
                  {t('approval.attachments')}
                </Divider>
                <List
                  size="small"
                  bordered
                  dataSource={detailItem.attachments}
                  renderItem={(file) => (
                    <List.Item style={{ padding: '4px 12px' }}>
                      <Space>
                        <PaperClipOutlined />
                        <Text>{file}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}

            <Divider orientation="left" style={{ fontSize: 14 }}>
              {t('approval.detail.description')}
            </Divider>
            <Paragraph>{detailItem.description}</Paragraph>

            {detailItem.aiPrecheck && (
              <>
                <Divider orientation="left" style={{ fontSize: 14 }}>
                  <Space>
                    <RobotOutlined style={{ color: '#1890ff' }} />
                    {t('approval.detail.aiPrecheck')}
                  </Space>
                </Divider>
                <Card
                  size="small"
                  style={{
                    background: detailItem.aiPrecheck.passed
                      ? 'rgba(34, 167, 117, 0.05)'
                      : 'rgba(250, 140, 22, 0.05)',
                    borderColor: detailItem.aiPrecheck.passed ? '#22A775' : '#fa8c16',
                  }}
                >
                  {detailItem.aiPrecheck.warnings.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ color: '#fa8c16' }}>
                        <ExclamationCircleOutlined /> {t('approval.detail.riskWarning')}：
                      </Text>
                      <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                        {detailItem.aiPrecheck.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detailItem.aiPrecheck.suggestions.length > 0 && (
                    <div>
                      <Text strong style={{ color: '#22A775' }}>
                        <CheckCircleOutlined /> {t('approval.detail.suggestion')}：
                      </Text>
                      <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                        {detailItem.aiPrecheck.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </>
            )}

            <Divider orientation="left" style={{ fontSize: 14 }}>
              {t('approval.detail.approvalRecord')}
            </Divider>
            <Timeline
              items={detailItem.history.map((h) => ({
                color:
                  h.action.includes('通过') || h.action.includes('同意') || h.action.toLowerCase().includes('approved')
                    ? 'green'
                    : h.action.includes('驳回') || h.action.includes('拒绝') || h.action.toLowerCase().includes('rejected')
                    ? 'red'
                    : 'blue',
                children: (
                  <div>
                    <Space>
                      <Text strong>{h.operator}</Text>
                      <Tag>{h.action}</Tag>
                    </Space>
                    {h.comment && (
                      <div>
                        <Text type="secondary">{t('approval.detail.comment')}：{h.comment}</Text>
                      </div>
                    )}
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {h.time}
                      </Text>
                    </div>
                  </div>
                ),
              }))}
            />

            {detailItem.status === 'pending' && (
              <>
                <Divider />
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setDetailItem(null)}>{t('approval.action.cancel')}</Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleReject(detailItem.id)}
                  >
                    {t('approval.action.reject')}
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleApprove(detailItem.id)}
                  >
                    {t('approval.action.approve')}
                  </Button>
                </Space>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Approval;
