const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// 一键把 ???? 占位字面量在源码里替换成真实中文 / 英文
const replacements = [
  // [file, regex, replacementZh, replacementEn]
  [
    'src/pages/Login/index.tsx',
    /'\?{4}'/g,
    '登录成功',
    'Login Success',
  ],
  [
    'src/pages/Login/index.tsx',
    /isZh \? '\?{4}' : 'Demo Dept'/g,
    "isZh ? '演示部门' : 'Demo Dept'",
    "isZh ? '演示部门' : 'Demo Dept'",
  ],
];

for (const [file, regex, zh, en] of replacements) {
  const p = path.join(ROOT, file);
  let t = fs.readFileSync(p, 'utf8');
  if (regex.test(t)) {
    t = t.replace(regex, zh);
    fs.writeFileSync(p, t);
    console.log(`✓ ${file}: replaced placeholder with "${zh}"`);
  }
  regex.lastIndex = 0;
}

console.log('\n=== 剩余 ???? 字面量 ===');
function walk(dir) {
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const x = path.join(dir, n);
    const s = fs.statSync(x);
    if (s.isDirectory()) out.push(...walk(x));
    else if (/\.(ts|tsx)$/.test(x)) out.push(x);
  }
  return out;
}
const files = [...walk(path.join(ROOT, 'src', 'pages')), ...walk(path.join(ROOT, 'src', 'components'))];
let total = 0;
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  const matches = txt.match(/(['"`])\?{3,}\1/g) || [];
  if (matches.length) {
    total += matches.length;
    console.log(`  ${path.relative(ROOT, f)}: ${matches.length} hits`);
  }
}
console.log(`剩余 ${total} 处。`);
