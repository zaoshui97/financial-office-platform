/**
 * PDF 导出 Service
 *
 * 设计原则：
 *   - UI 组件只调 exportMeetingPDF(report)，不直接 import jspdf
 *   - 函数内部封装 jsPDF 的所有 API，方便未来替换为 Puppeteer / 后端生成
 *
 * 真实后端场景建议：把 PDF 生成放后端（jsPDF 中文支持差），
 * 前端只调 POST /api/v1/reports/pdf 拿 URL
 */

import jsPDF from 'jspdf';
import type { GetReportResponse } from './meetingApiContract';

// ============================================================
// Helper
// ============================================================

// 使用 jsPDF 默认字体（不嵌入中文字体，避免体积爆炸）
// 真实场景中文本由后端生成 PDF 嵌入中文字体
const FONT_REGULAR = 'helvetica';
const COLOR_PRIMARY = '#0F2B5B';
const COLOR_TEXT = '#1F2937';
const COLOR_MUTED = '#6B7280';
const COLOR_SUCCESS = '#10B981';
const COLOR_WARNING = '#F59E0B';
const COLOR_DANGER = '#EF4444';

function setText(pdf: jsPDF, opts: { size?: number; style?: 'normal' | 'bold'; color?: string }) {
  pdf.setFont(FONT_REGULAR, opts.style || 'normal');
  pdf.setFontSize(opts.size || 10);
  pdf.setTextColor(opts.color || COLOR_TEXT);
}

function checkPageBreak(pdf: jsPDF, y: number, needed: number, margin: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed > pageHeight - margin) {
    pdf.addPage();
    return margin;
  }
  return y;
}

// ============================================================
// 导出主函数
// ============================================================

export interface PdfExportResult {
  blob: Blob;
  filename: string;
  size: number;
}

export async function exportMeetingPDF(
  report: GetReportResponse['data']
): Promise<PdfExportResult> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ============================================================
  // 封面头部（品牌条）
  // ============================================================
  pdf.setFillColor(COLOR_PRIMARY);
  pdf.rect(0, 0, pageWidth, 30, 'F');
  pdf.setTextColor('#FFFFFF');
  pdf.setFont(FONT_REGULAR, 'bold');
  pdf.setFontSize(18);
  pdf.text('Digital Horse Meeting Report', margin, 18);

  pdf.setFont(FONT_REGULAR, 'normal');
  pdf.setFontSize(9);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 18, {
    align: 'right',
  });

  y = 45;

  // ============================================================
  // 会议元信息
  // ============================================================
  setText(pdf, { size: 16, style: 'bold', color: COLOR_PRIMARY });
  pdf.text(report.meetingTitle, margin, y);
  y += 8;

  setText(pdf, { size: 9, color: COLOR_MUTED });
  pdf.text(`Meeting ID: ${report.meetingId}`, margin, y);
  y += 5;
  pdf.text(`Started: ${report.startedAt}`, margin, y);
  y += 5;
  pdf.text(`Ended:   ${report.endedAt}`, margin, y);
  y += 5;
  pdf.text(`Duration: ${Math.floor(report.durationSec / 60)} min ${report.durationSec % 60} sec`, margin, y);
  y += 10;

  // ============================================================
  // 分隔线
  // ============================================================
  pdf.setDrawColor('#E5E7EB');
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ============================================================
  // 摘要
  // ============================================================
  y = checkPageBreak(pdf, y, 30, margin);
  setText(pdf, { size: 13, style: 'bold', color: COLOR_PRIMARY });
  pdf.text('Summary', margin, y);
  y += 7;

  if (report.summary) {
    setText(pdf, { size: 9 });
    const summaryLines = pdf.splitTextToSize(report.summary.slice(0, 800), contentWidth);
    pdf.text(summaryLines, margin, y);
    y += summaryLines.length * 5;
  } else {
    setText(pdf, { size: 9, color: COLOR_MUTED });
    pdf.text('(No summary)', margin, y);
    y += 5;
  }
  y += 5;

  // ============================================================
  // 关键决策
  // ============================================================
  y = checkPageBreak(pdf, y, 30, margin);
  setText(pdf, { size: 13, style: 'bold', color: COLOR_PRIMARY });
  pdf.text(`Key Decisions (${report.sections.decisions.length})`, margin, y);
  y += 7;

  if (report.sections.decisions.length === 0) {
    setText(pdf, { size: 9, color: COLOR_MUTED });
    pdf.text('(No decisions recorded)', margin, y);
    y += 5;
  } else {
    report.sections.decisions.forEach((d, i) => {
      y = checkPageBreak(pdf, y, 16, margin);
      setText(pdf, { size: 10, style: 'bold' });
      pdf.text(`${i + 1}. ${d.topic}`, margin, y);
      y += 5;
      setText(pdf, { size: 9 });
      const decisionLines = pdf.splitTextToSize(d.decision, contentWidth - 5);
      pdf.text(decisionLines, margin + 5, y);
      y += decisionLines.length * 5;
      setText(pdf, { size: 8, color: COLOR_MUTED });
      pdf.text(`Owner: ${d.owner}  |  Confidence: ${(d.confidence * 100).toFixed(0)}%`, margin + 5, y);
      y += 7;
    });
  }
  y += 3;

  // ============================================================
  // 待办事项
  // ============================================================
  y = checkPageBreak(pdf, y, 30, margin);
  setText(pdf, { size: 13, style: 'bold', color: COLOR_PRIMARY });
  pdf.text(`Action Items (${report.sections.actions.length})`, margin, y);
  y += 7;

  if (report.sections.actions.length === 0) {
    setText(pdf, { size: 9, color: COLOR_MUTED });
    pdf.text('(No action items)', margin, y);
    y += 5;
  } else {
    report.sections.actions.forEach((a, i) => {
      y = checkPageBreak(pdf, y, 14, margin);
      const priorityColor =
        a.priority === 'high' ? COLOR_DANGER : a.priority === 'medium' ? COLOR_WARNING : COLOR_SUCCESS;
      setText(pdf, { size: 9, style: 'bold', color: priorityColor });
      pdf.text(`[${a.priority.toUpperCase()}]`, margin, y);
      setText(pdf, { size: 9, color: COLOR_TEXT });
      const descLines = pdf.splitTextToSize(a.description, contentWidth - 18);
      pdf.text(descLines, margin + 14, y);
      y += Math.max(descLines.length * 5, 5);
      setText(pdf, { size: 8, color: COLOR_MUTED });
      pdf.text(
        `Assignee: ${a.assignee}  |  Due: ${a.dueDate}  |  Status: ${a.status}`,
        margin + 14,
        y
      );
      y += 6;
    });
  }
  y += 3;

  // ============================================================
  // 风险
  // ============================================================
  if (report.sections.risks.length > 0) {
    y = checkPageBreak(pdf, y, 30, margin);
    setText(pdf, { size: 13, style: 'bold', color: COLOR_PRIMARY });
    pdf.text(`Risks (${report.sections.risks.length})`, margin, y);
    y += 7;

    report.sections.risks.forEach((r) => {
      y = checkPageBreak(pdf, y, 10, margin);
      setText(pdf, { size: 9, color: COLOR_DANGER });
      pdf.text('!', margin, y);
      setText(pdf, { size: 9 });
      const riskLines = pdf.splitTextToSize(r, contentWidth - 5);
      pdf.text(riskLines, margin + 5, y);
      y += riskLines.length * 5 + 2;
    });
    y += 3;
  }

  // ============================================================
  // 议题
  // ============================================================
  if (report.sections.topics.length > 0) {
    y = checkPageBreak(pdf, y, 20, margin);
    setText(pdf, { size: 13, style: 'bold', color: COLOR_PRIMARY });
    pdf.text(`Topics (${report.sections.topics.length})`, margin, y);
    y += 7;

    report.sections.topics.forEach((t) => {
      setText(pdf, { size: 9 });
      pdf.text(`# ${t}`, margin, y);
      y += 5;
    });
    y += 3;
  }

  // ============================================================
  // 页脚（每页）
  // ============================================================
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont(FONT_REGULAR, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(COLOR_MUTED);
    pdf.text(
      `Digital Horse Meeting Report  |  ${report.meetingId}`,
      margin,
      pageHeight - 8
    );
    pdf.text(`Page ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    });
  }

  // ============================================================
  // 输出 Blob
  // ============================================================
  const blob = pdf.output('blob');
  const filename = `${report.meetingTitle}-${report.meetingId}.pdf`;

  // 触发浏览器下载
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

// ============================================================
// 仅获取 PDF Blob（不触发下载）
// 用于预览、嵌入、上传
// ============================================================

export async function buildMeetingPDFBlob(
  report: GetReportResponse['data']
): Promise<Blob> {
  const result = await exportMeetingPDF(report);
  return result.blob;
}
