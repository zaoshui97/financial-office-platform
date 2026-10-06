/**
 * 周报生成 Service —— 场景 6：通知 / 邮件 / 周报日报生成
 *
 * 核心链路：
 *   生成周报 → 自动合规沙箱检查 → 高风险提示 / 阻断 → 通知推送
 *
 * 与亮点 2 沙箱深度集成：
 *   - 报告正文自动过 sandboxEngine.check()
 *   - 阻断级风险 → 不允许提交，直接提示修改
 *   - 通过 → 通知推送（邮件/钉钉 mock）
 *
 * 前后端严格分离：UI 只调 weeklyReportService，真实后端替换 await delay 为 axios.post
 */

import { runSandboxCheck } from './sandbox/sandboxEngine';
import type { SandboxResult } from './sandbox/sandboxEngine';
import { generateId, formatDate } from '@/utils/format';

// ============================================================
// 类型定义
// ============================================================

export type ReportType = 'daily' | 'weekly' | 'monthly';
export type ReportStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
export type NotificationChannel = 'email' | 'dingtalk' | 'wechat' | 'system';

export interface WeeklyReportData {
  title: string;
  period: string;           // "2024-W42" / "2024-10-01"
  reportType: ReportType;
  author: string;
  department: string;
  /** 各 section 内容 */
  sections: ReportSection[];
  wordCount: number;
  complianceScore?: number; // 合规评分（沙箱产出）
  compliancePassed?: boolean;
  status: ReportStatus;
  createdAt: string;
  submittedAt?: string;
  notifiedAt?: string;
  /** 通知记录 */
  notifications: NotificationRecord[];
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'table' | 'list';
  /** 该 section 是否含敏感词 */
  hasRisk?: boolean;
  riskLevel?: 'none' | 'low' | 'medium' | 'high' | 'block';
}

export interface NotificationRecord {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  sentAt: string;
  status: 'success' | 'failed';
  message?: string;
}

export interface ComplianceCheckResult {
  /** 是否通过 */
  passed: boolean;
  /** 是否阻断 */
  blocked: boolean;
  /** 评分 */
  score: number;
  /** 风险摘要 */
  summary: string;
  /** 需要修改的 sections */
  riskySections: string[];
  /** 沙箱原生结果（供详情展示） */
  sandboxResult: SandboxResult;
}

export interface GenerateReportOptions {
  reportType: ReportType;
  period: string;
  author: string;
  department: string;
  /** 手动输入的摘要信息 */
  summaryInput?: {
    thisWeekDone: string;    // 本周完成
    thisWeekBlockers: string; // 本周阻塞
    nextWeekPlan: string;   // 下周计划
    metrics: string;        // 关键指标
    highlights: string;     // 亮点/风险
  };
  /** 是否跳过合规检查（草稿模式） */
  skipCompliance?: boolean;
}

// ============================================================
// Mock 数据：生成一段真实周报正文
// ============================================================

function buildReportContent(opts: GenerateReportOptions): { sections: ReportSection[]; fullText: string } {
  const { reportType, period, author, summaryInput } = opts;

  const periodLabel = reportType === 'daily' ? '日报'
    : reportType === 'weekly' ? '周报' : '月报';

  const sections: ReportSection[] = [
    {
      id: 'summary',
      title: `${periodLabel}摘要`,
      type: 'text',
      content: summaryInput?.thisWeekDone || (
        zh
          ? `本周完成核心任务包括：客户管理系统需求评审、Q4 预算调整方案制定、合规自查报告提交。` +
            `关键指标达成情况：客户满意度 92%，项目交付及时率 88%，预算执行率 95%。`
          : `This week's key deliverables include: customer management system requirements review, Q4 budget adjustment plan, compliance self-inspection report.`
      ),
    },
    {
      id: 'done',
      title: '本周完成',
      type: 'list',
      content: summaryInput?.thisWeekDone || (
        `1. 完成客户管理系统 v2.0 需求评审，确认功能范围 35 项\n` +
            `2. 提交 Q4 预算调整申请（金额：580,000 元）\n` +
            `3. 合规自查报告已提交法务部门审核\n` +
            `4. 参加金融科技峰会，分享 AI 办公实践\n` +
            `5. 完成团队绩效中期评估`
      ),
    },
    {
      id: 'blockers',
      title: '风险与阻塞',
      type: 'text',
      content: summaryInput?.thisWeekBlockers || (
        `1. 某客户项目付款延期 30 天，正在跟进\n2. 服务器迁移预计延迟 5 个工作日`
      ),
    },
    {
      id: 'nextplan',
      title: '下周计划',
      type: 'list',
      content: summaryInput?.nextWeekPlan || (
        `1. 启动客户管理系统开发 Sprint 2\n2. 完成预算调整方案 CEO 审批\n3. 安排新员工入职培训\n4. 跟进客户项目回款`
      ),
    },
    {
      id: 'metrics',
      title: '关键指标',
      type: 'table',
      content: summaryInput?.metrics || (
        zh
          ? `| 指标 | 本周 | 环比 |\n|---|---|---|\n| 项目交付及时率 | 88% | +3% |\n| 预算执行率 | 95% | +2% |\n| 客户满意度 | 92% | 持平 |\n| 合规检查通过率 | 100% | +5% |`
          : `| Metric | This Week | Change |\n|---|---|---|\n| On-time delivery | 88% | +3% |\n| Budget execution | 95% | +2% |\n| Client satisfaction | 92% | flat |\n| Compliance pass rate | 100% | +5% |`
      ),
    },
  ];

  // 拼接全文用于合规检查
  const fullText = sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');

  return { sections, fullText };
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 1. 生成周报（包含合规自动检查）
 *
 * 真实对接时：
 *   const { data } = await axios.post('/api/v1/reports/generate-weekly', opts);
 *   return data;
 */
export async function generateWeeklyReport(
  opts: GenerateReportOptions
): Promise<{ report: WeeklyReportData; compliance: ComplianceCheckResult }> {
  await new Promise((r) => setTimeout(r, 1200));

  const { sections, fullText } = buildReportContent(opts);

  // 合规检查（除非 skipCompliance）
  let compliance: ComplianceCheckResult;
  if (opts.skipCompliance) {
    const passed = true;
    compliance = {
      passed,
      blocked: false,
      score: 5.0,
      summary: '草稿模式，跳过合规检查',
      riskySections: [],
      sandboxResult: runSandboxCheck(''),
    };
  } else {
    const result = runSandboxCheck(fullText);
    compliance = {
      passed: result.passed,
      blocked: result.blocked,
      score: result.score,
      summary: buildComplianceSummary(result),
      riskySections: identifyRiskySections(result, sections),
      sandboxResult: result,
    };
  }

  const report: WeeklyReportData = {
    title: `${opts.period} ${opts.reportType === 'daily' ? '日报' : opts.reportType === 'weekly' ? '周报' : '月报'}`,
    period: opts.period,
    reportType: opts.reportType,
    author: opts.author,
    department: opts.department,
    sections,
    wordCount: fullText.length,
    complianceScore: compliance.score,
    compliancePassed: compliance.passed,
    status: compliance.blocked ? 'draft' : 'pending_review',
    createdAt: new Date().toISOString(),
    notifications: [],
  };

  return { report, compliance };
}

/**
 * 2. 提交周报（触发合规检查 + 通知推送）
 */
export async function submitWeeklyReport(
  report: WeeklyReportData
): Promise<{ success: boolean; compliance: ComplianceCheckResult; notifications: NotificationRecord[] }> {
  await new Promise((r) => setTimeout(r, 800));

  // 再次合规检查（防止草稿阶段跳过后又修改内容）
  const fullText = report.sections.map((s) => s.content).join('\n');
  const sandboxResult = runSandboxCheck(fullText);

  const compliance: ComplianceCheckResult = {
    passed: sandboxResult.passed,
    blocked: sandboxResult.blocked,
    score: sandboxResult.score,
    summary: buildComplianceSummary(sandboxResult),
    riskySections: identifyRiskySections(sandboxResult, report.sections),
    sandboxResult,
  };

  if (compliance.blocked) {
    return {
      success: false,
      compliance,
      notifications: [],
    };
  }

  // 通知推送（mock 3 个渠道）
  const notifications: NotificationRecord[] = await Promise.all([
    pushNotification({ channel: 'dingtalk', report, compliance }),
    pushNotification({ channel: 'email', report, compliance }),
    pushNotification({ channel: 'system', report, compliance }),
  ]);

  return {
    success: true,
    compliance,
    notifications,
  };
}

/**
 * 3. 推送通知
 *
 * 真实对接时：
 *   await axios.post('/api/v1/notifications/send', { channel, content })
 */
async function pushNotification(opts: {
  channel: NotificationChannel;
  report: WeeklyReportData;
  compliance: ComplianceCheckResult;
}): Promise<NotificationRecord> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 200));

  const channelLabels: Record<NotificationChannel, string> = {
    dingtalk: '钉钉工作通知',
    email: '邮件',
    wechat: '企业微信',
    system: '系统通知',
  };

  const record: NotificationRecord = {
    id: generateId(),
    channel: opts.channel,
    recipient: opts.channel === 'email' ? 'team@company.com' : '全部成员',
    sentAt: new Date().toISOString(),
    status: Math.random() > 0.05 ? 'success' : 'failed', // 5% 失败率
    message: channelLabels[opts.channel],
  };

  return record;
}

/**
 * 4. 合规摘要文本
 */
function buildComplianceSummary(result: SandboxResult): string {
  if (result.blocked) {
    return `检测到 ${result.issues.length} 项风险（含阻断级违规），必须修改后才能提交`;
  }
  if (result.issues.length > 0) {
    return `发现 ${result.issues.length} 项合规风险，建议检查后提交`;
  }
  return `合规检查通过，评分 ${result.score.toFixed(1)}/5`;
}

/**
 * 5. 找出含风险的 sections
 */
function identifyRiskySections(
  result: SandboxResult,
  sections: ReportSection[]
): string[] {
  if (result.issues.length === 0) return [];

  const riskyRuleNames = new Set(result.issues.map((i) => i.ruleName));
  // 简单匹配：content 中含 ruleName 的关键词即标记
  return sections
    .filter((s) =>
      result.hitSpans.some(
        (hs) => s.content.includes(hs.text) || result.issues.some((i) => i.snippets.some((sn) => s.content.includes(sn)))
      )
    )
    .map((s) => s.id);
}

// ============================================================
// Mock：历史周报列表
// ============================================================

export function getMockReportHistory(): WeeklyReportData[] {
  return [
    {
      title: '2024-W41 周报',
      period: '2024-W41',
      reportType: 'weekly',
      author: '张三',
      department: '技术部',
      wordCount: 1850,
      complianceScore: 5.0,
      compliancePassed: true,
      status: 'approved',
      createdAt: '2024-10-11T18:00:00Z',
      submittedAt: '2024-10-11T18:30:00Z',
      sections: [
        {
          id: 'summary',
          title: '周报摘要',
          type: 'text',
          content: '本周完成核心任务包括：API 网关升级、数据库性能优化、团队培训。',
        },
      ],
      notifications: [
        { id: 'n1', channel: 'dingtalk', recipient: '全部成员', sentAt: '2024-10-11T18:30:00Z', status: 'success' },
      ],
    },
    {
      title: '2024-W40 周报',
      period: '2024-W40',
      reportType: 'weekly',
      author: '张三',
      department: '技术部',
      wordCount: 2100,
      complianceScore: 3.8,
      compliancePassed: true,
      status: 'pending_review',
      createdAt: '2024-10-04T18:00:00Z',
      sections: [
        {
          id: 'summary',
          title: '周报摘要',
          type: 'text',
          content: '本周完成核心任务包括：用户反馈系统上线、安全漏洞修复。',
        },
      ],
      notifications: [],
    },
  ];
}
