/**
 * 演示种子数据 —— "Q4 预算审批会议"
 *
 * 评委点开演示模式后，无需手敲，自动填满 Blackboard，看到：
 *    5 条转写 → 4 个决策 + 6 个待办 + 2 个风险
 *    完整的会后报告 + 自动派单
 *
 * 设计原则：
 *   - 内容真实可信（金融场景，非 toy data）
 *   - 覆盖所有 4 个 Agent 的触发路径
 *   - 长度适中：评委 10-15 秒内走完，不冗长
 */

import type { Blackboard } from '@/services/multiAgentOrchestrator';
import type { GetReportResponse } from '@/services/meetingApiContract';

// ============================================================
// 会议元信息
// ============================================================

export const DEMO_MEETING_ID = 'demo-meeting-q4-budget';
export const DEMO_MEETING_TITLE = '2024年Q4预算审批与合规整改专题会';

export const DEMO_TRANSCRIPTS = [
  { speaker: '王总（财务总监）', content: '今天的议题有两个：一是Q4预算重新审批，二是新合规要求的整改计划。' },
  { speaker: '张明（技术负责人）', content: '我先汇报一下技术债情况，目前有23个遗留系统存在数据孤岛问题，严重影响交付效率。' },
  { speaker: '李娜（合规经理）', content: '银保监会新规要求，12月31日前必须完成客户数据隔离改造，否则面临处罚。' },
  { speaker: '王总（财务总监）', content: '技术债的预算申请是800万，这个数字我们确认过了。合规整改预估需要200万紧急采购。' },
  { speaker: '陈强（产品总监）', content: '产品这边需要补充说明：23个系统中有6个是核心交易系统，优先级最高，必须优先处理。' },
  { speaker: '王总（财务总监）', content: '好的，我决定：技术债整改预算800万分两期拨付，一期500万本月到位，二期300万11月到位。' },
  { speaker: '张明（技术负责人）', content: '收到！我这边负责技术债整改，请你（陈强）负责产品侧的验收测试。' },
  { speaker: '李娜（合规经理）', content: '合规整改200万，我这边来统筹，请张三协助采购流程，务必月底前完成供应商签约。' },
  { speaker: '张明（技术负责人）', content: '另外，数据孤岛问题如果不处理，有数据泄露风险，需要立即启动。' },
  { speaker: '王总（财务总监）', content: '最后再确认一下：技术债整改由张明负责，产品验收陈强；合规整改李娜负责，采购张三跟进。' },
  { speaker: '陈强（产品总监）', content: '收到，我本周五前输出验收测试方案初稿。' },
  { speaker: '李娜（合规经理）', content: '合规整改方案，我下周一向监管报送，时间很紧，需要尽快启动。' },
] as const;

// ============================================================
// 预期触发结果（演示时 Agent 会自动识别出这些）
// ============================================================

/** 预期决策数：4 */
export const DEMO_EXPECTED_DECISIONS = 4;
/** 预期待办数：6 */
export const DEMO_EXPECTED_ACTIONS = 6;
/** 预期风险数：2 */
export const DEMO_EXPECTED_RISKS = 2;

// ============================================================
// 演示报告内容（演示模式下 generateReport 直接返回这个）
// ============================================================

export const DEMO_REPORT_DATA: GetReportResponse['data'] = {
  meetingId: DEMO_MEETING_ID,
  meetingTitle: DEMO_MEETING_TITLE,
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  durationSec: 45 * 60,
  participants: ['王总（财务总监）', '张明（技术负责人）', '李娜（合规经理）', '陈强（产品总监）'],
  summary:
    '本次会议审议了Q4年度预算，重点讨论了技术债整改（800万元两期拨付）和合规整改（200万元紧急采购）两个专项。与会人员明确了责任人及时间节点：技术债整改一期500万本月到位，核心交易系统优先处理；合规整改须于月底前完成供应商签约，下周一报送监管。',

  sections: {
    decisions: [
      {
        topic: '技术债整改预算方案',
        decision:
          '技术债整改预算800万分两期拨付：一期500万本月到位，二期300万11月到位，优先处理6个核心交易系统。',
        owner: '王总（财务总监）',
        confidence: 0.98,
      },
      {
        topic: '合规整改预算方案',
        decision: '合规整改紧急采购预算200万，由李娜统筹，月底前完成供应商签约。',
        owner: '王总（财务总监）',
        confidence: 0.97,
      },
      {
        topic: '任务分工确认',
        decision:
          '技术债整改张明负责、产品验收陈强跟进；合规整改李娜统筹、采购流程张三协助。',
        owner: '王总（财务总监）',
        confidence: 0.95,
      },
      {
        topic: '合规整改时间节点',
        decision: '合规整改方案须于下周一（11日前）向监管机构报送。',
        owner: '李娜（合规经理）',
        confidence: 0.99,
      },
    ],
    actions: [
      {
        id: 'a-demo-001',
        description: '技术债整改一期（500万）：完成23个遗留系统的数据孤岛改造方案',
        assignee: '张明',
        dueDate: new Date().toISOString().slice(0, 10),
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'a-demo-002',
        description: '技术债整改二期（300万）：完成核心交易系统隔离验收',
        assignee: '张明',
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'a-demo-003',
        description: '产品验收测试：输出23个系统的测试用例与验收方案初稿',
        assignee: '陈强',
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'a-demo-004',
        description: '合规整改：完成200万供应商采购合同签约',
        assignee: '李娜',
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'a-demo-005',
        description: '合规采购协助：协助李娜完成采购审批流程',
        assignee: '张三',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        priority: 'medium',
        status: 'pending',
      },
      {
        id: 'a-demo-006',
        description: '合规报送：下周一前向银保监会提交整改计划',
        assignee: '李娜',
        dueDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
        priority: 'high',
        status: 'pending',
      },
    ],
    risks: [
      '数据泄露风险：23个系统存在数据孤岛，如不处理可能引发客户信息泄露事件',
      '监管处罚风险：12月31日前未完成合规整改，将面临银保监会处罚',
    ],
    facts: DEMO_TRANSCRIPTS.map((t, i) => ({
      content: t.content,
      speaker: t.speaker,
      ts: Date.now() - (DEMO_TRANSCRIPTS.length - i) * 180000,
    })),
    topics: ['预算审批', '技术债整改', '合规整改', '数据安全', '采购管理'],
  },
};

// ============================================================
// 辅助：填充后 Blackboard 快照（用于演示时直接 setState）
// ============================================================

export const DEMO_BLACKBOARD_SNAPSHOT: Blackboard = {
  meetingId: DEMO_MEETING_ID,
  phase: 'closed',
  facts: DEMO_REPORT_DATA.sections.facts,
  decisions: DEMO_REPORT_DATA.sections.decisions.map((d, i) => ({
    id: `d-demo-${i + 1}`,
    topic: d.topic,
    decision: d.decision,
    owner: d.owner,
    confidence: d.confidence,
    ts: Date.now() - (DEMO_REPORT_DATA.sections.decisions.length - i) * 30000,
  })),
  actions: DEMO_REPORT_DATA.sections.actions.map((a) => ({
    id: a.id,
    description: a.description,
    assignee: a.assignee,
    dueDate: a.dueDate,
    priority: a.priority,
    source: a.assignee || '系统',
    ts: Date.now(),
    status: 'pending',
  })),
  topics: DEMO_REPORT_DATA.sections.topics,
  risks: DEMO_REPORT_DATA.sections.risks,
  summary: DEMO_REPORT_DATA.summary,
  startedAt: Date.now() - 45 * 60 * 1000,
};

// ============================================================
// 演示用会议工单（深化：覆盖 6 态 + 关联会议片段）
// ============================================================

import type { MeetingWorkItem } from '@/store/meetingWorkItemStore';

const now = Date.now();
const iso = (offsetH: number) => new Date(now - offsetH * 3600 * 1000).toISOString();
const due = (offsetD: number) => new Date(now + offsetD * 86400000).toISOString().slice(0, 10);

/**
 * 启动时种入 store，覆盖所有 6 态 + 至少 1 条滞留工单
 * 真实场景改为后端拉取
 */
export const DEMO_WORKITEMS: MeetingWorkItem[] = [
  {
    id: 'wi-demo-001',
    meetingId: DEMO_MEETING_ID,
    meetingTitle: DEMO_MEETING_TITLE,
    title: '合规报送：下周一前向银保监会提交整改计划',
    text: '根据会议决策，李娜需要在下周一前向银保监会提交整改计划。',
    assignee: '李娜',
    assigneeDept: '合规部',
    dueDate: due(2),
    priority: 'high',
    status: 'reviewing',
    createdAt: iso(96),
    updatedAt: iso(8),
    meetingSegmentId: 'seg-demo-006',
    meetingSegmentSnippet: '李娜：合规整改方案，我下周一向监管报送，时间很紧，需要尽快启动。',
  },
  {
    id: 'wi-demo-002',
    meetingId: DEMO_MEETING_ID,
    meetingTitle: DEMO_MEETING_TITLE,
    title: '技术债整改一期：完成核心交易系统隔离（500万）',
    text: '本月到位500万，启动核心交易系统隔离改造。',
    assignee: '张明',
    assigneeDept: '技术部',
    dueDate: due(14),
    priority: 'high',
    status: 'in_progress',
    createdAt: iso(72),
    updatedAt: iso(96), // 滞留：> 72h 未推进
    meetingSegmentId: 'seg-demo-001',
    meetingSegmentSnippet: '张明：技术债的预算申请是800万，这个数字我们确认过了。',
  },
  {
    id: 'wi-demo-003',
    meetingId: DEMO_MEETING_ID,
    meetingTitle: DEMO_MEETING_TITLE,
    title: '产品验收测试：输出23个系统的测试用例与验收方案初稿',
    text: '产品验收测试方案初稿。',
    assignee: '陈强',
    assigneeDept: '产品部',
    dueDate: due(3),
    priority: 'high',
    status: 'pending',
    createdAt: iso(24),
    updatedAt: iso(24),
    meetingSegmentId: 'seg-demo-005',
    meetingSegmentSnippet: '陈强：收到，我本周五前输出验收测试方案初稿。',
  },
  {
    id: 'wi-demo-004',
    meetingId: DEMO_MEETING_ID,
    meetingTitle: DEMO_MEETING_TITLE,
    title: '合规整改：完成200万供应商采购合同签约',
    text: '合规整改紧急采购。',
    assignee: '李娜',
    assigneeDept: '合规部',
    dueDate: due(14),
    priority: 'high',
    status: 'approved',
    createdAt: iso(120),
    updatedAt: iso(48),
    closedAt: iso(48),
    meetingSegmentId: 'seg-demo-004',
    meetingSegmentSnippet: '李娜：合规整改200万，我这边来统筹，请张三协助采购流程，务必月底前完成供应商签约。',
  },
  {
    id: 'wi-demo-005',
    meetingId: DEMO_MEETING_ID,
    meetingTitle: DEMO_MEETING_TITLE,
    title: '合规采购协助：协助李娜完成采购审批流程',
    text: '协助李娜完成采购流程。',
    assignee: '张三',
    assigneeDept: '合规部',
    dueDate: due(7),
    priority: 'medium',
    status: 'rejected',
    createdAt: iso(96),
    updatedAt: iso(60),
    closedAt: iso(60),
    closeNote: '采购单需补充供应商评估报告，已退回。',
    meetingSegmentId: 'seg-demo-004',
    meetingSegmentSnippet: '李娜：请张三协助采购流程。',
  },
  {
    id: 'wi-demo-006',
    meetingId: DEMO_MEETING_ID,
    meetingTitle: DEMO_MEETING_TITLE,
    title: '技术债整改二期（300万）：完成核心交易系统隔离验收',
    text: '二期 300 万，11 月到位。',
    assignee: '张明',
    assigneeDept: '技术部',
    dueDate: due(30),
    priority: 'high',
    status: 'assigned',
    createdAt: iso(2),
    updatedAt: iso(2),
    meetingSegmentId: 'seg-demo-001',
    meetingSegmentSnippet: '王总：技术债整改预算800万分两期拨付。',
  },
  {
    id: 'wi-demo-007',
    meetingId: 'meeting-monthly-2024-09',
    meetingTitle: '月度风控例会',
    title: '客户 KYC 资料完整性回扫',
    text: '上月新增客户的 KYC 资料完整性核查。',
    assignee: '王五',
    assigneeDept: '市场部',
    dueDate: due(5),
    priority: 'medium',
    status: 'pending',
    createdAt: iso(48),
    updatedAt: iso(48),
    meetingSegmentId: 'seg-monthly-kyc',
    meetingSegmentSnippet: '王五：本月需完成 KYC 回扫，避免监管处罚。',
  },
];

