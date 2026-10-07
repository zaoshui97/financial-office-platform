/**
 * AI 辅助审批报告 — 类型 + UI 辅助函数
 */

export type RiskLevel = 'low' | 'medium' | 'high';
export type Suggestion = 'pass' | 'review' | 'reject';

export interface ComplianceHit {
  category?: string;
  reason?: string;
  judge_source?: string;
  confidence?: number;
}

export interface AnomalyFlag {
  level: 'red' | 'yellow' | 'green';
  code: string;
  message: string;
}

export interface PolicyMatch {
  doc_title: string;
  clause: string;
  rule_excerpt?: string;
  similarity: number;
  verdict: 'support' | 'contradict' | 'neutral';
}

export interface AIDimensionReport {
  score: number;
  summary: string;
  hits?: ComplianceHit[];
  missing_fields?: string[];
  flags?: AnomalyFlag[];
  matches?: PolicyMatch[];
  risk_level?: RiskLevel;
}

export interface AIOverall {
  score: number;
  risk_level: RiskLevel;
  suggestion: Suggestion;
  auto_pass_eligible: boolean;
  confidence: number;
  summary: string;
}

export interface AIReviewReport {
  review_id: string;
  approval_id: number;
  reviewed_at: string;
  latency_ms: number;
  model_version: string;
  overall: AIOverall;
  dimensions: {
    compliance: AIDimensionReport;
    completeness: AIDimensionReport;
    anomaly: AIDimensionReport;
    policy: AIDimensionReport;
  };
  explainability: string;
}

export const SUGGESTION_META: Record<Suggestion, { color: string; text: string; icon: string }> = {
  pass:   { color: '#22A775', text: 'AI 建议通过', icon: '✅' },
  review: { color: '#fa8c16', text: 'AI 建议人工复核', icon: '⚠️' },
  reject: { color: '#f5222d', text: 'AI 建议驳回', icon: '🚫' },
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  low:    '#22A775',
  medium: '#fa8c16',
  high:   '#f5222d',
};

export const DIMENSION_META: Record<keyof AIReviewReport['dimensions'], { label: string; desc: string }> = {
  compliance:   { label: '合规检查',  desc: '拦截违规表述/敏感信息' },
  completeness: { label: '要素完整',  desc: '必填字段/附件齐全度' },
  anomaly:      { label: '异常检测',  desc: '金额/重复/时间窗口' },
  policy:       { label: '制度匹配',  desc: '与企业制度文档匹配度' },
};
