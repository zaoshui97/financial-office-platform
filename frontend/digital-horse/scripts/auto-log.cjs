#!/usr/bin/env node
/**
 * 自动记录开发日志（增强版）
 *
 * 改动自动抽取能力：
 *   - 函数签名（export function / const xxx = (... ) => / method() {）
 *   - 接口路径（/api/v1/xxx、fetch(...)、axios.{get,post,...}）
 *   - 新增/删除的 key（zh-CN / en-US JSON）
 *   - i18n key（t('xxx.yyy')）
 *   - 关键字面量变化（'????' → '登录成功' 这种）
 *   - 修复 / 新增 / 删除 关键字
 *
 * 输出格式：每个 commit 一条 entry，按日期聚合，包含
 *   1. 时间戳 + 责任人
 *   2. 触及文件清单 + +/- 行数
 *   3. 按类别分组的改动
 *   4. 自动抽取的"功能摘要"（人话）
 *   5. 自动关联到"场景"或"材料条目"（如果命中关键词）
 *
 * 调用：pre-commit hook，也支持 --print-only 模式只输出不写文件
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LOG = path.join(ROOT, 'docs/delivery/dev-log.md');

const PRINT_ONLY = process.argv.includes('--print-only');

const sh = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', ...opts }).trim();
  } catch {
    return '';
  }
};

// ---------- 基础信息 ----------
const author = sh('git config user.name') || 'unknown';
const now = new Date();
const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

// ---------- 文件 ----------
const stagedRaw = sh('git diff --cached --name-only');
const unstagedRaw = sh('git diff --name-only');
const allFiles = [...new Set(
  (stagedRaw ? stagedRaw.split('\n') : [])
    .concat(unstagedRaw ? unstagedRaw.split('\n') : [])
    .filter(Boolean)
)];

// dev-log.md 自身不算"业务改动"
const businessFiles = allFiles.filter((f) => f !== 'docs/delivery/dev-log.md');

const fileStats = {};
for (const f of businessFiles) {
  const stat = sh(`git diff --numstat -- "${f}"`) || sh(`git diff --cached --numstat -- "${f}"`);
  if (stat) {
    const [add, del] = stat.split('\t');
    fileStats[f] = { add: Number(add) || 0, del: Number(del) || 0 };
  } else {
    fileStats[f] = { add: 0, del: 0 };
  }
}

const categorize = (f) => {
  if (f.startsWith('src/pages/')) return '页面';
  if (f.startsWith('src/components/')) return '组件';
  if (f.startsWith('src/api/')) return 'API 接入';
  if (f.startsWith('src/store/')) return '状态层';
  if (f.startsWith('src/i18n/') || /zh-CN\.json|en-US\.json/.test(f)) return '国际化';
  if (f.startsWith('src/mock/')) return 'Mock 数据';
  if (f.startsWith('docs/delivery/')) return '交付记录';
  if (f.startsWith('docs/')) return '文档';
  if (f.startsWith('scripts/')) return '脚本 / 工程化';
  if (/^\.husky|\.gitignore|package\.json|tsconfig|vite\.config|\.eslintrc|\.prettierrc/.test(f)) return '工程配置';
  return '其他';
};

const grouped = {};
for (const f of businessFiles) {
  (grouped[categorize(f)] = grouped[categorize(f)] || []).push(f);
}

// ---------- 自动抽取 diff 中的关键信息 ----------
const extractors = [
  {
    name: 'API 路径',
    re: /(['"`])\/api\/v1\/[a-zA-Z0-9_\-\/{}\$\:]+?\1/g,
  },
  {
    name: 'HTTP 方法调用',
    re: /\b(axios|fetch|request)\.(get|post|put|delete|patch)\s*\(\s*(['"`])([^'"`]+)\3/gi,
    replace: (m) => m,
  },
  {
    name: 'i18n key',
    re: /t\(\s*['"`]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"`]\s*\)/g,
  },
  {
    name: '导出函数',
    re: /export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
  },
  {
    name: '导出常量',
    re: /export\s+const\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
  },
  {
    name: '导出接口',
    re: /export\s+(interface|type)\s+([A-Z][a-zA-Z0-9_]*)/g,
  },
  {
    name: '新增 i18n 字段',
    re: /"([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)"\s*:\s*"([^"]{2,})"/g,
  },
];

const findings = {};
const limit = 8; // 每个类别最多记录 8 条

for (const f of businessFiles) {
  if (!/\.(ts|tsx|js|jsx|json)$/.test(f)) continue;
  let txt = '';
  try {
    txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  for (const ex of extractors) {
    const matches = [...new Set((txt.match(ex.re) || []).slice(0, limit))];
    if (matches.length) {
      findings[ex.name] = findings[ex.name] || new Set();
      matches.forEach((m) => findings[ex.name].add(m));
    }
  }
}

// ---------- 关键词 → 自动关联到"上交材料" ----------
const MATERIAL_KEYS = {
  '会议': '材料 5（场景分析）/ 材料 4（演示视频重点场景 1）',
  'meeting': '材料 5（场景分析）/ 材料 4（演示视频重点场景 1）',
  '知识库': '材料 6（知识库设计方案）',
  'knowledge': '材料 6（知识库设计方案）',
  '文档生成': '材料 5（场景分析）',
  'document': '材料 5（场景分析）',
  'Agent': '材料 4（演示视频重点场景 2：多 Agent 协作）',
  '多智能体': '材料 4（演示视频重点场景 2）',
  'i18n': '材料 3（使用说明书 - 多语言）',
  '国际化': '材料 3（使用说明书 - 多语言）',
  '登录': '材料 3（产品原型说明）',
  '权限': '材料 2（系统设计 - 权限管控）',
  '指标': '材料 7（流程提效分析）',
  'metrics': '材料 7（流程提效分析）',
};

const allText = businessFiles.join(' ').toLowerCase();
const materials = new Set();
for (const [k, v] of Object.entries(MATERIAL_KEYS)) {
  if (allText.includes(k.toLowerCase())) materials.add(v);
}

// ---------- 组装 entry ----------
let entry = `\n### ${todayISO} ${timeStr}  @${author}\n\n`;
entry += `- **触及文件**: ${businessFiles.length} 个（+${Object.values(fileStats).reduce((a, b) => a + b.add, 0)} / -${Object.values(fileStats).reduce((a, b) => a + b.del, 0)}）\n`;

if (Object.keys(grouped).length === 0) {
  entry += `- 仅文档维护\n`;
} else {
  for (const cat of Object.keys(grouped)) {
    entry += `- **${cat}**（${grouped[cat].length}）：\n`;
    for (const f of grouped[cat]) {
      const { add, del } = fileStats[f] || { add: 0, del: 0 };
      entry += `  - \`${f}\`  (+${add} / -${del})\n`;
    }
  }
}

// 自动功能摘要
if (Object.keys(findings).length > 0) {
  entry += `\n**自动检测到的改动摘要：**\n`;
  for (const name of Object.keys(findings)) {
    const arr = [...findings[name]];
    if (arr.length) {
      entry += `- ${name}：\n`;
      arr.slice(0, limit).forEach((m) => {
        entry += `  - ${m.length > 120 ? m.slice(0, 117) + '...' : m}\n`;
      });
    }
  }
}

// 自动关联材料
if (materials.size > 0) {
  entry += `\n**关联上交材料条目**：${[...materials].join('；')}\n`;
}

entry += `\n<!-- 自动补充：本次改动意图、决策理由、踩坑记录（可在 commit 后手动补，也可在 commit message 中写详细内容） -->\n`;
entry += `<!-- commit msg: ${(process.env.GIT_COMMIT_MSG || sh('git log -1 --format=%s') || '').slice(0, 200)} -->\n`;

if (PRINT_ONLY) {
  console.log(entry);
  process.exit(0);
}

// ---------- 写入 ----------
let log = fs.readFileSync(LOG, 'utf8');
const startTag = '<!-- AUTO:ENTRY-START -->';
const endTag = '<!-- AUTO:ENTRY-END -->';
const idxS = log.indexOf(startTag);
const idxE = log.indexOf(endTag);

if (idxS === -1 || idxE === -1) {
  console.error('[auto-log] docs/delivery/dev-log.md 缺少 AUTO 标记');
  process.exit(1);
}

const before = log.slice(0, idxS + startTag.length);
const middle = log.slice(idxS + startTag.length, idxE);
const after = log.slice(idxE);

fs.writeFileSync(LOG, before + middle + entry + after);
sh('git add docs/delivery/dev-log.md');
console.log(`[auto-log] 已记录 ${businessFiles.length} 个改动文件，责任人 @${author}`);
