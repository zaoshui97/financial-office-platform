/**
 * 研报导出 PDF 工具
 *
 * 实现策略：html2canvas 把离屏 DOM 渲染成图片 → 嵌入 PDF。
 * - 优势：中文由浏览器渲染，WPS/Adobe/Edge 100% 都能看（不依赖 PDF 字体嵌入）
 * - 字体栈：Noto Sans SC → 思源黑体 → 微软雅黑 → PingFang SC → 系统 fallback
 * - 文档要求：document.fonts.ready 等待 webfont 加载完
 *
 * 历史：
 *   v1. jsPDF + NotoSansSC-Subset.ttf 嵌入：部分 WPS 报 U+XXXX 编码
 *   v2. html2canvas 截图嵌入（当前）：所见即所得
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ReportSection {
  title: string;
  content: string;
  type: 'text' | 'table' | 'chart';
}

export interface ReportData {
  title: string;
  /** 如果是会议报告，传会议名；会自动拼成"{meetingTitle} · 会议纪要" */
  meetingTitle?: string;
  sections: ReportSection[];
  generatedAt: string;
  wordCount: number;
  templateName?: string;
}

export interface ExportOptions {
  /** 报告作者/部门，可选，PDF metadata */
  author?: string;
  /** 公司名，PDF 顶部 logo 旁显示 */
  company?: string;
  /** 报告类型名（如"基金行业季报"） */
  templateName?: string;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 把 report 数据序列化为离屏 DOM 节点。
 * A4 实际像素宽（794px @ 96dpi）保证 html2canvas 按 A4 比例切图。
 */
function buildReportNode(
  report: ReportData,
  options: ExportOptions,
): HTMLDivElement {
  const { company = '财务办公室', templateName } = options;
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
  const tag = templateName || report.templateName || '研报';
  brand.innerHTML = `<span>${escapeHtml(company)}</span><span>${escapeHtml(tag)}</span>`;
  root.appendChild(brand);

  // ---------- 大标题 ----------
  const isMeetingReport =
    report.meetingTitle ||
    (templateName && /会议/.test(templateName)) ||
    (report.templateName && /会议/.test(report.templateName));
  const displayTitle = isMeetingReport
    ? `${report.meetingTitle || report.title} · 会议纪要`
    : report.title;

  const titleEl = document.createElement('h1');
  titleEl.style.cssText = `
    font-size: 24px;
    font-weight: 700;
    color: #0F2B5B;
    margin: 0 0 8px 0;
    line-height: 1.35;
  `;
  titleEl.textContent = displayTitle;
  root.appendChild(titleEl);

  // 标题下蓝色短线
  const accent = document.createElement('div');
  accent.style.cssText = `width: 80px; height: 3px; background: #0F2B5B; margin: 0 0 16px 0;`;
  root.appendChild(accent);

  // ---------- 元信息 ----------
  const meta = document.createElement('div');
  meta.style.cssText = `color: #6B7280; font-size: 12px; line-height: 1.9; margin-bottom: 14px;`;
  const metaLine1 = `生成时间：${escapeHtml(report.generatedAt)}　　章节：${report.sections.length} 个　　字数：${report.wordCount}`;
  meta.innerHTML = `<div>${metaLine1}</div>` +
    (tag ? `<div>报告类型：${escapeHtml(tag)}　　生成单位：${escapeHtml(company)}</div>` : `<div>生成单位：${escapeHtml(company)}</div>`);
  root.appendChild(meta);

  // 分隔线
  const divider = document.createElement('div');
  divider.style.cssText = `height: 1px; background: #E5E7EB; margin: 14px 0 24px 0;`;
  root.appendChild(divider);

  // ---------- 各 section ----------
  for (const sec of report.sections) {
    const secTitle = document.createElement('h2');
    secTitle.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: #0F2B5B;
      margin: 24px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 2px solid #0F2B5B;
    `;
    secTitle.textContent = sec.title;
    root.appendChild(secTitle);

    const secBody = document.createElement('div');
    secBody.style.cssText = 'margin: 0;';
    // 按双换行分段
    const paragraphs = sec.content.split(/\n\s*\n/);
    secBody.innerHTML = paragraphs
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p style="margin:0 0 10px 0;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
      .join('');
    root.appendChild(secBody);
  }

  return root;
}

/**
 * 渲染研报到 PDF 并触发浏览器下载。
 *
 * @example
 *   await exportReportToPdf(report, { company: '财务办公室' });
 */
export async function exportReportToPdf(
  report: ReportData,
  options: ExportOptions = {},
): Promise<void> {
  // 1) 等 webfont 加载完
  if ((document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // ignore
    }
  }

  // 2) 构造离屏 DOM
  const node = buildReportNode(report, options);
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
    title: report.title,
    subject: options.templateName || report.templateName || '研报',
    author: options.author || '财务办公室',
    creator: '财务办公室平台',
  });

  // 5) 下载
  const safeName = report.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  const filename = `${safeName}_${Date.now()}.pdf`;
  pdf.save(filename);
}
