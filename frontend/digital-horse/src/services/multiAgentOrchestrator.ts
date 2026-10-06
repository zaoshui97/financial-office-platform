/**
 * Multi-Agent Orchestrator
 *
 * 4 Agent 协作编排器。会中实时运行：
 *
 *   Transcript chunk
 *        │
 *        ▼
 *   ┌────────────────────────────────────────────┐
 *   │              Blackboard (共享黑板)          │
 *   └────────────────────────────────────────────┘
 *        ▲              ▲              ▲          ▲
 *        │              │              │          │
 *   ┌────┴───┐    ┌─────┴────┐   ┌────┴───┐  ┌───┴────┐
 *   │Moderator│   │ Notetaker │   │Decision│  │ Action │
 *   │  M      │   │  N       │   │  D     │  │ A     │
 *   └─────────┘    └──────────┘   └────────┘  └────────┘
 *
 * 后端真实多 Agent 上线后，把下面 Mock 行为替换为 WebSocket 请求即可，
 * 调用方（AgentPanel / Blackboard）不用改。
 */

import { agentBus, AGENT_META, AgentRole } from './multiAgentBus';

// ============================================================
// 类型
// ============================================================

export type MeetingPhase = 'scheduled' | 'rehearsed' | 'in_progress' | 'summarizing' | 'actioning' | 'closed';

export interface BlackboardFact {
  id: string;
  content: string;
  speaker?: string;
  ts: number;
  tags: string[];
}

export interface BlackboardDecision {
  id: string;
  topic: string;
  decision: string;
  owner?: string;
  confidence: number; // 0-1
  ts: number;
}

export interface BlackboardAction {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  source: string;
  ts: number;
  status: 'pending' | 'in_progress' | 'done';
}

export interface Blackboard {
  meetingId: string;
  phase: MeetingPhase;
  facts: BlackboardFact[];
  decisions: BlackboardDecision[];
  actions: BlackboardAction[];
  topics: string[];
  risks: string[];
  summary: string;
  startedAt?: number;
}

export interface AgentRunState {
  role: AgentRole;
  status: 'idle' | 'thinking' | 'streaming' | 'done' | 'failed';
  progress: number; // 0-100
  lastOutput: string;
  startedAt?: number;
  finishedAt?: number;
  steps: { ts: number; text: string; type: 'thinking' | 'output' }[];
}

// ============================================================
// Blackboard Store (轻量级 zustand 替代品，单例)
// ============================================================

class BlackboardStore {
  private data: Blackboard = {
    meetingId: '',
    phase: 'scheduled',
    facts: [],
    decisions: [],
    actions: [],
    topics: [],
    risks: [],
    summary: '',
  };

  private subscribers = new Set<() => void>();
  /** 自增版本号：notify 时 +1，供 useSyncExternalStore 订阅，避免引用变化导致的循环 */
  private tick = 0;

  getTick(): number {
    return this.tick;
  }

  get(): Blackboard {
    return this.data;
  }

  setMeeting(id: string) {
    this.data = {
      meetingId: id,
      phase: this.data.phase === 'scheduled' ? 'in_progress' : this.data.phase,
      facts: this.data.meetingId === id ? this.data.facts : [],
      decisions: this.data.meetingId === id ? this.data.decisions : [],
      actions: this.data.meetingId === id ? this.data.actions : [],
      topics: this.data.meetingId === id ? this.data.topics : [],
      risks: this.data.meetingId === id ? this.data.risks : [],
      summary: this.data.meetingId === id ? this.data.summary : '',
      startedAt: this.data.meetingId === id ? this.data.startedAt : Date.now(),
    };
    this.notify();
  }

  setPhase(phase: MeetingPhase) {
    this.data.phase = phase;
    this.notify();
  }

  addFact(fact: BlackboardFact) {
    this.data.facts.push(fact);
    this.notify();
  }

  addDecision(d: BlackboardDecision) {
    this.data.decisions.push(d);
    this.notify();
  }

  addAction(a: BlackboardAction) {
    this.data.actions.push(a);
    this.notify();
  }

  setTopics(topics: string[]) {
    const set = new Set([...this.data.topics, ...topics]);
    this.data.topics = Array.from(set);
    this.notify();
  }

  addRisk(risk: string) {
    if (!this.data.risks.includes(risk)) {
      this.data.risks.push(risk);
      this.notify();
    }
  }

  setSummary(s: string) {
    this.data.summary = s;
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    this.tick++;
    this.subscribers.forEach((fn) => fn());
    agentBus.dispatch({
      type: 'blackboard:updated',
      meetingId: this.data.meetingId,
      payload: this.data,
    });
  }
}

export const blackboardStore = new BlackboardStore();

// ============================================================
// Agent Run State (per-role)
// ============================================================

class AgentRunStateStore {
  private states = new Map<AgentRole, AgentRunState>();
  private subscribers = new Set<() => void>();
  /** 自增版本号：notify 时 +1，供 useSyncExternalStore 订阅 */
  private tick = 0;

  getTick(): number {
    return this.tick;
  }

  get(role: AgentRole): AgentRunState {
    if (!this.states.has(role)) {
      this.states.set(role, {
        role,
        status: 'idle',
        progress: 0,
        lastOutput: '',
        steps: [],
      });
    }
    return this.states.get(role)!;
  }

  reset(role: AgentRole) {
    this.states.set(role, {
      role,
      status: 'idle',
      progress: 0,
      lastOutput: '',
      steps: [],
    });
    this.notify();
  }

  update(role: AgentRole, patch: Partial<AgentRunState>) {
    const cur = this.get(role);
    this.states.set(role, { ...cur, ...patch });
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    this.tick++;
    this.subscribers.forEach((fn) => fn());
  }
}

export const agentRunStore = new AgentRunStateStore();

// ============================================================
// Helper: 流式输出模拟（打字机）
// ============================================================

async function streamText(role: AgentRole, fullText: string, chunkMs = 28) {
  const state = agentRunStore.get(role);
  agentRunStore.update(role, { status: 'streaming', startedAt: Date.now(), lastOutput: '' });
  agentBus.dispatch({ type: 'agent:started', role, meetingId: blackboardStore.get().meetingId, payload: { role } });

  const chars = fullText.split('');
  let acc = '';
  for (let i = 0; i < chars.length; i++) {
    acc += chars[i];
    const progress = Math.floor(((i + 1) / chars.length) * 100);
    agentRunStore.update(role, { lastOutput: acc, progress });
    agentBus.dispatch({
      type: 'agent:token',
      role,
      meetingId: blackboardStore.get().meetingId,
      payload: { text: acc, progress },
    });
    await new Promise((r) => setTimeout(r, chunkMs));
  }
  agentRunStore.update(role, { status: 'done', progress: 100, finishedAt: Date.now() });
  agentBus.dispatch({ type: 'agent:completed', role, meetingId: blackboardStore.get().meetingId, payload: { text: fullText } });
}

// ============================================================
// 4 个 Agent 的行为剧本
// ============================================================

/**
 *  M Moderator: 每收到一条 transcript，自动总结
 */
export async function runModeratorOnChunk(speaker: string, content: string) {
  const role: AgentRole = 'moderator';
  agentRunStore.update(role, { status: 'thinking' });
  agentBus.dispatch({ type: 'agent:thinking', role, meetingId: blackboardStore.get().meetingId, payload: {} });

  await new Promise((r) => setTimeout(r, 400));

  const summary = `[${speaker}] 提出：${content.slice(0, 28)}${content.length > 28 ? '…' : ''}`;
  await streamText(role, summary);

  // 自动抽取话题
  const topicCandidates = ['预算', '招聘', '合规', '技术', '产品', '运营', '客户', '项目'];
  for (const t of topicCandidates) {
    if (content.includes(t)) {
      blackboardStore.setTopics([t]);
      break;
    }
  }
}

/**
 * N Notetaker: 实时记入黑板，抽取事实
 */
export async function runNotetakerOnChunk(speaker: string, content: string) {
  const role: AgentRole = 'notetaker';
  agentRunStore.update(role, { status: 'thinking' });
  agentBus.dispatch({ type: 'agent:thinking', role, meetingId: blackboardStore.get().meetingId, payload: {} });

  await new Promise((r) => setTimeout(r, 300));

  // 同步写入黑板事实
  const fact = {
    id: `f-${Date.now()}`,
    content,
    speaker,
    ts: Date.now(),
    tags: [],
  };
  blackboardStore.addFact(fact);

  // 风险信号识别
  const riskKeywords = ['风险', '问题', '阻塞', '延期', '投诉', '异常', 'risk', 'blocker', 'issue'];
  for (const k of riskKeywords) {
    if (content.toLowerCase().includes(k)) {
      blackboardStore.addRisk(`检测到风险信号："${content.slice(0, 30)}…"`);
    }
  }

  await streamText(role, `已记录 ${speaker} 的发言`);
}

/**
 * D Decision Tracker: 识别决策信号
 */
export async function runDecisionTrackerOnChunk(speaker: string, content: string) {
  const role: AgentRole = 'decision';
  agentRunStore.update(role, { status: 'thinking' });
  agentBus.dispatch({ type: 'agent:thinking', role, meetingId: blackboardStore.get().meetingId, payload: {} });

  await new Promise((r) => setTimeout(r, 500));

  // 决策信号关键词
  const decisionSignals = ['决定', '确认', '通过', '同意', '确定', '就按', 'agreed', 'decided', 'confirmed', 'approved'];
  const hasDecision = decisionSignals.some((s) => content.toLowerCase().includes(s));

  if (!hasDecision) {
    agentRunStore.update(role, { status: 'idle', progress: 0, lastOutput: '暂未识别到决策信号' });
    return;
  }

  // 抽取决策主题（首个名词短语，简化为关键词匹配）
  const topicKeywords = ['方案', '预算', '计划', '时间', '人员', '技术栈', '上线', 'plan', 'budget', 'timeline'];
  let topic = '关键决策';
  for (const k of topicKeywords) {
    if (content.includes(k)) {
      topic = content.match(new RegExp(`[一-鿿]*${k}[一-鿿]*`))?.[0] || topic;
      break;
    }
  }

  const decision = {
    id: `d-${Date.now()}`,
    topic,
    decision: content,
    owner: speaker,
    confidence: 0.85,
    ts: Date.now(),
  };
  blackboardStore.addDecision(decision);

  await streamText(role, `[${role}] 已识别决策：${topic}`);
}

/**
 * A Action Dispatcher: 抽取待办
 */
export async function runActionDispatcherOnChunk(speaker: string, content: string) {
  const role: AgentRole = 'action';
  agentRunStore.update(role, { status: 'thinking' });
  agentBus.dispatch({ type: 'agent:thinking', role, meetingId: blackboardStore.get().meetingId, payload: {} });

  await new Promise((r) => setTimeout(r, 450));

  // 待办信号
  const actionSignals = ['需要', '请你', '麻烦', 'TODO', '负责', '跟进', 'please', 'need to', 'follow up', '负责'];
  const hasAction = actionSignals.some((s) => content.toLowerCase().includes(s));

  if (!hasAction) {
    agentRunStore.update(role, { status: 'idle', progress: 0, lastOutput: '暂未识别到待办' });
    return;
  }

  // 简单抽取责任人（中文名 2-3 字 或 "XX 负责"）
  const nameMatch = content.match(/([一-鿿]{2,3})\s*(负责|跟|来)/);
  const assignee = nameMatch?.[1] || speaker;

  const action = {
    id: `a-${Date.now()}`,
    description: content,
    assignee,
    dueDate: deriveDueDate(content),
    priority: derivePriority(content),
    source: speaker,
    ts: Date.now(),
    status: 'pending' as const,
  };
  blackboardStore.addAction(action);

  await streamText(role, `→ 待办已派发 @${assignee}`);
}

function deriveDueDate(content: string): string {
  if (content.includes('今天') || content.includes('今日')) {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  if (content.includes('明天')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (content.includes('下周')) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  if (content.includes('月底')) {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.toISOString().slice(0, 10);
  }
  // 默认 3 天后
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

function derivePriority(content: string): 'low' | 'medium' | 'high' {
  if (content.includes('紧急') || content.includes('立即') || content.includes('urgent') || content.includes('asap')) return 'high';
  if (content.includes('尽快') || content.includes('重要')) return 'high';
  if (content.includes('可以') || content.includes('有时间')) return 'low';
  return 'medium';
}

/**
 * 一次新发言：4 Agent 并行触发
 */
export async function fanoutChunk(speaker: string, content: string) {
  const meetingId = blackboardStore.get().meetingId;
  agentBus.dispatch({
    type: 'transcript:chunk',
    meetingId,
    payload: { speaker, content },
  });
  await Promise.all([
    runModeratorOnChunk(speaker, content),
    runNotetakerOnChunk(speaker, content),
    runDecisionTrackerOnChunk(speaker, content),
    runActionDispatcherOnChunk(speaker, content),
  ]);
}

/**
 * 会后: 生成结构化会议纪要（流式）
 */
export async function runClosingSummary() {
  blackboardStore.setPhase('summarizing');
  const bb = blackboardStore.get();

  // 4 Agent 协作生成
  const role: AgentRole = 'moderator';
  agentRunStore.update(role, { status: 'thinking' });

  const summaryParts: string[] = [];
  summaryParts.push(`## 会议纪要\n`);
  summaryParts.push(`**召开时间**：${bb.startedAt ? new Date(bb.startedAt).toLocaleString('zh-CN') : 'N/A'}\n`);
  summaryParts.push(`**事实记录**：${bb.facts.length} 条\n`);
  summaryParts.push(`\n### 关键决策 (${bb.decisions.length})\n`);
  bb.decisions.forEach((d, i) => {
    summaryParts.push(`${i + 1}. **${d.topic}**：${d.decision} _— ${d.owner}_`);
  });
  summaryParts.push(`\n### 待办事项 (${bb.actions.length})\n`);
  bb.actions.forEach((a, i) => {
    summaryParts.push(`${i + 1}. [${a.priority.toUpperCase()}] ${a.description} _— @${a.assignee}, ${a.dueDate}_`);
  });
  if (bb.risks.length > 0) {
    summaryParts.push(`\n### 风险信号\n`);
    bb.risks.forEach((r) => summaryParts.push(`- ${r}`));
  }
  summaryParts.push(`\n### 议题\n`);
  bb.topics.forEach((t) => summaryParts.push(`- ${t}`));

  const fullText = summaryParts.join('\n');
  await streamText(role, fullText, 12);
  blackboardStore.setSummary(fullText);
  blackboardStore.setPhase('actioning');

  // 联动 postMeetingService：自动派单 + 生成报告
  // 真实后端对接后，只需替换 postMeetingService.ts 内部实现即可
  try {
    const { closeMeeting } = await import('./postMeetingService');
    const result = await closeMeeting(bb.meetingId, bb);
    agentBus.dispatch({
      type: 'meeting:state',
      meetingId: bb.meetingId,
      payload: {
        phase: 'closed',
        dispatchBatchId: result.dispatch.dispatchBatchId,
        workItemCount: result.dispatch.workItems.length,
        allDispatched: result.dispatch.allSuccess,
      },
    });
  } catch (e) {
    console.error('[Orchestrator] closeMeeting failed', e);
  }

  setTimeout(() => blackboardStore.setPhase('closed'), 800);
}

/**
 * 会前: 预演（4 Agent 模拟参会人预演一遍议题）
 */
export async function runRehearsal() {
  const role: AgentRole = 'moderator';
  agentRunStore.reset(role);
  agentRunStore.update(role, { status: 'thinking' });
  blackboardStore.setPhase('rehearsed');

  await streamText(
    role,
    '预演开始。我将依次扮演 4 位参会人，预演本次会议的关键讨论：\n\n' +
      '1️⃣ 产品总监：强调 Q3 上线节奏不能推迟\n' +
      '2️⃣ 研发负责人：技术债务已影响交付效率\n' +
      '3️⃣ 财务：预算需要重新评估\n' +
      '4️⃣ 合规：新规要求必须在 Q4 前完成整改\n\n' +
      '预计讨论 30 分钟。我已自动识别高风险议题：**预算 vs 合规**。',
    30
  );
}

// ============================================================
// Reset (meeting switch)
// ============================================================

export function resetMeeting(meetingId: string) {
  blackboardStore.setMeeting(meetingId);
  (['moderator', 'notetaker', 'decision', 'action'] as AgentRole[]).forEach((r) =>
    agentRunStore.reset(r)
  );
}

// 暴露 meta 方便组件层用
export { AGENT_META };
