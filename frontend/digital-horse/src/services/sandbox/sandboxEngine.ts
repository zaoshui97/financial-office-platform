/**
 * Sandbox Engine —— AI 合规沙箱运行器
 *
 * 输入：任意文本（合同条款 / 邮件 / 报告 / 通知发文）
 * 输出：结构化合规检查报告（评分 / 命中规则 / 法规引用 / 改写建议）
 *
 * 设计原则：
 *   - 纯函数，无副作用，便于测试
 *   - 真实对接时只换 runCheck 内部的 await delay 为 axios.post
 *   - 引擎独立于 UI，可被 Approval / Report / QA 多处复用
 */

import {
  COMPLIANCE_RULES,
  SEVERITY_PENALTY,
  CATEGORY_META,
  RuleSeverity,
  RuleCategory,
} from './complianceRules';
import { getRegulationsByIds } from './regulationRef';
import type { Regulation } from './regulationRef';

// ============================================================
// 输出类型
// ============================================================

export interface HitSpan {
  /** 命中字符的起始位置 */
  start: number;
  /** 命中字符的结束位置 */
  end: number;
  /** 命中的原文 */
  text: string;
  /** 命中的规则 ID */
  ruleId: string;
  /** 规则类别 */
  category: RuleCategory;
  /** 严重度 */
  severity: RuleSeverity;
}

export interface ComplianceIssue {
  ruleId: string;
  ruleName: string;
  ruleNameEn: string;
  category: RuleCategory;
  severity: RuleSeverity;
  /** 命中次数 */
  hitCount: number;
  /** 命中片段（前 100 字符） */
  snippets: string[];
  /** 修复建议 */
  suggestion: string;
  /** 关联法规 */
  regulations: Regulation[];
}

export interface SandboxResult {
  /** 评分 0-5（5 分为完全合规） */
  score: number;
  /** 是否通过（score >= 3 且无 block） */
  passed: boolean;
  /** 是否阻断（有 block 级别规则命中） */
  blocked: boolean;
  /** 命中问题列表 */
  issues: ComplianceIssue[];
  /** 命中的字符片段 */
  hitSpans: HitSpan[];
  /** 法规引用去重集合 */
  regulations: Regulation[];
  /** 总命中次数 */
  totalHits: number;
  /** 各类别命中数（用于分布图） */
  categoryHits: Record<RuleCategory, number>;
  /** 改写后的建议版本（基于规则建议拼接） */
  rewritten: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 是否模拟失败（5% 概率） */
  simulatedFailure?: boolean;
}

// ============================================================
// 内部：单条规则检测
// ============================================================

interface RuleHit {
  start: number;
  end: number;
  text: string;
}

function checkRule(text: string, rule = COMPLIANCE_RULES.find((r) => r.id === 'TEST')) {
  // ...
}

function detectHits(text: string, rule: typeof COMPLIANCE_RULES[number]): RuleHit[] {
  const hits: RuleHit[] = [];
  const seen = new Set<string>();

  // 关键词命中
  if (rule.keywords) {
    for (const kw of rule.keywords) {
      let idx = text.indexOf(kw);
      while (idx !== -1) {
        const key = `${idx}-${idx + kw.length}`;
        if (!seen.has(key)) {
          seen.add(key);
          hits.push({
            start: idx,
            end: idx + kw.length,
            text: text.slice(idx, idx + kw.length),
          });
        }
        idx = text.indexOf(kw, idx + 1);
      }
    }
  }

  // 正则命中
  if (rule.patterns) {
    for (const p of rule.patterns) {
      try {
        const re = new RegExp(p.regex, p.flags || 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const key = `${m.index}-${m.index + m[0].length}`;
          if (!seen.has(key)) {
            seen.add(key);
            hits.push({
              start: m.index,
              end: m.index + m[0].length,
              text: m[0],
            });
          }
          // 防止零宽匹配死循环
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      } catch (e) {
        console.warn(`[sandboxEngine] Invalid regex for rule ${rule.id}:`, e);
      }
    }
  }

  // 自定义检测
  if (rule.customCheck && rule.customCheck(text)) {
    // 自定义检测返回 true 时，标记全文命中（用规则 ID 作为 span）
    hits.push({
      start: 0,
      end: 0,
      text: '[自定义规则命中]',
    });
  }

  return hits;
}

// ============================================================
// 智能改写：按规则生成改写建议
// ============================================================

function generateRewritten(text: string, issues: ComplianceIssue[]): string {
  if (issues.length === 0) return text;

  let result = text;
  // 按规则严重度排序后，逐条加注释
  const sorted = [...issues].sort((a, b) => {
    const order: Record<RuleSeverity, number> = { block: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  const rewriteSuggestions: string[] = [];
  for (const issue of sorted) {
    rewriteSuggestions.push(`【${issue.ruleName}】${issue.suggestion}`);
  }

  if (rewriteSuggestions.length > 0) {
    result += '\n\n---\n**AI 改写建议：**\n' + rewriteSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }

  return result;
}

// ============================================================
// 主函数：运行沙箱检查
// ============================================================

export function runSandboxCheck(text: string): SandboxResult {
  const start = performance.now();
  const hitSpans: HitSpan[] = [];
  const issues: ComplianceIssue[] = [];
  const categoryHits = Object.keys(CATEGORY_META).reduce(
    (acc, key) => ({ ...acc, [key]: 0 }),
    {} as Record<RuleCategory, number>
  );
  const regulationIdSet = new Set<string>();

  for (const rule of COMPLIANCE_RULES) {
    const hits = detectHits(text, rule);
    if (hits.length === 0) continue;

    // 收集 issues
    const regulations = getRegulationsByIds(rule.regulationIds);
    regulations.forEach((r) => regulationIdSet.add(r.id));

    issues.push({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleNameEn: rule.nameEn,
      category: rule.category,
      severity: rule.severity,
      hitCount: hits.length,
      snippets: hits
        .filter((h) => h.text !== '[自定义规则命中]')
        .slice(0, 3)
        .map((h) => {
          // 截取命中点周围 20 字符上下文
          const ctxStart = Math.max(0, h.start - 20);
          const ctxEnd = Math.min(text.length, h.end + 20);
          return text.slice(ctxStart, ctxEnd).replace(/\n/g, ' ');
        }),
      suggestion: rule.suggestion,
      regulations,
    });

    // 收集 hitSpans
    for (const hit of hits) {
      hitSpans.push({
        start: hit.start,
        end: hit.end,
        text: hit.text,
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
      });
      categoryHits[rule.category] = (categoryHits[rule.category] || 0) + 1;
    }
  }

  // 计算评分：基础 5 分，扣除各严重度命中分
  let penalty = 0;
  for (const issue of issues) {
    penalty += SEVERITY_PENALTY[issue.severity] * Math.min(issue.hitCount, 5);
  }
  const score = Math.max(0, Math.min(5, 5 - penalty / 20));

  // 是否阻断
  const blocked = issues.some((i) => i.severity === 'block');
  // 是否通过（无阻断 + score >= 3）
  const passed = !blocked && score >= 3;

  // 法规去重
  const regulations = Array.from(regulationIdSet)
    .map((id) => {
      const regs = getRegulationsByIds([id]);
      return regs[0] || null;
    })
    .filter(Boolean) as Regulation[];

  // 改写
  const rewritten = generateRewritten(text, issues);

  return {
    score: Number(score.toFixed(1)),
    passed,
    blocked,
    issues,
    hitSpans,
    regulations,
    totalHits: hitSpans.length,
    categoryHits,
    rewritten,
    durationMs: Math.round(performance.now() - start),
  };
}

// ============================================================
// 异步版本（模拟真实网络延迟，便于 UI 展示进度）
// ============================================================

export async function runSandboxCheckAsync(
  text: string,
  options?: {
    /** 自定义延迟（毫秒） */
    delayMs?: number;
    /** 是否模拟 5% 失败 */
    simulateFailure?: boolean;
  }
): Promise<SandboxResult> {
  const delayMs = options?.delayMs ?? 800 + Math.random() * 400;
  await new Promise((r) => setTimeout(r, delayMs));

  // 模拟 5% 失败率（与 postMeetingService 一致的设计原则）
  if (options?.simulateFailure && Math.random() < 0.05) {
    throw new Error('沙箱服务暂时不可用，请重试');
  }

  const result = runSandboxCheck(text);
  return { ...result, durationMs: delayMs };
}
