#!/usr/bin/env node
// i18n 自动改写工具
// 扫描 src/**/*.tsx，把 isZh ? '中文' : 'English' 替换为 t('auto.N')，
// 同时把 key 自动加入 zh-CN.json 和 en-US.json
// 备份：每个被改写的文件保存为 .bak.rewrite

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ZH_JSON = path.join(SRC, 'i18n/locales/zh-CN.json');
const EN_JSON = path.join(SRC, 'i18n/locales/en-US.json');

const isZhRe = /isZh\s*\?\s*('([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)")\s*:\s*('([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)")/g;

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f) && !f.endsWith('.bak')) out.push(p);
  }
  return out;
}

const zh = JSON.parse(fs.readFileSync(ZH_JSON, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));

// 平铺 keys
function flatten(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(out, flatten(obj[k], p));
    } else {
      out[p] = obj[k];
    }
  }
  return out;
}
function setKey(obj, key, val) {
  const parts = key.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = val;
}
function getKey(obj, key) {
  return key.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

// 通过 value 反查 key
const zhFlat = flatten(zh);
const enFlat = flatten(en);

function findKeyByValue(flat, value) {
  for (const k of Object.keys(flat)) {
    if (flat[k] === value) return k;
  }
  return null;
}

let totalReplacements = 0;
let newKeysAdded = 0;

for (const file of walk(SRC)) {
  if (file.endsWith('.i18n.ts') || file.includes('/i18n/')) continue;
  let txt = fs.readFileSync(file, 'utf8');
  let changed = false;
  const matches = [...txt.matchAll(isZhRe)];
  if (!matches.length) continue;

  // 备份
  fs.writeFileSync(file + '.bak.rewrite', txt);

  // 反向遍历避免索引错乱
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const zhVal = m[2] !== undefined ? m[2].replace(/\\'/g, "'") : m[3].replace(/\\"/g, '"');
    const enVal = m[5] !== undefined ? m[5].replace(/\\'/g, "'") : m[6].replace(/\\"/g, '"');

    let key = findKeyByValue(zhFlat, zhVal);
    if (!key) {
      // 用 .auto.N 命名，N = 已有的数量
      let autoN = 0;
      for (const k of Object.keys(zhFlat)) {
        const m2 = k.match(/^auto\.(\d+)/);
        if (m2) autoN = Math.max(autoN, parseInt(m2[1], 10));
      }
      autoN++;
      key = `auto.${autoN}`;
      setKey(zh, key, zhVal);
      setKey(en, key, enVal);
      zhFlat[key] = zhVal;
      enFlat[key] = enVal;
      newKeysAdded++;
    } else {
      // 已有 key，确保 en 也对齐
      if (enFlat[key] !== enVal) {
        setKey(en, key, enVal);
        enFlat[key] = enVal;
      }
    }

    // 替换源码：`isZh ? 'A' : 'B'` -> `t('auto.N')`
    const replacement = `t('${key}')`;
    txt = txt.slice(0, m.index) + replacement + txt.slice(m.index + m[0].length);
    totalReplacements++;
    changed = true;
  }

  if (changed) fs.writeFileSync(file, txt);
  console.log(`[rewrite] ${path.relative(ROOT, file)}  ${matches.length} 处`);
}

fs.writeFileSync(ZH_JSON, JSON.stringify(zh, null, 2) + '\n');
fs.writeFileSync(EN_JSON, JSON.stringify(en, null, 2) + '\n');

console.log(`\n合计：替换 ${totalReplacements} 处，新增 key ${newKeysAdded} 个`);
console.log(`注意：备份在 .bak.rewrite，验证后可删除`);
