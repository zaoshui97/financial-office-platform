const fs = require('fs');
const path = require('path');
function walk(d) {
  const o = [];
  if (!fs.existsSync(d)) return o;
  for (const n of fs.readdirSync(d)) {
    const x = path.join(d, n);
    if (fs.statSync(x).isDirectory()) o.push(...walk(x));
    else if (/\.(ts|tsx)$/.test(x)) o.push(x);
  }
  return o;
}
const fs2 = [...walk('src/pages'), ...walk('src/components')];
let total = 0;
for (const f of fs2) {
  const t = fs.readFileSync(f, 'utf8');
  const m = t.match(/(['"`])\?{2,}\1/g) || [];
  if (m.length) {
    total += m.length;
    console.log(f, m.length, 'hits');
  }
}
console.log('TOTAL', total);
