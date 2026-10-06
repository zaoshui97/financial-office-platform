/**
 * 会后业务 Service（前端 mock 实现）
 *
 * 设计原则：
 *   - UI 组件只能调本文件暴露的函数，绝不直接写 setTimeout 或 fetch
 *   - 每个函数对应 meetingApiContract.ts 中一个接口契约
 *   - 函数内部目前用 setTimeout 模拟异步，未来后端真实接口上线后
 *     把每个函数体里的 `await delay(...)` + `return mockXxx` 替换为
 *     `const { data } = await axios.post<...>('/api/v1/...', req)` 即可
 *     UI 组件代码 0 改动
 *
 * 业务联动改动：
 *   - closeMeeting 会调用 meetingWorkItemStore.bulkCreate 创建工单
 *   - exportMarkdownWithSandbox 增加导出前沙箱检测，命中阻断则拒绝导出
 *   - 报告导出日志绑定 businessRef（meetingId）
 */

import type {
  DispatchActionRequest,
  DispatchActionResponse,
  GetReportResponse,
  ListMeetingActionsResponse,
  CloseOutActionRequest,
  CloseOutActionResponse,
} from './meetingApiContract';
import type { Blackboard } from './multiAgentOrchestrator';
import { DEMO_REPORT_DATA, DEMO_MEETING_ID } from '@/mock/meetingDemo';
import { useMeetingWorkItemStore } from '@/store/meetingWorkItemStore';
import { useApprovalDraftStore } from '@/store/approvalDraftStore';
import { useNotificationStore } from '@/store/notificationStore';
import { checkCompliance } from './sandbox/sandboxApiContract';
import type { SandboxResult } from './sandbox/sandboxEngine';
import { eventBus } from './eventBus';

// ============================================================
// 内部 mock 状态：保存派单结果（前端真实对接后删除）
// ============================================================

interface MockWorkItem {
  workItemId: string;
  sourceActionId: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'done';
  url: string;
  createdAt: string;
}

const mockWorkItems = new Map<string, MockWorkItem[]>(); // meetingId → workItems
const closedWorkItems = new Set<string>(); // workItemId

// ============================================================
// Helper: 模拟网络延迟
// ============================================================

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ============================================================
// 1. dispatchActions
//    真实对接时:
//      const { data } = await axios.post<DispatchActionResponse>(
//        `/api/v1/meetings/${req.meetingId}/actions/dispatch`, req
//      );
//      return data.data;
// ============================================================

export async function dispatchActions(
  req: DispatchActionRequest
): Promise<DispatchActionResponse['data']> {
  // ====== 前端 mock 逻辑（未来删除）======
  await delay(800 + Math.random() * 400); // 模拟 800-1200ms 派单耗时

  // 演示模式：返回预设派单数据
  if (req.meetingId === 'demo-meeting-q4-budget') {
    const demoItems = DEMO_REPORT_DATA.sections.actions;
    return {
      dispatchBatchId: 'batch-demo-001',
      workItems: demoItems.map((a) => ({
        workItemId: a.id,
        sourceActionId: a.id,
        status: a.status,
        createdAt: new Date().toISOString(),
        url: `/approval/work-item/${a.id}`,
      })),
      allSuccess: true,
    };
  }

  // 幂等性：同一 idempotencyKey 直接返回已有结果
  const existing = mockWorkItems.get(req.meetingId) || [];
  if (existing.length > 0 && existing[0].workItemId.startsWith(req.idempotencyKey)) {
    return {
      dispatchBatchId: existing[0].workItemId,
      workItems: existing.map((w) => ({
        workItemId: w.workItemId,
        sourceActionId: w.sourceActionId,
        status: w.status,
        createdAt: w.createdAt,
        url: w.url,
      })),
      allSuccess: true,
    };
  }

  const batchId = generateId('batch');
  const workItems: MockWorkItem[] = req.actions.map((a) => ({
    workItemId: `${batchId}__${a.id}`,
    sourceActionId: a.id,
    description: a.description,
    assignee: a.assignee || '未指派',
    dueDate: a.dueDate || new Date().toISOString().slice(0, 10),
    priority: a.priority,
    status: 'pending',
    url: `/approval/work-item/${a.id}`,
    createdAt: new Date().toISOString(),
  }));

  mockWorkItems.set(req.meetingId, [...existing, ...workItems]);

  // 模拟 5% 失败率（更真实）
  const failures = workItems
    .filter(() => Math.random() < 0.05)
    .map((w) => ({ sourceActionId: w.sourceActionId, reason: '指派人不在组织架构中' }));

  return {
    dispatchBatchId: batchId,
    workItems: workItems
      .filter((w) => !failures.find((f) => f.sourceActionId === w.sourceActionId))
      .map((w) => ({
        workItemId: w.workItemId,
        sourceActionId: w.sourceActionId,
        status: w.status,
        createdAt: w.createdAt,
        url: w.url,
      })),
    allSuccess: failures.length === 0,
    failures: failures.length > 0 ? failures : undefined,
  };
}

// ============================================================
// 2. generateReport
//    真实对接时:
//      const { data } = await axios.get<GetReportResponse>(
//        `/api/v1/meetings/${meetingId}/report`
//      );
//      return data.data;
// ============================================================

export async function generateReport(meetingId: string): Promise<GetReportResponse['data']> {
  await delay(400);

  // ============================================================
  // 演示模式：所有 meetingId 都直接返回写死的演示报告
  // 这样 Drawer / 独立报告页打开就有完整内容，不依赖 Blackboard
  // ============================================================
  return {
    ...DEMO_REPORT_DATA,
    meetingId,
    meetingTitle: meetingId === DEMO_MEETING_ID
      ? DEMO_REPORT_DATA.meetingTitle
      : `${DEMO_REPORT_DATA.meetingTitle}（演示）`,
  };
}

// ============================================================
// 3. listMeetingActions
//    真实对接时:
//      const { data } = await axios.get<ListMeetingActionsResponse>(
//        `/api/v1/meetings/${meetingId}/actions`
//      );
//      return data.data;
// ============================================================

export async function listMeetingActions(
  meetingId: string
): Promise<ListMeetingActionsResponse['data']> {
  await delay(300);
  const meetingTitle = (await generateReport(meetingId)).meetingTitle;
  return (mockWorkItems.get(meetingId) || [])
    .filter((w) => !closedWorkItems.has(w.workItemId))
    .map((w) => ({
      workItemId: w.workItemId,
      description: w.description,
      assignee: w.assignee,
      dueDate: w.dueDate,
      priority: w.priority,
      status: w.status,
      url: w.url,
      createdAt: w.createdAt,
      meetingId,
      meetingTitle,
    }));
}

// ============================================================
// 4. closeOutAction
//    真实对接时:
//      const { data } = await axios.patch<CloseOutActionResponse>(
//        `/api/v1/actions/${workItemId}/close`, req
//      );
//      return data.data;
// ============================================================

export async function closeOutAction(
  workItemId: string,
  req: CloseOutActionRequest = {}
): Promise<CloseOutActionResponse['data']> {
  await delay(300);
  closedWorkItems.add(workItemId);

  // 更新 mock store
  mockWorkItems.forEach((items) => {
    const item = items.find((i) => i.workItemId === workItemId);
    if (item) item.status = 'done';
  });

  return {
    workItemId,
    status: 'done',
    closedAt: new Date().toISOString(),
  };
}

// ============================================================
// 5. closeMeeting（业务编排：触发派单 + 生成报告）
//    这是 UI 层调的入口，整合 1 和 2
// ============================================================

export interface CloseMeetingResult {
  dispatch: DispatchActionResponse['data'];
  report: GetReportResponse['data'];
  /** 本次会议新增的工单（含关联会议 ID） */
  workItems: Array<{
    id: string;
    title: string;
    assignee: string;
    dueDate: string;
    status: 'pending';
  }>;
}

export async function closeMeeting(
  meetingId: string,
  bb: Blackboard
): Promise<CloseMeetingResult> {
  // 1. 自动派单（如果 Blackboard 中有待办）
  let dispatchResult: DispatchActionResponse['data'];
  if (bb.actions.length > 0) {
    dispatchResult = await dispatchActions({
      idempotencyKey: `${meetingId}-${bb.startedAt}`,
      meetingId,
      actions: bb.actions.map((a) => ({
        id: a.id,
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        priority: a.priority,
        source: a.source,
        sourceTimestamp: a.ts,
      })),
      notify: true,
    });
  } else {
    dispatchResult = {
      dispatchBatchId: 'empty',
      workItems: [],
      allSuccess: true,
    };
  }

  // 2. 生成报告
  const report = await generateReport(meetingId);

  // 3. 创建会议工单（写入 meetingWorkItemStore）
  const meetingTitle = report.meetingTitle || `会议 ${meetingId}`;
  type WorkItemCreate = Omit<Parameters<ReturnType<typeof useMeetingWorkItemStore.getState>['bulkCreate']>[0], 'id' | 'status' | 'createdAt'>;
  const actionData: WorkItemCreate[] = dispatchResult.workItems
    .map((w) => {
      const action = bb.actions.find((a) => a.id === w.sourceActionId);
      if (!action) return null;
      return {
        meetingId,
        meetingTitle,
        title: action.description,
        text: action.description,
        assignee: action.assignee || '未指派',
        dueDate: action.dueDate || new Date().toISOString().slice(0, 10),
        priority: (action.priority || 'medium') as 'low' | 'medium' | 'high',
      };
    })
    .filter(Boolean) as unknown as WorkItemCreate[];

  const createdWorkItems = actionData.length > 0
    ? useMeetingWorkItemStore.getState().bulkCreate(actionData)
    : [];

  // 仿真联动：触发事件总线 → crossStoreBridge 自动写待办 + 通知
  createdWorkItems.forEach((w) => {
    eventBus.emit('meeting.workitem.created', {
      id: w.id,
      meetingId,
      title: w.title,
      assignee: w.assignee,
      priority: (w.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
    });
  });

  // 4. 发送通知：有新的会议工单待处理
  if (createdWorkItems.length > 0) {
    useNotificationStore.getState().addNotification({
      type: 'system',
      title: '会议工单已派发',
      content: `会议「${meetingTitle}」产生了 ${createdWorkItems.length} 项待处理工单，请在截止日期前完成`,
      action: [{ label: '查看工单', key: 'view' }],
    });

    // 外部推送：触发钉钉/企微/邮件
    (async () => {
      const { dispatchMeetingTodo } = await import('./notificationDispatchService');
      const { usePushChannelConfigStore } = await import('@/store/pushChannelConfigStore');
      const result = await dispatchMeetingTodo({
        title: `会议工单已派发：${meetingTitle}`,
        content: `会议「${meetingTitle}」产生了 ${createdWorkItems.length} 项待处理工单，请尽快安排。`,
        meetingId,
        link: `/meeting/${meetingId}`,
      });
      // 记录推送时间
      if (result.success || Object.values(result.channelResults).some((r) => r?.ok)) {
        usePushChannelConfigStore.getState().recordSent('meeting_todo');
      }
    })();
  }

  return {
    dispatch: dispatchResult,
    report,
    workItems: createdWorkItems.map((w) => ({
      id: w.id,
      title: w.title,
      assignee: w.assignee,
      dueDate: w.dueDate,
      status: 'pending' as const,
    })),
  };
}

// ============================================================
// 6. exportMarkdown（导出 Markdown 格式报告）
//    客户端工具，不走后端
// ============================================================

/**
 * 将会议报告转为纯文本字符串（用于导出 / 沙箱检测）
 *
 * 设计原则：
 *   - 去掉所有 Markdown 符号（#、**、_、—— 等），读起来像真实商务文档
 *   - 结构用自然段落 + 编号表达，不堆砌 AI 格式标记
 *   - 一行一句，无折行，适合粘贴到 Word / 飞书 / 钉钉
 */
export function reportToPlainText(report: GetReportResponse['data']): string {
  const parts: string[] = [];

  // 标题区
  parts.push(`${report.meetingTitle}`);
  parts.push(`会议时间：${report.startedAt?.slice(0, 16).replace('T', ' ')}`);
  parts.push(`参会人员：${report.participants.join('、')}`);
  parts.push(`会议时长：${Math.floor(report.durationSec / 60)} 分钟`);
  parts.push('');

  // 摘要
  if (report.summary) {
    parts.push(`【会议摘要】`);
    parts.push(report.summary);
    parts.push('');
  }

  // 决策
  if (report.sections.decisions.length > 0) {
    parts.push(`【关键决策】共 ${report.sections.decisions.length} 项`);
    report.sections.decisions.forEach((d, i) => {
      parts.push(`${i + 1}、${d.topic}`);
      parts.push(`   决议内容：${d.decision}`);
      parts.push(`   责任人：${d.owner}（置信度 ${(d.confidence * 100).toFixed(0)}%）`);
    });
    parts.push('');
  }

  // 待办
  if (report.sections.actions.length > 0) {
    parts.push(`【待办事项】共 ${report.sections.actions.length} 项`);
    report.sections.actions.forEach((a, i) => {
      const p = a.priority === 'high' ? '高' : a.priority === 'medium' ? '中' : '低';
      parts.push(`${i + 1}、${a.description}`);
      parts.push(`   负责人：${a.assignee}  截止日期：${a.dueDate}  优先级：${p}`);
    });
    parts.push('');
  }

  // 风险
  if (report.sections.risks.length > 0) {
    parts.push(`【风险提示】共 ${report.sections.risks.length} 项`);
    report.sections.risks.forEach((r, i) => {
      parts.push(`${i + 1}、${r}`);
    });
    parts.push('');
  }

  // 议题
  if (report.sections.topics.length > 0) {
    parts.push(`【议题标签】${report.sections.topics.join('、')}`);
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * 将会议报告转为 Markdown 文本（保留基础结构，供需要 Markdown 格式的场景）
 *
 * 克制使用 Markdown 语法：
 *   - 标题用 #，不用 ** 加粗
 *   - 列表用 -，不用编号 + 粗体
 *   - 引用用 >，不用斜体 _ 或 —— 装饰
 *   - 决策 / 待办用纯文本自然表达，去掉 AI 风格强调
 */
export function reportToMarkdown(report: GetReportResponse['data']): string {
  const lines: string[] = [];

  lines.push(`# ${report.meetingTitle}`);
  lines.push('');
  lines.push(`会议时间：${report.startedAt?.slice(0, 16).replace('T', ' ')}`);
  lines.push(`参会人员：${report.participants.join('、')}`);
  lines.push(`会议时长：${Math.floor(report.durationSec / 60)} 分钟`);
  lines.push('');

  if (report.summary) {
    lines.push(`## 会议摘要`);
    lines.push(report.summary);
    lines.push('');
  }

  if (report.sections.decisions.length > 0) {
    lines.push(`## 关键决策（${report.sections.decisions.length} 项）`);
    report.sections.decisions.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.topic}`);
      lines.push(`   ${d.decision}`);
      lines.push(`   责任人：${d.owner}（${(d.confidence * 100).toFixed(0)}%）`);
    });
    lines.push('');
  }

  if (report.sections.actions.length > 0) {
    lines.push(`## 待办事项（${report.sections.actions.length} 项）`);
    report.sections.actions.forEach((a, i) => {
      const p = a.priority === 'high' ? '高' : a.priority === 'medium' ? '中' : '低';
      lines.push(`${i + 1}. ${a.description}`);
      lines.push(`   负责人：${a.assignee} | 截止：${a.dueDate} | ${p}优先级`);
    });
    lines.push('');
  }

  if (report.sections.risks.length > 0) {
    lines.push(`## 风险提示`);
    report.sections.risks.forEach((r, i) => {
      lines.push(`- ${r}`);
    });
    lines.push('');
  }

  if (report.sections.topics.length > 0) {
    lines.push(`## 议题标签：${report.sections.topics.join('、')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(report: GetReportResponse['data']) {
  const text = reportToPlainText(report);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${report.meetingTitle}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ============================================================
// 8. exportMarkdownWithSandbox —— 带沙箱检测的会议报告导出
//
// 流程：报告文本 → 沙箱检测 → 阻断则抛错 / 通过则记录日志 + 下载
// UI 调用方捕获 SandboxError 展示阻断提示 + 跳转改写页面
// ============================================================

export interface SandboxError {
  passed: false;
  blocked: true;
  sandboxResult: SandboxResult;
  message: string;
}

export interface ExportResult {
  passed: true;
  sandboxResult: SandboxResult;
}

export type ExportCheckResult = SandboxError | ExportResult;

/**
 * 导出前沙箱检测（不下载，只检测）
 * 调用方根据 returned 类型决定是否允许导出
 */
export async function checkBeforeExport(
  report: GetReportResponse['data']
): Promise<ExportCheckResult> {
  const text = reportToPlainText(report);

  const result = await checkCompliance({
    text,
    source: 'meeting_export',
    businessRef: {
      type: 'meeting',
      id: report.meetingId,
      title: report.meetingTitle,
    },
  });

  if (result.blocked) {
    return {
      passed: false,
      blocked: true,
      sandboxResult: result,
      message: `检测到 ${result.issues.length} 项阻断级违规，报告导出已被拦截。请先修改后再导出。`,
    };
  }

  return { passed: true, sandboxResult: result };
}

/**
 * 完整导出流程：检测通过后下载报告
 * 失败时抛出 SandboxError，UI 捕获后展示阻断弹窗
 */
export async function exportMarkdownWithSandbox(
  report: GetReportResponse['data']
): Promise<void> {
  const checkResult = await checkBeforeExport(report);
  if (!checkResult.passed) {
    throw checkResult; // 抛出给 UI 层处理
  }
  downloadMarkdown(report);
}

// ============================================================
// 9. resetAllMocks（仅供开发调试）
// ============================================================

export function _resetMocks() {
  mockWorkItems.clear();
  closedWorkItems.clear();
}
