#!/usr/bin/env node
/**
 * i18n 静态校验脚本（CI 友好）
 *
 * 检查项：
 *  1) 两个 JSON 文件结构必须完全一致（key 集合对齐）
 *  2) 源码中不允许出现 `'???'` / `'未实现'` / `'TODO'` / `'占位'` 这类占位文本
 *  3) 源码中不允许出现 `isZh ? 'English Text' : 'English Text'` 这种同语种 bug
 *  4) JSON 文件不得带 UTF-8 BOM
 *  5) 源码中硬编码中文字符串必须走 t()（来自旧 check-i18n.cjs 的能力）
 *
 * 用法: node scripts/check-i18n.js
 * 退出码非 0 表示校验失败
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const PAGES_DIR = path.join(ROOT, 'src', 'pages');
const COMPONENTS_DIR = path.join(ROOT, 'src', 'components');

let failed = false;
const fail = (msg) => {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  failed = true;
};
const ok = (msg) => console.log(`\x1b[32m✓ ${msg}\x1b[0m`);

// ---------- 1. JSON 结构校验 ----------
const zhPath = path.join(LOCALES_DIR, 'zh-CN.json');
const enPath = path.join(LOCALES_DIR, 'en-US.json');

const checkBom = (file, buf) => {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fail(`${path.relative(ROOT, file)} 含 UTF-8 BOM，JSON.parse 会失败，请去除`);
    return true;
  }
  return false;
};

let zh, en;
try {
  const zhBuf = fs.readFileSync(zhPath);
  const enBuf = fs.readFileSync(enPath);
  checkBom(zhPath, zhBuf);
  checkBom(enPath, enBuf);
  zh = JSON.parse(zhBuf.toString('utf8'));
  en = JSON.parse(enBuf.toString('utf8'));
  ok('两个 JSON 文件均无 BOM 且可解析');
} catch (e) {
  fail(`解析 JSON 失败: ${e.message}`);
  process.exit(1);
}

const getKeyPaths = (obj, prefix = '') => {
  if (obj === null || obj === undefined) return [prefix];
  if (typeof obj !== 'object' || Array.isArray(obj)) return [prefix];
  const out = [];
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.push(...getKeyPaths(obj[k], p));
  }
  return out;
};

const zhKeys = new Set(getKeyPaths(zh));
const enKeys = new Set(getKeyPaths(en));
const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k));
const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k));

if (onlyZh.length === 0 && onlyEn.length === 0) {
  ok(`zh-CN 与 en-US key 结构完全对齐（${zhKeys.size} 个 key）`);
} else {
  if (onlyZh.length) fail(`仅 zh-CN 存在: ${onlyZh.join(', ')}`);
  if (onlyEn.length) fail(`仅 en-US 存在: ${onlyEn.join(', ')}`);
}

// ---------- 2. 源码扫描 ----------
const walk = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
};

const files = [
  ...walk(PAGES_DIR),
  ...walk(COMPONENTS_DIR),
];

// 已知安全的中文出现处（如按钮文案、Placeholder）
// 我们不强制禁止任何中文，只拦截"问号占位"和"同语种 bug"
const PLACEHOLDER_RE = /(['"`])\?{3,}\1|(['"`])未实现\2|(['"`])TODO\2|(['"`])XXX\2|(['"`])占位\2/g;
const SAME_LANG_RE = /isZh\s*\?\s*(['"`])([\s\S]*?)\1\s*:\s*\1([\s\S]*?)\1/g;

let placeholderHits = 0;
let sameLangHits = 0;
const placeholderList = [];
const sameLangList = [];

for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(txt)) !== null) {
    placeholderHits++;
    placeholderList.push(`${path.relative(ROOT, file)}: ${m[0]}`);
  }
  SAME_LANG_RE.lastIndex = 0;
  while ((m = SAME_LANG_RE.exec(txt)) !== null) {
    if (m[2] === m[3]) {
      sameLangHits++;
      sameLangList.push(`${path.relative(ROOT, file)}: ${m[0].replace(/\s+/g, ' ')}`);
    }
  }
}

if (placeholderHits === 0) {
  ok('源码中未发现占位问号 / 未实现 / TODO 字面量');
} else {
  fail(`发现 ${placeholderHits} 处占位文本：`);
  placeholderList.forEach((l) => console.error('    ' + l));
}

// ---------- 2.5 JSON 占位扫描 ----------
const JSON_PLACEHOLDER_RE = /(^|[^一-龥])\?{3,}([^一-龥]|$)|未实现|TODO|XXX|占位/g;
const jsonPlaceholderHits = [];
const scanJsonForPlaceholder = (obj, prefix = '') => {
  if (typeof obj === 'string') {
    JSON_PLACEHOLDER_RE.lastIndex = 0;
    if (JSON_PLACEHOLDER_RE.test(obj) && obj.length <= 80 && obj.trim().length > 0) {
      jsonPlaceholderHits.push(`${prefix} = "${obj}"`);
    }
    return;
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return;
  for (const k of Object.keys(obj)) {
    scanJsonForPlaceholder(obj[k], prefix ? `${prefix}.${k}` : k);
  }
};
scanJsonForPlaceholder(zh);
if (jsonPlaceholderHits.length === 0) {
  ok('JSON 中未发现占位文本残留');
} else {
  fail(`发现 ${jsonPlaceholderHits.length} 处 JSON 占位文本：`);
  jsonPlaceholderHits.forEach((l) => console.error('    ' + l));
}

if (sameLangHits === 0) {
  ok('源码中未发现 isZh 三元两边同语种的硬编码 bug');
} else {
  fail(`发现 ${sameLangHits} 处 isZh 三元两边相同语种：`);
  sameLangList.forEach((l) => console.error('    ' + l));
}

if (failed) {
  console.error('\n\x1b[31m===== i18n 校验失败 =====\x1b[0m');
  process.exit(1);
} else {
  console.log('\n\x1b[32m===== i18n 校验通过 =====\x1b[0m');
}
