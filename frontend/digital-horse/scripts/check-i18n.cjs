/**
 * i18n 检查脚本
 *
 * 检查是否有硬编码的中文字符串（排除合理的用法）
 *
 * 用法: node scripts/check-i18n.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const PAGES_DIR = path.join(ROOT_DIR, 'src', 'pages');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'src', 'components');

// 中文正则
const CHINESE_REGEX = /[\u4e00-\u9fff]+/g;

// 需要跳过的模式（这些是合法的中文用法）
const SKIP_PATTERNS = [
  // 注释中的中文
  /^\s*\/\/.*[\u4e00-\u9fff]/,
  /^\s*\/\*[\s\S]*?\*\//,
  /^.*\*\s+[\u4e00-\u9fff]/,

  // 日期格式化模式（如 'YYYY年MM月DD日'）
  /[\u4e00-\u9fff]年|[\u4e00-\u9fff]月|[\u4e00-\u9fff]日/,

  // 三元表达式中的中文（i18n 感知的 mock 数据）
  /isZh\s*\?/,
  /language\s*===\s*['"]zh-CN['"]/,

  // 中文关键词检测逻辑（业务需要）
  /\.includes\(['"][\u4e00-\u9fff]/,
  /\.toLowerCase\(\)\.includes\(['"][\u4e00-\u9fff]/,
];

function shouldSkip(line) {
  return SKIP_PATTERNS.some(pattern => pattern.test(line));
}

function checkFile(filePath) {
  const issues = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 跳过空行
    if (!line.trim()) return;

    // 跳过需要跳过的模式
    if (shouldSkip(line)) return;

    // 检查是否有硬编码中文
    if (CHINESE_REGEX.test(line)) {
      // 检查是否在 t() 函数调用中
      const inTFunction = /t\s*\([^)]*[\u4e00-\u9fff]+[^)]*\)/.test(line);
      // 检查是否是 JSX 中的纯中文文本节点
      const isJsxText = /^[^<]*>[\s]*[\u4e00-\u9fff]+[\s]*</.test(line) && !inTFunction;

      if (isJsxText) {
        const chineseMatch = line.match(/[\u4e00-\u9fff]+/g);
        issues.push({
          line: index + 1,
          content: line.trim().slice(0, 80) + (line.trim().length > 80 ? '...' : ''),
          chinese: chineseMatch ? chineseMatch.join(', ') : '中文',
        });
      }
    }
  });

  return issues;
}

function walkDir(dir) {
  const issues = [];

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    files.forEach(file => {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // 跳过特定目录
        if (!['mock', 'node_modules', '__tests__', 'test', 'locale', 'components'].includes(file)) {
          walk(filePath);
        } else if (file === 'components') {
          // 只检查 Layout 组件
          const componentsPath = path.join(currentDir, file, 'Layout');
          if (fs.existsSync(componentsPath)) {
            walk(componentsPath);
          }
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const fileIssues = checkFile(filePath);
        if (fileIssues.length > 0) {
          issues.push({
            file: path.relative(ROOT_DIR, filePath),
            issues: fileIssues,
          });
        }
      }
    });
  }

  walk(dir);
  return issues;
}

function main() {
  console.log('🔍 检查 i18n 完整性...\n');

  const allIssues = [];

  // 检查 pages 目录
  if (fs.existsSync(PAGES_DIR)) {
    console.log('📁 检查页面文件...');
    const pageIssues = walkDir(PAGES_DIR);
    allIssues.push(...pageIssues);
  }

  // 检查 components/Layout 目录
  const layoutDir = path.join(COMPONENTS_DIR, 'Layout');
  if (fs.existsSync(layoutDir)) {
    console.log('📁 检查布局组件...');
    const layoutIssues = walkDir(layoutDir);
    allIssues.push(...layoutIssues);
  }

  if (allIssues.length === 0) {
    console.log('\n✅ 没有发现硬编码中文字符串！\n');
    process.exit(0);
  } else {
    console.log(`\n❌ 发现 ${allIssues.length} 个文件存在硬编码中文：\n`);

    allIssues.forEach(({ file, issues }) => {
      console.log(`📄 ${file}`);
      issues.forEach(({ line, content, chinese }) => {
        console.log(`   第 ${line} 行: ${chinese}`);
        console.log(`   ${content}`);
        console.log('');
      });
    });

    console.log('─'.repeat(60));
    console.log('💡 修复建议：');
    console.log('   1. 将硬编码中文替换为 t("namespace.key")');
    console.log('   2. 在 zh-CN.json 和 en-US.json 中添加翻译');
    console.log('   3. 如果是 mock 数据，使用三元表达式:');
    console.log('      const text = i18n.language === "zh-CN" ? "中文" : "English"');
    console.log('');

    process.exit(1);
  }
}

main();
