/**
 * Compliance Receipt —— 合规回执（审计证据）
 *
 * 一次合规检查结果 → 不可篡改的"审计回执"，包含：
 *   - 回执 ID（带版本号 + 时间戳 + 随机串）
 *   - 操作人 + 部门 + 角色
 *   - 输入文本长度 + 输入哈希（SHA-256 截断）
 *   - 评分 / 是否通过 / 是否阻断 / 问题数 / 命中规则
 *   - 关联业务单据（businessRef）
 *   - 命中法规列表
 *   - 回执签发时间 + 防伪码（SHA-256 of all above）
 *
 * 真实场景：
 *   - 用户点击"导出合规回执" → 下载 PDF（前端用 jspdf 或后端生成）
 *   - 内部审计 / 监管检查时作为凭证提交
 */

import type { SandboxResult } from './sandboxEngine';
import { hashInput } from './sandboxLog';
import type { BusinessRef } from './sandboxLog';

export interface ComplianceReceipt {
  /** 回执 ID，例如 'CR-20260918-XXXX-V1' */
  receiptId: string;
  /** 回执版本 */
  version: '1.0';
  /** 签发时间 ISO */
  issuedAt: string;
  /** 操作人 */
  operator: string;
  /** 操作人部门 */
  operatorDept?: string;
  /** 操作人角色 */
  operatorRole?: string;
  /** 输入文本长度 */
  inputLength: number;
  /** 输入文本 SHA-256 截断哈希 */
  inputHash: string;
  /** 输入预览（脱敏） */
  inputPreview: string;
  /** 评分 */
  score: number;
  /** 是否通过 */
  passed: boolean;
  /** 是否阻断 */
  blocked: boolean;
  /** 问题数 */
  issueCount: number;
  /** 命中规则详情 */
  issues: Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    hitCount: number;
    suggestion: string;
    regulationIds: string[];
  }>;
  /** 关联业务单据 */
  businessRef?: BusinessRef;
  /** 来源 */
  source: string;
  /** 防伪码：上述字段拼接后 SHA-256 截断 */
  sealHash: string;
  /** 备注（可选） */
  remark?: string;
}

/** 生成回执 ID */
function generateReceiptId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CR-${date}-${rand}-V1`;
}

/** 计算防伪码（基于关键字段的 SHA-256 截断） */
async function computeSealHash(parts: (string | number | boolean)[]): Promise<string> {
  const raw = parts.join('|');
  const hash = await hashInput(raw);
  return hash.toUpperCase();
}

/** 生成合规回执 */
export async function generateReceipt(params: {
  text: string;
  result: SandboxResult;
  source: string;
  operator: string;
  operatorDept?: string;
  operatorRole?: string;
  businessRef?: BusinessRef;
  remark?: string;
}): Promise<ComplianceReceipt> {
  const inputHash = await hashInput(params.text);
  const inputPreview = params.text.replace(/\s+/g, ' ').trim().slice(0, 80) + (params.text.length > 80 ? '…' : '');

  const receiptId = generateReceiptId();
  const issuedAt = new Date().toISOString();

  const sealHash = await computeSealHash([
    receiptId,
    issuedAt,
    params.operator,
    params.operatorDept || '',
    params.operatorRole || '',
    inputHash,
    params.result.score,
    params.result.passed,
    params.result.blocked,
    params.result.issues.length,
    params.result.issues.map((i) => `${i.ruleId}:${i.hitCount}`).join(','),
    params.source,
  ]);

  return {
    receiptId,
    version: '1.0',
    issuedAt,
    operator: params.operator,
    operatorDept: params.operatorDept,
    operatorRole: params.operatorRole,
    inputLength: params.text.length,
    inputHash,
    inputPreview,
    score: params.result.score,
    passed: params.result.passed,
    blocked: params.result.blocked,
    issueCount: params.result.issues.length,
    issues: params.result.issues.map((i) => ({
      ruleId: i.ruleId,
      ruleName: i.ruleName,
      severity: i.severity,
      hitCount: i.hitCount,
      suggestion: i.suggestion,
      regulationIds: i.regulations.map((r) => r.id),
    })),
    businessRef: params.businessRef,
    source: params.source,
    sealHash,
    remark: params.remark,
  };
}

/** 导出回执为 JSON 文件（演示；真实场景导出 PDF） */
export function downloadReceipt(receipt: ComplianceReceipt) {
  const json = JSON.stringify(receipt, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${receipt.receiptId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出回执为可读 Markdown */
export function exportReceiptMarkdown(receipt: ComplianceReceipt): string {
  const lines: string[] = [];
  lines.push(`# 合规检查回执 ${receipt.receiptId}`);
  lines.push('');
  lines.push(`**版本**：${receipt.version}  `);
  lines.push(`**签发时间**：${receipt.issuedAt}  `);
  lines.push(`**操作人**：${receipt.operator}${receipt.operatorDept ? ` (${receipt.operatorDept})` : ''}${receipt.operatorRole ? ` [${receipt.operatorRole}]` : ''}  `);
  lines.push(`**来源**：${receipt.source}`);
  lines.push(`**防伪码**：\`${receipt.sealHash}\``);
  lines.push('');
  lines.push('## 检测结果');
  lines.push(`- 评分：${receipt.score.toFixed(1)} / 5`);
  lines.push(`- 是否通过：${receipt.passed ? '是' : '否'}`);
  lines.push(`- 是否阻断：${receipt.blocked ? '是' : '否'}`);
  lines.push(`- 问题数：${receipt.issueCount}`);
  lines.push('');
  lines.push('## 输入信息');
  lines.push(`- 文本长度：${receipt.inputLength} 字`);
  lines.push(`- 输入哈希：\`${receipt.inputHash}\``);
  lines.push(`- 预览：${receipt.inputPreview}`);
  lines.push('');
  if (receipt.businessRef) {
    lines.push('## 关联业务单据');
    lines.push(`- 类型：${receipt.businessRef.type}`);
    lines.push(`- ID：${receipt.businessRef.id}`);
    if (receipt.businessRef.title) lines.push(`- 标题：${receipt.businessRef.title}`);
    lines.push('');
  }
  if (receipt.issues.length > 0) {
    lines.push('## 命中问题');
    receipt.issues.forEach((iss, idx) => {
      lines.push(`### ${idx + 1}. ${iss.ruleName} [\`${iss.ruleId}\`] (${iss.severity})`);
      lines.push(`- 命中次数：${iss.hitCount}`);
      lines.push(`- 修复建议：${iss.suggestion}`);
      if (iss.regulationIds.length > 0) {
        lines.push(`- 关联法规：${iss.regulationIds.join(', ')}`);
      }
      lines.push('');
    });
  }
  if (receipt.remark) {
    lines.push('## 备注');
    lines.push(receipt.remark);
  }
  return lines.join('\n');
}
