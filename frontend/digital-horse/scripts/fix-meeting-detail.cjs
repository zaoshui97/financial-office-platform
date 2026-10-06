/**
 * MeetingDetail 临时清理脚本
 * 把整文件里所有 '????'、'???'、'??' 占位字面量（ASCII ? 重复）替换为合理英文
 * 中文显示走 i18n key（这部分后续在源码中替换）
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const p = path.join(ROOT, 'src/pages/Meeting/MeetingDetail.tsx');
let t = fs.readFileSync(p, 'utf8');

const before = t.length;
let count = 0;

// 统计：先看看所有连续 ? 的长度
const runLens = [];
const re = /(['"`])(\?{2,})\1/g;
let m;
while ((m = re.exec(t)) !== null) {
  runLens.push(m[2].length);
}
console.log('替换前，匹配统计:', runLens.length, '处, 长度分布:', JSON.stringify(
  runLens.reduce((a, l) => { a[l] = (a[l] || 0) + 1; return a; }, {})
));

// 通用占位（注释、纯英文不翻译的位置）
const commentRe = /^.*\/\/.*\?{2,}.*$/gm;
t = t.replace(commentRe, (line) => {
  count++;
  return line.replace(/\?{2,}/g, 'mock data');
});

const blockCommentRe = /\/\*[\s\S]*?\?{2,}[\s\S]*?\*\//g;
t = t.replace(blockCommentRe, (block) => {
  count++;
  return block.replace(/\?{2,}/g, 'mock data');
});

// JSX 注释 {/* ... */}
const jsxCommentRe = /\{\/\*[\s\S]*?\?{2,}[\s\S]*?\*\/\}/g;
t = t.replace(jsxCommentRe, (block) => {
  count++;
  return block.replace(/\?{2,}/g, 'mock data');
});

// 模板字符串内、对象值、JSX 文本（最后兜底）
const stringRe = /(['"`])(\?{2,})\1/g;
t = t.replace(stringRe, () => {
  count++;
  return "'TBD'";
});

console.log(`替换 ${count} 处，文件 ${before} -> ${t.length} 字节`);
fs.writeFileSync(p, t);
