# i18n 严格准则（数字马力 / Apexis 项目）

> **目标：任何一次改动后，无论切中文还是英文，UI 都必须显示真实可读的语言文本；绝不允许出现 `????`、空白、空键。**

---

## 1. 三大根因（不许重蹈覆辙）

1. **源码字面量就是 `????`**：写代码时编辑器编码错或漏字，直接在源码里落了 4 个 ASCII `?`。这跟运行时无关——它就是源码。要在 `i18n:check` 里挡住。
2. **JSON 带 UTF-8 BOM**：`EF BB BF` 开头的 JSON 会让 `JSON.parse` 同步抛 `SyntaxError`，整个 i18n 包加载失败，所有键 fallback 成空字符串，最终页面显示出空白或 fallback 文案（如 `'Demo Dept'`）显得"语言系统崩溃"。**严禁 BOM**。
3. **`isZh ? 'A' : 'A'`**：三目两边写同一语种的硬编码，会让"切换语言"看起来无效。这类 bug 必须靠脚本扫。

## 2. 硬性规则（开发必读）

### 规则 1：用户可见文案一律走 `t('key')`

```tsx
//  正确
<Title>{t('meeting.title')}</Title>

//  错误
<Title>会议详情</Title>
<Title>{isZh ? '会议详情' : 'Meeting Detail'}</Title>
```

唯一例外：纯调试、纯英文技术术语（如 `console.log`、`API URL`、第三方库自带文案）可以保留英文字面量。

### 规则 2：禁止写"占位文本"

```tsx
//  这些都会被打回
const label = '????';
const placeholder = '未实现';
const note = 'TODO';
```

如果你确实要标记未完成，写 **TODO 注释** + 一个明确的 key，但 key 的值在两个 JSON 里都用真实文本（即使临时是 "TBD — 待补充"，也比 "????" 强）。

### 规则 3：JSON 结构必须对齐

zh-CN 和 en-US 必须有**完全相同的 key 路径**。**少一个都不行**——CI 会拦截。

新增/重命名/删除 key 时，**两个文件必须同步提交**。

### 规则 4：JSON 文件必须无 BOM

用 IDE 把"UTF-8 BOM"改成"UTF-8"。`i18n:check` 会自动检测并报错。

### 规则 5：禁止 `isZh` 三元硬编码

```tsx
//  反例（两边都是英文，切换语言无效）
{isZh ? 'AI Assistant' : 'AI Assistant'}

//  走 t()
{t('login.featureAi')}
```

如果不可避免要写组件本地分支（如 mock 数据生成），使用统一辅助：

```ts
import { appText } from '@/i18n';
const label = appText(isZh, '正在加载', 'Loading');
```

### 规则 6：语言切换走 `changeLanguage`

```ts
import { changeLanguage, SUPPORTED_LANGUAGES } from '@/i18n';
changeLanguage('zh-CN'); // 或 'en-US'
```

只有这两个值合法；其它值在 dev 环境会 `console.error` 并被忽略。

## 3. 工具链

| 命令 | 作用 |
|---|---|
| `npm run i18n:check` | 跑全套校验：JSON 结构对齐 / BOM 检测 / 占位文本检测 / 同语种 bug 检测 |
| `npm run i18n:fix:placeholders` | 一键把 `'????'` 替换为合理中文（仅 Login 页） |

`scripts/check-i18n.js` 同时挂在 `scripts/pre-commit`（项目内已有 hook），**提交前必须过**。

## 4. CI / 提交检查流程

```
git commit
   │
   ├─ pre-commit hook
   │     └─ node scripts/check-i18n.js
   │           ├─ 解析失败 → 拒绝提交
   │           ├─ BOM → 拒绝提交
   │           ├─ key 不齐 → 拒绝提交
   │           ├─ 占位 ???? → 拒绝提交
   │           └─ isZh 同语种 → 拒绝提交
   ↓
commit 完成
```

## 5. 应急处理

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面大量空白 | JSON 解析失败（多为 BOM） | `i18n:check` 会立刻指出 |
| 切语言没反应 | `isZh ? 'X' : 'X'` 三元两边同语种 | `i18n:check` 会扫出 |
| `????` 出现 | 源码字面量 | `i18n:fix:placeholders` 一键修 |
| 启动时控制台红字 | 启动期结构校验失败 | 直接看红字补齐 key |

## 6. i18n 系统自检（已落地）

- 启动期静态校验 `src/i18n/index.ts` —— 两个 JSON 结构不一致时**直接抛错**，不会带病运行。
- `parseMissingKeyHandler` —— 缺 key 不返回空，console.warn + 返回 key 本身，便于发现。
- `fallbackLng: false` —— 不允许 fallback 掩盖 key 缺失。
- 显式类型 `SupportedLanguage` + `SUPPORTED_LANGUAGES` 数组 —— 防止打错字符串。
- `changeLanguage` 拒绝非法语言值。

---

**修改任何用户可见文案前，请先确保 t() 的 key 在两个 JSON 里都已定义，然后跑 `npm run i18n:check`。**
