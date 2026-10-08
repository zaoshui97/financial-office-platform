/**
 * 沙箱 API 契约 —— 前后端严格分离
 *
 * 前端只调 sandboxService.check()
 * 后端按此契约实现即可，UI 0 改动
 *
 * 真实后端上线后：
 *   1. 删除本文件的 mock 实现
 *   2. 把 postMeetingService 的替换模式复制过来
 *   3. 把每个函数的 await delay() 替换为 axios.post()
 */

import axios from 'axios';
import type { SandboxResult } from './sandboxEngine';
import { runSandboxCheck } from './sandboxEngine';
import { sandboxLogStore, hashInput, previewInput, type BusinessRef } from './sandboxLog';
import { DEMO_SANDBOX_TEXTS } from '@/mock/sandboxDemo';
import { generateId } from '@/utils/format';
import { eventBus } from '@/services/eventBus';

// ============================================================
// 演示开关：VITE_USE_BACKEND_SANDBOX=true 时调真实后端
//   启动：VITE_USE_BACKEND_SANDBOX=true npm run dev
//   默认 false：使用本地 mock（演示 fallback，保证不依赖后端）
// ============================================================
const USE_BACKEND_SANDBOX: boolean = import.meta.env.VITE_USE_BACKEND_SANDBOX === 'true';

// 后端审查响应 → 前端 SandboxResult 的转换
interface BackendCheckResponse {
  success?: boolean;
  data?: BackendCheckData;
  error?: string;
}

interface BackendCheckData {
  score: number;
  passed: boolean;
  blocked: boolean;
  issues: BackendIssue[];
  total_hits: number;
  duration_ms: number;
  sanitized_text: string;
  sanitized_fields: Record<string, number>;
  risk_category: string | null;
  confidence: number | null;
  judge_source: string | null;
  audit_id: number | null;
  model_version: string;
}

interface BackendIssue {
  rule_id: string;
  rule_name: string;
  category: string;
  severity: 'block' | 'high' | 'medium' | 'low';
  snippet: string;
  suggestion: string;
  regulation_ids: string[];
}

// ============================================================
// 真实对接时：把这里替换为 axios 调用
//   const { data } = await axios.post<SandboxCheckResponse>(
//     '/api/v1/sandbox/check',
//     { text }
//   );
//   return data.data;
// ============================================================

export interface SandboxCheckRequest {
  text: string;
  source: 'approval' | 'report' | 'qa' | 'sandbox_page' | 'demo' | 'meeting_report' | 'meeting_export' | 'chat_ai' | 'industry_news_review';
  /** 业务单据绑定（用于联动追溯） */
  businessRef?: BusinessRef;
}

export interface SandboxCheckResponse {
  success: boolean;
  data?: SandboxResult;
  error?: string;
}

// ============================================================
// 1. check —— 沙箱主检查
// ============================================================

/**
 * 调真实后端审查接口
 * 失败自动 fallback 到本地 mock，演示不中断
 */
async function callBackendCheck(req: SandboxCheckRequest): Promise<SandboxResult> {
  const token = localStorage.getItem('access_token') || '';
  const { data } = await axios.post<BackendCheckResponse>(
    '/api/v1/compliance/sandbox/check',
    {
      text: req.text,
      source: req.source,
      business_ref: req.businessRef,
    },
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 10_000,
    }
  );
  if (!data?.data) {
    throw new Error(data?.error || '后端审查返回为空');
  }
  return mapBackendToSandboxResult(data.data);
}

/**
 * 后端响应 → 前端 SandboxResult 结构
 * 复用前端 CATEGORY_META 做 UI 友好展示，新增的 category 用 fallback
 */
function mapBackendToSandboxResult(d: BackendCheckData): SandboxResult {
  // 计算高亮 span（基于原文 text）
  const hitSpans: any[] = [];
  for (const i of d.issues) {
    if (!i.snippet) continue;
    // 在 sanitized_text 中找，找不到则用规则 ID 标记
    const idx = d.sanitized_text.indexOf(i.snippet);
    if (idx >= 0) {
      hitSpans.push({
        start: idx,
        end: idx + i.snippet.length,
        text: i.snippet,
        ruleId: i.rule_id,
        category: i.category,
        severity: i.severity,
      });
    }
  }

  // 法规 stub（前端 RegulationPanel 会再去 regulationRef 里查真实数据）
  const stubRegulation = (id: string) => ({
    id,
    shortName: id,
    fullName: id,
    issuer: '—',
    year: 2024,
    article: '',
    articleText: '',
    penalty: '',
  });

  // 构造 issues（补齐前端需要的字段）
  const issues: any[] = d.issues.map((i) => ({
    ruleId: i.rule_id,
    ruleName: i.rule_name,
    ruleNameEn: i.rule_id,
    category: i.category,
    severity: i.severity,
    hitCount: 1,
    snippets: i.snippet ? [i.snippet] : [],
    suggestion: i.suggestion,
    regulations: i.regulation_ids.map(stubRegulation),
  }));

  // 分类命中数
  const categoryHits: Record<string, number> = {};
  for (const i of issues) {
    categoryHits[i.category] = (categoryHits[i.category] || 0) + 1;
  }

  // 法规去重
  const regulationIds = Array.from(
    new Set(d.issues.flatMap((i) => i.regulation_ids))
  );
  const regulations = regulationIds.map(stubRegulation);

  return {
    score: d.score,
    passed: d.passed,
    blocked: d.blocked,
    issues,
    hitSpans,
    regulations,
    totalHits: d.total_hits,
    categoryHits: categoryHits as any,
    rewritten: d.sanitized_text,
    durationMs: d.duration_ms,
    simulatedFailure: false,
  };
}

export async function checkCompliance(
  req: SandboxCheckRequest
): Promise<SandboxResult> {
  // 演示模式直接走本地（无延迟、无网络依赖）
  if (req.source === 'demo') {
    const idx = Math.floor(Math.random() * DEMO_SANDBOX_TEXTS.length);
    const demoText = DEMO_SANDBOX_TEXTS[idx].text;
    const result = runSandboxCheck(demoText);
    const hash = await hashInput(demoText);
    sandboxLogStore.record({
      user: '演示用户',
      inputLength: demoText.length,
      inputPreview: previewInput(demoText),
      inputHash: hash,
      score: result.score,
      passed: result.passed,
      blocked: result.blocked,
      issueCount: result.issues.length,
      totalHits: result.totalHits,
      durationMs: result.durationMs,
      source: req.source,
      businessRef: req.businessRef,
    });
    return result;
  }

  // 真后端路径：调 /api/v1/compliance/sandbox/check
  if (USE_BACKEND_SANDBOX) {
    try {
      const result = await callBackendCheck(req);
      const hash = await hashInput(req.text);
      sandboxLogStore.record({
        user: '当前用户',
        inputLength: req.text.length,
        inputPreview: previewInput(req.text),
        inputHash: hash,
        score: result.score,
        passed: result.passed,
        blocked: result.blocked,
        issueCount: result.issues.length,
        totalHits: result.totalHits,
        durationMs: result.durationMs,
        source: req.source,
        businessRef: req.businessRef,
      });
      return result;
    } catch (e) {
      console.warn('[sandbox] 后端审查失败，fallback 到本地 mock:', e);
      // 继续走下面的本地路径
    }
  }

  // 本地 mock 路径（默认 / 后端失败 fallback）
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
  const result = runSandboxCheck(req.text);
  const hash = await hashInput(req.text);
  sandboxLogStore.record({
    user: '当前用户',
    inputLength: req.text.length,
    inputPreview: previewInput(req.text),
    inputHash: hash,
    score: result.score,
    passed: result.passed,
    blocked: result.blocked,
    issueCount: result.issues.length,
    totalHits: result.totalHits,
    durationMs: result.durationMs,
    source: req.source,
    businessRef: req.businessRef,
  });

  // 外部推送：阻断级合规告警（与原逻辑一致）
  if (result.blocked) {
    (async () => {
      const { dispatchSandboxCritical } = await import('@/services/notificationDispatchService');
      const { useNotificationStore } = await import('@/store/notificationStore');
      const { usePushChannelConfigStore } = await import('@/store/pushChannelConfigStore');
      const topRule = result.issues[0]?.ruleName || '阻断级合规违规';
      useNotificationStore.getState().addNotification({
        type: 'urgent',
        title: '合规沙箱检测到阻断级违规',
        content: `来源「${req.source}」：检测到 ${result.issues.length} 项阻断级违规（主要规则：${topRule}），已禁止提交/导出。`,
        action: [
          { label: '查看详情', key: 'view' },
          { label: '前往沙箱', key: 'sandbox' },
        ],
      });
      eventBus.emit('sandbox.blocked', {
        id: `sb_${Date.now()}`,
        title: req.source,
        matchedRules: result.issues.map((i) => i.ruleName),
      });
      const pushResult = await dispatchSandboxCritical({
        title: ` 合规告警：${req.source} 触发阻断级违规`,
        content: `${result.issues.length} 项阻断级违规，主要规则：${topRule}。评分 ${result.score.toFixed(1)}/5。已自动禁止业务提交/导出。`,
        link: '/sandbox',
      });
      if (pushResult.success || Object.values(pushResult.channelResults).some((r) => r?.ok)) {
        usePushChannelConfigStore.getState().recordSent('sandbox_critical');
      }
    })();
  }

  return result;
}

// ============================================================
// 2. getLog —— 获取历史记录（审计用）
// ============================================================

export async function getSandboxLogs(): Promise<ReturnType<typeof sandboxLogStore.list>> {
  await new Promise((r) => setTimeout(r, 200));
  return sandboxLogStore.list();
}

// ============================================================
// 3. exportLog —— 导出沙箱审计日志（CSV）
// ============================================================

export function exportSandboxLogCsv() {
  const logs = sandboxLogStore.list();
  const header = '时间戳,用户,输入预览(脱敏),输入长度,输入哈希,评分,是否通过,是否阻断,问题数,命中数,耗时(ms),来源\n';
  const rows = logs.map((l) =>
    [
      new Date(l.timestamp).toISOString(),
      l.user,
      `"${l.inputPreview.replace(/"/g, '""')}"`,
      l.inputLength,
      l.inputHash,
      l.score,
      l.passed ? '是' : '否',
      l.blocked ? '是' : '否',
      l.issueCount,
      l.totalHits,
      l.durationMs,
      l.source,
    ].join(',')
  );
  const csv = '\ufeff' + header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sandbox-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
