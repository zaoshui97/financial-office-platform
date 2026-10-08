/**
 * PDF 导出 Service
 *
 * 实现策略：html2canvas 把离屏 DOM 渲染成图片 → 嵌入 PDF。
 * - 优势：中文由浏览器渲染，**任何 PDF 阅读器都能看**（包括 WPS/Adobe/Edge）
 * - 字体栈：Noto Sans SC → 思源黑体 → 微软雅黑 → PingFang SC → 系统 fallback
 * - document.fonts.ready 等待 webfont 加载完
 *
 * 数据兼容：
 *   - 入参兼容 GetReportResponse.data（基础形状）
 *   - 富形状传入 keyData / leaderRemarks / closure / richSummary 才会渲染额外章节
 *   - 不传则跳过对应章节
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { GetReportResponse } from './meetingApiContract';

// ============================================================
// 富数据形状（兼容 PostMeetingReport 页面）
// ============================================================

export interface KeyDataItem {
  /** 维度名，如"2023 收入" */
  label: string;
  /** 数值，如"12.8 亿" */
  value: string;
  /** 同比，如"+14%" */
  delta?: string;
}

export interface DecisionItem {
  id?: string;
  topic: string;
  /** 决议内容（PostMeetingReport: content; GetReportResponse: decision） */
  content?: string;
  decision?: string;
  /** 提出人 / 负责人 */
  proposer?: string;
  owner?: string;
  confidence: number;
  /** 影响范围（PostMeetingReport 才有） */
  impact?: string;
}

export interface ActionItem {
  id?: string;
  description?: string;
  content?: string;
  assignee?: string;
  owner?: string;
  dueDate?: string;
  deadline?: string;
  priority: string; // 'high'/'medium'/'low' or '高'/'中'/'低'
  status: string; // 'pending'/'in_progress'/'done' or 'todo'/'done'
  /** 关联议题 ID（PostMeetingReport 才有） */
  relatedTopic?: string;
}

export interface RiskItem {
  level?: string;
  type?: string;
  content: string;
  owner?: string;
  mitigation?: string;
}

export interface TopicItem {
  id?: string;
  title: string;
  duration?: string;
  summary?: string;
  keyConclusion?: string;
}

export interface LeaderRemark {
  speaker: string;
  points: string[];
}

export interface ClosureStats {
  decisionLanding?: { total: number; landed: number; inProgress?: number; overdue?: number };
  actionComplete?: { total: number; completed: number; inProgress?: number; pending?: number; overdue?: number };
  durationEfficiency?: number;
  focusRatio?: number;
}

export interface RichSummary {
  oneLine: string;
  keyPoints: string[];
  healthScore?: number;
}

/**
 * 富会议报告 PDF 入参。
 * 兼容两种数据源：
 *   1. MeetingDetail 的 GetReportResponse.data（基础）
 *   2. PostMeetingReport 的 strategyMeetingData 派生数据（富）
 */
export interface RichMeetingReport {
  meetingId: string;
  meetingTitle: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  participants?: Array<{ userId: string; name: string; department?: string; role?: string }>;
  /** 字符串摘要（GetReportResponse 形态）或富摘要 */
  summary?: string | RichSummary;
  sections: {
    decisions: DecisionItem[];
    actions: ActionItem[];
    risks: (string | RiskItem)[];
    topics: (string | TopicItem)[];
  };
  /** PostMeetingReport 专有：关键财务数据 */
  keyData?: KeyDataItem[];
  /** PostMeetingReport 专有：领导讲话 */
  leaderRemarks?: LeaderRemark[];
  /** PostMeetingReport 专有：闭环验证 */
  closure?: ClosureStats;
  /** 主持人、保密级别等元信息（可选） */
  meta?: {
    host?: string;
    meetingType?: string;
    confidentiality?: string;
    subtitle?: string;
  };
}

// ============================================================
// Helper
// ============================================================

function escapeHtml(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function priorityToEn(p: string): 'high' | 'medium' | 'low' {
  if (['高', 'high', 'urgent'].includes(p)) return 'high';
  if (['中', 'medium', 'mid'].includes(p)) return 'medium';
  return 'low';
}

function priorityColor(p: string): string {
  const en = priorityToEn(p);
  return en === 'high' ? '#DC2626' : en === 'medium' ? '#D97706' : '#059669';
}

function statusLabel(s: string): string {
  if (['done', 'completed'].includes(s)) return '已完成';
  if (['in_progress', 'inprogress', 'doing'].includes(s)) return '进行中';
  if (['pending', 'todo', 'open'].includes(s)) return '待开始';
  return s;
}

function riskItemToString(r: string | RiskItem): string {
  if (typeof r === 'string') return r;
  const parts = [r.level, r.type, r.content].filter(Boolean);
  let s = parts.join(' · ');
  if (r.mitigation) s += `（应对：${r.mitigation}）`;
  if (r.owner) s += `　责任人：${r.owner}`;
  return s;
}

function topicItemToString(t: string | TopicItem): string {
  if (typeof t === 'string') return t;
  return t.title + (t.duration ? `（${t.duration}）` : '');
}

function decisionBody(d: DecisionItem, i: number): string {
  const topic = escapeHtml(d.topic);
  const content = escapeHtml(d.content ?? d.decision ?? '');
  const proposer = escapeHtml(d.proposer ?? d.owner ?? '');
  const impact = d.impact ? `　|　影响范围：${escapeHtml(d.impact)}` : '';
  return `
    <div style="margin-bottom:14px; padding:12px; background:#F9FAFB; border-left:3px solid #0F2B5B; border-radius:0 4px 4px 0;">
      <div style="color:#0F2B5B;font-weight:700;font-size:14px;margin-bottom:4px;">
        ${i + 1}. ${topic}${d.id ? ` <span style="color:#9CA3AF;font-weight:400;font-size:11px;">(${escapeHtml(d.id)})</span>` : ''}
      </div>
      <div style="margin:0 0 6px 0;">${content}</div>
      <div style="color:#6B7280;font-size:11px;">提出人：${proposer}　|　置信度：${(d.confidence * 100).toFixed(0)}%${impact}</div>
    </div>`;
}

function actionBody(a: ActionItem): string {
  const desc = escapeHtml(a.description ?? a.content ?? '');
  const assignee = escapeHtml(a.assignee ?? a.owner ?? '');
  const due = escapeHtml(a.dueDate ?? a.deadline ?? '');
  const status = escapeHtml(statusLabel(a.status));
  const color = priorityColor(a.priority);
  const related = a.relatedTopic ? `　|　关联议题：${escapeHtml(a.relatedTopic)}` : '';
  return `
    <div style="margin-bottom:10px; display:flex; gap:10px; align-items:flex-start; padding:10px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:4px;">
      <span style="background:${color}; color:#fff; padding:3px 8px; border-radius:3px; font-size:11px; font-weight:600; flex-shrink:0; line-height:1.6;">${escapeHtml(a.priority.toUpperCase())}</span>
      <div style="flex:1;">
        <div>${desc}</div>
        <div style="color:#6B7280;font-size:11px;margin-top:3px;">负责人：${assignee}　|　截止：${due}　|　状态：${status}${related}</div>
      </div>
    </div>`;
}

function riskBody(r: string | RiskItem): string {
  return `<li style="margin-bottom:6px; color:#991B1B; padding-left:4px;">${escapeHtml(riskItemToString(r))}</li>`;
}

function topicBody(t: string | TopicItem, i: number): string {
  if (typeof t === 'string') {
    return `<li style="margin-bottom:4px;">${i + 1}. ${escapeHtml(t)}</li>`;
  }
  return `
    <div style="margin-bottom:14px; padding:12px; background:#F9FAFB; border-radius:4px;">
      <div style="color:#0F2B5B;font-weight:600;font-size:14px;margin-bottom:4px;">
        ${escapeHtml(t.id ?? '')} ${escapeHtml(t.title)} ${t.duration ? `<span style="color:#6B7280;font-weight:400;font-size:12px;">（${escapeHtml(t.duration)}）</span>` : ''}
      </div>
      ${t.summary ? `<div style="color:#374151;margin-bottom:4px;"><strong>讨论摘要：</strong>${escapeHtml(t.summary)}</div>` : ''}
      ${t.keyConclusion ? `<div style="color:#374151;"><strong>主要结论：</strong>${escapeHtml(t.keyConclusion)}</div>` : ''}
    </div>`;
}

function keyDataTableBody(items: KeyDataItem[]): string {
  const rows = items.map((k) => `
    <tr>
      <td style="padding:8px 12px; border-bottom:1px solid #E5E7EB; color:#6B7280;">${escapeHtml(k.label)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #E5E7EB; color:#0F2B5B; font-weight:600;">${escapeHtml(k.value)}</td>
      <td style="padding:8px 12px; border-bottom:1px solid #E5E7EB; color:${k.delta?.startsWith('-') ? '#DC2626' : '#059669'}; font-weight:500;">${escapeHtml(k.delta ?? '')}</td>
    </tr>`).join('');
  return `
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr style="background:#0F2B5B; color:#fff;">
          <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #0F2B5B;">维度</th>
          <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #0F2B5B;">数值</th>
          <th style="padding:8px 12px; text-align:left; border-bottom:2px solid #0F2B5B;">同比</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function leaderRemarksBody(items: LeaderRemark[]): string {
  return items.map((lr) => `
    <div style="margin-bottom:14px; padding:12px 14px; background:#F0F4FB; border-left:3px solid #3B82F6; border-radius:0 4px 4px 0;">
      <div style="color:#1E40AF;font-weight:700;font-size:14px;margin-bottom:6px;">${escapeHtml(lr.speaker)}</div>
      <ul style="margin:0; padding-left:18px; color:#1F2937;">
        ${lr.points.map((p) => `<li style="margin-bottom:3px;">${escapeHtml(p)}</li>`).join('')}
      </ul>
    </div>`).join('');
}

function closureBody(closure: ClosureStats): string {
  const cards: string[] = [];
  if (closure.decisionLanding) {
    const d = closure.decisionLanding;
    cards.push(`
      <div style="flex:1; min-width:200px; padding:14px; background:#F0FDF4; border-radius:6px;">
        <div style="color:#15803D;font-size:12px;margin-bottom:4px;">决策落地</div>
        <div style="color:#0F2B5B;font-size:22px;font-weight:700;">${d.landed} / ${d.total}</div>
        ${d.inProgress ? `<div style="color:#6B7280;font-size:11px;margin-top:2px;">进行中 ${d.inProgress} · 逾期 ${d.overdue ?? 0}</div>` : ''}
      </div>`);
  }
  if (closure.actionComplete) {
    const a = closure.actionComplete;
    cards.push(`
      <div style="flex:1; min-width:200px; padding:14px; background:#FEF3C7; border-radius:6px;">
        <div style="color:#A16207;font-size:12px;margin-bottom:4px;">待办完成</div>
        <div style="color:#0F2B5B;font-size:22px;font-weight:700;">${a.completed} / ${a.total}</div>
        ${a.inProgress !== undefined ? `<div style="color:#6B7280;font-size:11px;margin-top:2px;">进行中 ${a.inProgress} · 待开始 ${a.pending ?? 0} · 逾期 ${a.overdue ?? 0}</div>` : ''}
      </div>`);
  }
  if (closure.durationEfficiency !== undefined) {
    cards.push(`
      <div style="flex:1; min-width:200px; padding:14px; background:#EFF6FF; border-radius:6px;">
        <div style="color:#1E40AF;font-size:12px;margin-bottom:4px;">节奏效率</div>
        <div style="color:#0F2B5B;font-size:22px;font-weight:700;">${closure.durationEfficiency}<span style="font-size:14px;">%</span></div>
      </div>`);
  }
  if (closure.focusRatio !== undefined) {
    cards.push(`
      <div style="flex:1; min-width:200px; padding:14px; background:#FAF5FF; border-radius:6px;">
        <div style="color:#6B21A8;font-size:12px;margin-bottom:4px;">议题聚焦度</div>
        <div style="color:#0F2B5B;font-size:22px;font-weight:700;">${closure.focusRatio}<span style="font-size:14px;">%</span></div>
      </div>`);
  }
  return `<div style="display:flex; gap:12px; flex-wrap:wrap;">${cards.join('')}</div>`;
}

// ============================================================
// 构造离屏 DOM
// ============================================================

function buildReportNode(report: RichMeetingReport): HTMLDivElement {
  const root = document.createElement('div');
  root.style.cssText = `
    width: 794px;
    padding: 56px 56px 56px 56px;
    background: #ffffff;
    color: #1F2937;
    font-family: "Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 14px;
    line-height: 1.75;
    box-sizing: border-box;
  `;

  // ---------- 顶部品牌条 ----------
  const brand = document.createElement('div');
  brand.style.cssText = `
    height: 36px;
    background: #0F2B5B;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    margin: -56px -56px 32px -56px;
    font-size: 13px;
  `;
  brand.innerHTML = `<span>财务办公室 · 会议纪要</span><span>生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}</span>`;
  root.appendChild(brand);

  // ---------- 大标题 ----------
  const minutes = Math.floor(report.durationSec / 60);
  const seconds = report.durationSec % 60;
  const fullTitle = `${report.meetingTitle} · 会议纪要`;
  const titleEl = document.createElement('h1');
  titleEl.style.cssText = `
    font-size: 24px;
    font-weight: 700;
    color: #0F2B5B;
    margin: 0 0 8px 0;
    line-height: 1.35;
  `;
  titleEl.textContent = fullTitle;
  root.appendChild(titleEl);

  // 副标题
  if (report.meta?.subtitle) {
    const sub = document.createElement('div');
    sub.style.cssText = `color:#6B7280; font-size:13px; margin-bottom:8px;`;
    sub.textContent = report.meta.subtitle;
    root.appendChild(sub);
  }

  // 标题下蓝色短线
  const accent = document.createElement('div');
  accent.style.cssText = `width: 80px; height: 3px; background: #0F2B5B; margin: 0 0 16px 0;`;
  root.appendChild(accent);

  // ---------- 元信息 ----------
  const metaParts: string[] = [];
  metaParts.push(`会议 ID：${escapeHtml(report.meetingId)}`);
  metaParts.push(`时长：${minutes} 分 ${seconds} 秒`);
  if (report.meta?.host) metaParts.push(`主持人：${escapeHtml(report.meta.host)}`);
  if (report.meta?.meetingType) metaParts.push(`类型：${escapeHtml(report.meta.meetingType)}`);
  if (report.meta?.confidentiality) metaParts.push(`密级：${escapeHtml(report.meta.confidentiality)}`);

  const meta = document.createElement('div');
  meta.style.cssText = `color:#6B7280; font-size:12px; line-height:1.9; margin-bottom:8px;`;
  meta.innerHTML = `<div>${metaParts.join('　　')}</div>
    <div>开始：${escapeHtml(report.startedAt)}　　结束：${escapeHtml(report.endedAt)}</div>`;
  if (report.participants && report.participants.length > 0) {
    const names = report.participants.map((p) => p.name + (p.role ? ` (${p.role})` : '')).join('、');
    meta.innerHTML += `<div>与会人员：${escapeHtml(names)}</div>`;
  }
  root.appendChild(meta);

  // 分隔线
  const divider = document.createElement('div');
  divider.style.cssText = `height: 1px; background: #E5E7EB; margin: 14px 0 24px 0;`;
  root.appendChild(divider);

  // ---------- 1. 会议概况 / 摘要 ----------
  const sec1 = document.createElement('h2');
  sec1.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 24px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
  sec1.textContent = '一、会议概况';
  root.appendChild(sec1);

  const sec1Body = document.createElement('div');
  if (typeof report.summary === 'string') {
    sec1Body.innerHTML = report.summary
      ? `<p style="margin:0 0 8px 0;">${escapeHtml(report.summary)}</p>`
      : '<p style="color:#9CA3AF;margin:0;">（无摘要）</p>';
  } else if (report.summary) {
    // 富摘要
    sec1Body.innerHTML = `
      <p style="margin:0 0 10px 0; font-size:14px;">${escapeHtml(report.summary.oneLine)}</p>
      <div style="background:#F9FAFB; padding:12px 14px; border-radius:4px; margin-bottom:8px;">
        <div style="color:#0F2B5B;font-weight:600;font-size:13px;margin-bottom:6px;">核心要点：</div>
        <ul style="margin:0; padding-left:20px;">
          ${report.summary.keyPoints.map((p) => `<li style="margin-bottom:3px;">${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
      ${report.summary.healthScore !== undefined
        ? `<div style="display:inline-block; padding:4px 12px; background:${report.summary.healthScore >= 80 ? '#F0FDF4' : '#FEF3C7'}; color:${report.summary.healthScore >= 80 ? '#15803D' : '#A16207'}; border-radius:12px; font-size:12px; font-weight:600;">会议健康度评分：${report.summary.healthScore}</div>`
        : ''}
    `;
  } else {
    sec1Body.innerHTML = '<p style="color:#9CA3AF;margin:0;">（无摘要）</p>';
  }
  root.appendChild(sec1Body);

  // ---------- 2. 关键数据（PostMeetingReport 专有） ----------
  if (report.keyData && report.keyData.length > 0) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = '二、关键数据';
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = keyDataTableBody(report.keyData);
    root.appendChild(body);
  }

  // ---------- 3. 关键决策 ----------
  if (report.sections.decisions.length > 0) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = `${report.keyData ? '三' : '二'}、关键决策（${report.sections.decisions.length}）`;
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = report.sections.decisions.map(decisionBody).join('');
    root.appendChild(body);
  }

  // ---------- 4. 待办事项 ----------
  if (report.sections.actions.length > 0) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = `${report.keyData ? '四' : '三'}、待办事项（${report.sections.actions.length}）`;
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = report.sections.actions.map(actionBody).join('');
    root.appendChild(body);
  }

  // ---------- 5. 风险预警 ----------
  if (report.sections.risks.length > 0) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = `${report.keyData ? '五' : '四'}、风险预警（${report.sections.risks.length}）`;
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = `<ul style="margin:0; padding-left:18px;">${report.sections.risks.map(riskBody).join('')}</ul>`;
    root.appendChild(body);
  }

  // ---------- 6. 议题讨论 ----------
  if (report.sections.topics.length > 0) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = `${report.keyData ? '六' : '五'}、议题讨论（${report.sections.topics.length}）`;
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = report.sections.topics.map((t, i) => topicBody(t, i)).join('');
    root.appendChild(body);
  }

  // ---------- 7. 领导讲话（PostMeetingReport 专有） ----------
  if (report.leaderRemarks && report.leaderRemarks.length > 0) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = `${report.keyData ? '七' : '六'}、领导讲话`;
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = leaderRemarksBody(report.leaderRemarks);
    root.appendChild(body);
  }

  // ---------- 8. 闭环验证（PostMeetingReport 专有） ----------
  if (report.closure) {
    const sec = document.createElement('h2');
    sec.style.cssText = `font-size: 17px; font-weight: 700; color: #0F2B5B; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #0F2B5B;`;
    sec.textContent = `${report.keyData ? '八' : '七'}、闭环验证`;
    root.appendChild(sec);

    const body = document.createElement('div');
    body.innerHTML = closureBody(report.closure);
    root.appendChild(body);
  }

  // ---------- 页脚 ----------
  const footer = document.createElement('div');
  footer.style.cssText = `margin-top:32px; padding-top:12px; border-top:1px solid #E5E7EB; color:#9CA3AF; font-size:11px; text-align:center;`;
  footer.textContent = '本报告由会议 AI 协同自动生成 · 财务办公室';
  root.appendChild(footer);

  return root;
}

// ============================================================
// 公共 API
// ============================================================

export interface PdfExportResult {
  blob: Blob;
  filename: string;
  size: number;
}

/**
 * 导出会议纪要 PDF（html2canvas 截图方案）。
 *
 * 入参兼容 GetReportResponse.data 和 PostMeetingReport 的富数据形状。
 *
 * @example
 *   await exportMeetingPDF(reportData);
 */
export async function exportMeetingPDF(
  report: RichMeetingReport | GetReportResponse['data'],
): Promise<PdfExportResult> {
  // 1) 等 webfont 加载完
  if ((document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // ignore
    }
  }

  // 2) 构造离屏 DOM
  const node = buildReportNode(report as RichMeetingReport);
  node.style.position = 'fixed';
  node.style.left = '-99999px';
  node.style.top = '0';
  node.style.zIndex = '-1';
  document.body.appendChild(node);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    });
  } finally {
    document.body.removeChild(node);
  }

  // 3) 切页生成 PDF
  const A4_WIDTH_MM = 210;
  const A4_WIDTH_PX = canvas.width;
  const A4_HEIGHT_PX = (297 / A4_WIDTH_MM) * A4_WIDTH_PX;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const totalPages = Math.max(1, Math.ceil(canvas.height / A4_HEIGHT_PX));

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();
    const pageCanvas = document.createElement('canvas');
    const pageCtx = pageCanvas.getContext('2d')!;
    pageCanvas.width = A4_WIDTH_PX;
    pageCanvas.height = A4_HEIGHT_PX;

    const sourceY = i * A4_HEIGHT_PX;
    const sourceHeight = Math.min(A4_HEIGHT_PX, canvas.height - sourceY);
    pageCtx.fillStyle = '#ffffff';
    pageCtx.fillRect(0, 0, A4_WIDTH_PX, A4_HEIGHT_PX);
    pageCtx.drawImage(
      canvas,
      0, sourceY, A4_WIDTH_PX, sourceHeight,
      0, 0, A4_WIDTH_PX, sourceHeight,
    );

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    const renderHeightMm = (sourceHeight / A4_WIDTH_PX) * A4_WIDTH_MM;
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH_MM, renderHeightMm);
  }

  // 4) 元数据
  pdf.setProperties({
    title: `${report.meetingTitle} · 会议纪要`,
    subject: '会议纪要',
    author: '财务办公室',
    creator: '财务办公室平台',
  });

  // 5) 输出 Blob + 触发下载
  const blob = pdf.output('blob');
  const safeName = report.meetingTitle.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const filename = `${safeName}-${report.meetingId}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    blob,
    filename,
    size: blob.size,
  };
}

/**
 * 仅获取 PDF Blob（不触发下载），用于上传到知识库等场景。
 */
export async function getMeetingPDFBlob(
  report: RichMeetingReport | GetReportResponse['data'],
): Promise<{ blob: Blob; filename: string; size: number }> {
  const result = await exportMeetingPDF(report);
  return { blob: result.blob, filename: result.filename, size: result.size };
}
