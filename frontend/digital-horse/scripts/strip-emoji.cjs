#!/usr/bin/env node
/**
 * 清理 markdown / i18n / 注释 / 注释字符串里的 emoji 和杂项符号
 *
 * 清理范围：
 *   \u{1F300}-\u{1FAFF}   杂项符号与象形文字（含 emoji）
 *   \u{2600}-\u{27BF}     杂项符号（含 ★ ☆ ⚠ ⚡ 等）
 *   \u{2700}-\u{27BF}     装饰符号（丁字尺、铅笔等）
 *
 * 不动：
 *   中文 / 英文 / 数字 / ASCII 标点
 *
 * 用法：
 *   node scripts/strip-emoji.cjs <file1> [file2] ...
 *   node scripts/strip-emoji.cjs docs/    (递归遍历)
 */

const fs = require('fs');
const path = require('path');

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]/gu;

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error('用法: node scripts/strip-emoji.cjs <file-or-dir>...');
  process.exit(1);
}

function* walk(p) {
  const stat = fs.statSync(p);
  if (stat.isFile()) {
    yield p;
  } else if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(p)) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry.startsWith('.bak')) continue;
      yield* walk(path.join(p, entry));
    }
  }
}

const EXTS = new Set(['.md', '.json', '.ts', '.tsx', '.css', '.js', '.cjs', '.mjs']);

let totalFiles = 0;
let totalReplaced = 0;

for (const t of targets) {
  for (const f of walk(t)) {
    const ext = path.extname(f).toLowerCase();
    if (!EXTS.has(ext)) continue;

    let content = fs.readFileSync(f, 'utf8');
    const before = content.length;
    const matches = content.match(EMOJI_RE);
    if (!matches || matches.length === 0) continue;

    content = content.replace(EMOJI_RE, '');
    fs.writeFileSync(f, content, 'utf8');
    totalFiles += 1;
    totalReplaced += matches.length;
    console.log(`${f} : 移除 ${matches.length} 个`);
  }
}

console.log(`\n完成：处理 ${totalFiles} 个文件，共移除 ${totalReplaced} 个 emoji / 符号字符`);
