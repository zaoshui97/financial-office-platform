import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Radio,
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
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useApprovalDraftStore, type ApprovalDraft } from '@/store/approvalDraftStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useMeetingWorkItemStore, type MeetingWorkItem } from '@/store/meetingWorkItemStore';
import { checkCompliance } from '@/services/sandbox/sandboxApiContract';
import { Can } from '@/components/Can';
import { approvalsApi, type Approval as BackendApproval, type ApprovalScope, type ApprovalStatus as BackendApprovalStatus } from '@/api/approvals';
import { attachmentsApi, type Attachment } from '@/api/attachments';
import { useUserStore } from '@/store/userStore';
import { userApi, getDisplayName, type UserInfo } from '@/api/users';
import AttachmentPreviewModal from '@/components/Approval/AttachmentPreviewModal';
import AIReviewCard from '@/components/Approval/AIReviewCard';

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
  /** AI 辅助审批建议：pass / review / reject */
  aiSuggestion?: 'pass' | 'review' | 'reject' | null;
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

// 适配：后端 Approval → UI ApprovalItem
function mapBackendToUI(a: BackendApproval): ApprovalItem {
  const statusMap: Record<BackendApprovalStatus, ApprovalStatus> = {
    draft: 'pending',
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    closed: 'approved', // 视作已完成
  };
  // type 映射（后端 4 种 → UI 7 种）
  const typeMap: Record<string, ApprovalType> = {
    reimburse: 'reimbursement',
    leave: 'document',         // UI 没有 leave 类型，用 document 占位
    seal: 'seal',
    general: 'document',
  };
  // 提交时间格式
  const submitted = a.created_at ? a.created_at.replace('T', ' ').slice(0, 16) : '';
  // 默认 7 天后到期
  const due = a.created_at
    ? a.created_at.slice(0, 10)
    : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  // 标题截断作为 description 摘要
  const desc = a.content.length > 200 ? a.content.slice(0, 200) + '…' : a.content;
  return {
    id: String(a.id),
    title: a.title || desc.split('\n')[0]?.slice(0, 60) || `审批 #${a.id}`,
    type: typeMap[a.type] || 'document',
    applicant: `用户#${a.user_id}`,
    department: '—',
    submittedAt: submitted,
    dueDate: due,
    status: statusMap[a.status] || 'pending',
    priority: a.sandbox_passed === false ? 'urgent' : 'normal',
    description: desc,
    currentApprover: a.approved_by ? `用户#${a.approved_by}` : '—',
    step: a.status === 'approved' || a.status === 'rejected' ? 2 : 1,
    totalSteps: 2,
    attachments: (a.attachment_ids || []).map((id) => `att:${id}`), // 详情页解析 att:{id}
    // AI 辅助审批：用 ai_suggestion (pass/review/reject) 替代 sandbox_passed
    aiSuggestion: a.ai_suggestion || null,
    aiPrecheck: a.ai_suggestion
      ? {
          passed: a.ai_suggestion === 'pass',
          warnings: a.ai_suggestion === 'reject'
            ? ['AI 建议驳回（高风险）']
            : a.ai_suggestion === 'review'
              ? ['AI 建议人工复核']
              : [],
          suggestions: a.ai_review?.overall?.summary
            ? [a.ai_review.overall.summary]
            : [],
        }
      : undefined,
    history: [
      { operator: `用户#${a.user_id}`, action: '提交申请', time: submitted || '—' },
      ...(a.approved_by
        ? [{ operator: `用户#${a.approved_by}`, action: a.status === 'approved' ? '已通过' : '已驳回', time: a.closed_at?.replace('T', ' ').slice(0, 16) || '—' }]
        : []),
    ],
  };
}

const Approval: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { consumeDraft, setApprovalResult } = useApprovalDraftStore();
  const { addNotification } = useNotificationStore();
  const meetingWorkItems = useMeetingWorkItemStore((s) => s.items);
  const meetingWorkItemSetStatus = useMeetingWorkItemStore((s) => s.setStatus);
  // 真实后端数据 + scope
  const currentUser = useUserStore((s) => s.user);
  // 普通员工（USER 角色）进入 /approval → 直接跳到新建工单页
  useEffect(() => {
    if (currentUser && currentUser.role === 'USER') {
      navigate('/approval/new', { replace: true });
    }
  }, [currentUser, navigate]);
  if (currentUser && currentUser.role === 'USER') {
    return <div style={{ padding: 24, color: '#999' }}>正在跳转到工单申请…</div>;
  }
  const currentRole = currentUser?.role;
  const isSuper = currentRole === 'SUPER_ADMIN';
  const isDeptLead = currentRole === 'DEPT_ADMIN' || isSuper;
  const [scope, setScope] = useState<ApprovalScope>('mine');
  const [loading, setLoading] = useState(false);
  const [backendItems, setBackendItems] = useState<BackendApproval[]>([]);
  // 兼容 UI：先用真实数据；如果真实数据为空（开发初/后端无数据），降级到 MOCK
  const [approvalList, setApprovalList] = useState<ApprovalItem[]>(MOCK_APPROVALS);
  const [dataSource, setDataSource] = useState<'backend' | 'mock'>('mock');
  const [selectedTab, setSelectedTab] = useState<string>('pending');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [detailItem, setDetailItem] = useState<ApprovalItem | null>(null);
  const [sandboxDraft, setSandboxDraft] = useState<ApprovalDraft | null>(null);
  // 业务联动：会议生成待办 → 工单/审批 一键跳转带来的会议工单
  const [meetingWorkItem, setMeetingWorkItem] = useState<MeetingWorkItem | null>(null);
  // 附件预览
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  // 当前详情审批的附件元数据
  const [detailAttachments, setDetailAttachments] = useState<Attachment[]>([]);
  // 申请人/审批人 user info 缓存
  const [userMap, setUserMap] = useState<Record<number, UserInfo>>({});

  // 角色 → 默认 scope
  useEffect(() => {
    if (isSuper) {
      setScope('all');
    } else if (isDeptLead) {
      setScope('dept');
    } else {
      setScope('mine');
    }
  }, [isSuper, isDeptLead]);

  // 拉真实后端数据
  const loadList = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const resp = await approvalsApi.list({ scope, limit: 100 });
      console.log('[Approval] loadList scope=', scope, 'items.length=', resp.items.length, 'total=', (resp as any).total);
      console.log('[Approval] items[0] =', resp.items[0]);
      setBackendItems(resp.items);
      // 适配到 UI 结构
      const mapped: ApprovalItem[] = resp.items.map(mapBackendToUI);
      console.log('[Approval] mapped.length =', mapped.length);
      setApprovalList(mapped.length > 0 ? mapped : MOCK_APPROVALS);
      setDataSource(mapped.length > 0 ? 'backend' : 'mock');
    } catch (err) {
      console.warn('[Approval] 拉真实数据失败，降级到 MOCK：', err);
      setApprovalList(MOCK_APPROVALS);
      setDataSource('mock');
    } finally {
      setLoading(false);
    }
  }, [scope, currentUser]);

  useEffect(() => {
    loadList();
  }, [loadList]);

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

  useEffect(() => {
    if (dataSource !== 'backend' || Object.keys(userMap).length === 0) return;
    setApprovalList((prev) =>
      prev.map((it) => {
        // 仅对来自 backend 的项做 enrichment（id 是数字字符串）
        if (!/^\d+$/.test(it.id)) return it;
        const orig = backendItems.find((b) => String(b.id) === it.id);
        if (!orig) return it;
        const applicant = userMap[orig.user_id];
        const approver = orig.approved_by ? userMap[orig.approved_by] : null;
        return {
          ...it,
          applicant: applicant ? getDisplayName(applicant) : it.applicant,
          department: applicant?.department || '—',
          currentApprover: approver ? getDisplayName(approver) : it.currentApprover,
          history: orig.approved_by && approver
            ? [
                ...it.history.slice(0, 1),
                { operator: getDisplayName(approver), action: orig.status === 'approved' ? '已通过' : '已驳回', time: orig.closed_at?.replace('T', ' ').slice(0, 16) || '—' },
              ]
            : it.history,
        };
      })
    );
  }, [userMap, dataSource, backendItems]);

  // 打开详情时拉附件元数据 + 完整审批详情（带 AI 审查）
  const [detailAI, setDetailAI] = useState<typeof import('@/api/aiReview').AIReviewReport | null>(null);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    if (!detailItem || dataSource !== 'backend') {
      setDetailAttachments([]);
      setDetailAI(null);
      return;
    }
    const approvalId = Number(detailItem.id);
    if (!Number.isFinite(approvalId)) {
      setDetailAttachments([]);
      setDetailAI(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1) 拉附件（独立 try，失败时保留旧值，不影响附件展示）
      try {
        const atts = await attachmentsApi.listByBusiness('approval', approvalId);
        if (!cancelled) setDetailAttachments(atts.items);
      } catch (e) {
        console.warn('[Approval] 拉附件失败：', e);
        if (!cancelled) setDetailAttachments([]);
      }
      // 2) 拉 AI 审查（独立 try）
      try {
        const full = await approvalsApi.get(approvalId);
        if (!cancelled) setDetailAI(full.ai_review || null);
      } catch (e) {
        console.warn('[Approval] 拉详情失败（仅影响 AI 卡片）：', e);
        if (!cancelled) setDetailAI(null);
      }
    })();
    return () => { cancelled = true; };
  }, [detailItem?.id, dataSource]);

  // 用户信息缓存（id → UserInfo）
  const userCache = React.useRef<Record<number, UserInfo>>({});
  const resolveUser = useCallback(async (id: number): Promise<UserInfo | null> => {
    if (userCache.current[id]) return userCache.current[id];
    try {
      const u = await userApi.get(id);
      userCache.current[id] = u;
      return u;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => {
    if (dataSource !== 'backend' || backendItems.length === 0) {
      setUserMap({});
      return;
    }
    const ids = new Set<number>();
    backendItems.forEach((a) => {
      ids.add(a.user_id);
      if (a.approved_by) ids.add(a.approved_by);
    });
    let cancelled = false;
    (async () => {
      const out: Record<number, UserInfo> = {};
      for (const id of ids) {
        const u = await resolveUser(id);
        if (u) out[id] = u;
      }
      if (!cancelled) setUserMap(out);
    })();
    return () => { cancelled = true; };
  }, [backendItems, dataSource, resolveUser]);

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
      onOk: async () => {
        const comment = (document.getElementById('approval-comment-input') as HTMLTextAreaElement)?.value || '';
        if (dataSource === 'backend') {
          try {
            await approvalsApi.act(Number(id), { action: 'approve', comment });
            message.success('已通过');
            await loadList();
          } catch (err) {
            console.error('approve failed', err);
            return;
          }
        } else {
          // 演示模式：仅前端改状态
          setApprovalList((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: 'approved' as ApprovalStatus,
                    history: [
                      ...item.history,
                      {
                        operator: currentUser?.name || t('approval.detail.applicant'),
                        action: '已通过',
                        comment,
                        time: new Date().toLocaleString(),
                      },
                    ],
                  }
                : item
            )
          );
          message.success('已通过（演示模式）');
        }
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
      onOk: async () => {
        if (dataSource === 'backend') {
          try {
            await approvalsApi.act(Number(id), { action: 'reject', comment: '已驳回' });
            message.info('已驳回');
            await loadList();
          } catch (err) {
            console.error('reject failed', err);
            return;
          }
        } else {
          setApprovalList((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: 'rejected' as ApprovalStatus,
                    history: [
                      ...item.history,
                      {
                        operator: currentUser?.name || t('approval.detail.applicant'),
                        action: '已驳回',
                        comment: '',
                        time: new Date().toLocaleString(),
                      },
                    ],
                  }
                : item
            )
          );
          message.info('已驳回（演示模式）');
        }
        setDetailItem(null);
      },
    });
  };

  // ── 手动触发 AI 审查 ──
  const handleTriggerAIReview = async (id: string) => {
    if (dataSource !== 'backend') {
      message.info('演示模式：AI 审查需连接后端');
      return;
    }
    setReviewing(true);
    try {
      const res = await approvalsApi.triggerReview(Number(id));
      console.log('[AI 审查] 响应数据:', res);
      message.success(
        `AI 审查完成 → ${res.ai_suggestion === 'pass' ? '通过 ✓' : res.ai_suggestion === 'review' ? '建议复核 ⚠' : '建议驳回 ✗'}`,
      );
      // 更新 detailAI → AIReviewCard 自动重新渲染（4 维度完整报告）
      setDetailAI(res.ai_review);
      // 刷新列表（total / status 状态）
      await loadList();
    } catch (err) {
      console.error('AI 审查失败', err);
      message.error('AI 审查失败：' + ((err as any)?.response?.data?.detail || (err as Error).message));
    } finally {
      setReviewing(false);
    }
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/approval/new')}
            >
              新建审批
            </Button>
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
              loading={loading}
              onClick={loadList}
            >
              {t('approval.refresh')}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 12 }}>
          {currentUser?.department && scope === 'dept' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
              message={
                <span>
                  你正在以 <b>{currentUser.department}</b> 部门管理员身份查看本部门员工提交的审批；
                  切到「全部」可看跨部门工单（仅超级管理员）。
                </span>
              }
            />
          )}
          {currentUser?.department && scope === 'mine' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
              message={
                <span>
                  「我的申请」= 你作为申请人提交的所有工单（{currentUser.department}）。
                </span>
              }
            />
          )}
          <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Radio.Group
            value={scope}
            onChange={(e) => setScope(e.target.value as ApprovalScope)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="mine">我的申请</Radio.Button>
            {isDeptLead && <Radio.Button value="dept">本部门</Radio.Button>}
            {isSuper && <Radio.Button value="all">全部</Radio.Button>}
          </Radio.Group>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dataSource === 'backend' ? '已连接真实后端' : '演示数据（后端为空）'} · 共 {approvalList.length} 条
          </Text>
          </Space>
        </div>
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
                          {item.aiSuggestion && (
                            <Tooltip
                              title={
                                item.aiSuggestion === 'pass'
                                  ? 'AI 4 维度审查建议通过'
                                  : item.aiSuggestion === 'review'
                                    ? 'AI 建议人工复核'
                                    : 'AI 建议驳回（高风险）'
                              }
                            >
                              <Tag
                                color={
                                  item.aiSuggestion === 'pass' ? 'success'
                                    : item.aiSuggestion === 'review' ? 'warning'
                                      : 'error'
                                }
                                icon={<RobotOutlined />}
                              >
                                {item.aiSuggestion === 'pass' ? 'AI：通过'
                                  : item.aiSuggestion === 'review' ? 'AI：复核'
                                    : 'AI：驳回'}
                              </Tag>
                            </Tooltip>
                          )}
                          {!item.aiSuggestion && item.aiPrecheck && (
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

            {/* 附件列表（来自真后端 attachment_ids） */}
            {detailAttachments.length > 0 ? (
              <>
                <Divider orientation="left" style={{ fontSize: 14 }}>
                  {t('approval.attachments')}（{detailAttachments.length}）
                </Divider>
                <List
                  size="small"
                  bordered
                  dataSource={detailAttachments}
                  renderItem={(att) => (
                    <List.Item
                      style={{ padding: '6px 12px', cursor: 'pointer' }}
                      onClick={() => setPreviewAtt(att)}
                      actions={[
                        <Button
                          key="view"
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={(e) => { e.stopPropagation(); setPreviewAtt(att); }}
                        >
                          预览
                        </Button>,
                      ]}
                    >
                      <Space>
                        <PaperClipOutlined />
                        <Text>{att.original_filename}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({(att.size / 1024).toFixed(1)} KB)
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            ) : detailItem.attachments && detailItem.attachments.length > 0 ? (
              // 演示数据 fallback
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
            ) : null}

            {/* AI 辅助审查报告 */}
            {dataSource === 'backend' && (
              <div style={{ margin: '16px 0' }}>
                <AIReviewCard report={detailAI} />
              </div>
            )}

            <Divider orientation="left" style={{ fontSize: 14 }}>
              {t('approval.detail.description')}
            </Divider>
            <Paragraph>{detailItem.description}</Paragraph>

            {detailAI ? (
              <>
                <Divider orientation="left" style={{ fontSize: 14 }}>
                  <Space>
                    <RobotOutlined style={{ color: '#1890ff' }} />
                    {t('approval.detail.aiPrecheck')}
                    {detailAI.reviewed_at && (
                      <Tag color="default" style={{ fontSize: 11 }}>
                        {new Date(detailAI.reviewed_at).toLocaleString('zh-CN')}
                      </Tag>
                    )}
                  </Space>
                </Divider>
                <AIReviewCard report={detailAI} />
              </>
            ) : (
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
                    background: '#fafafa',
                    border: '1px dashed #d9d9d9',
                    textAlign: 'center',
                  }}
                >
                  <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    此工单尚未经过 AI 合规审查
                  </Paragraph>
                  <Button
                    type="primary"
                    icon={<RobotOutlined />}
                    loading={reviewing}
                    onClick={() => handleTriggerAIReview(detailItem.id)}
                  >
                    {reviewing ? '审查中…' : '触发 AI 审查'}
                  </Button>
                  <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                    将执行 4 维度合规检查（合规 / 要素完整 / 异常检测 / 制度匹配）
                  </Paragraph>
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

      {/* 附件预览 */}
      <AttachmentPreviewModal
        attachment={previewAtt}
        open={!!previewAtt}
        onClose={() => setPreviewAtt(null)}
      />
    </div>
  );
};

export default Approval;
