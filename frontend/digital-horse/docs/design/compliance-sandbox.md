# 合规沙箱深化设计文档（分级 / 法规 / 回执 / 批量回扫）

> 修订时间：2026-09-18
> 适用版本：v1.1+

---

## 一、设计目标

1. **分级可视化**：把"warning / pass / fail / aml"严重度清晰呈现给业务人员
2. **法规引用真实可查**：命中规则必须能点开看到真实法规条款 + 处罚标准
3. **审计证据完整**：每次检测生成"合规回执"，可作为合规审计凭证
4. **批量能力**：合规专员能对历史研报 / 工单做批量回扫，输出体检报告

---

## 二、沙箱检测能力矩阵

| 能力 | 实现位置 | 状态 |
|---|---|---|
| 单文本检测 | `runSandboxCheck()` |  已实现 |
| 命中规则列表 | `result.issues[]` |  已实现 |
| 评分圆环 | `<ScoreRing>` |  已实现 |
| 原文高亮 | `<RuleHighlight>` |  已实现 |
| AI 改写建议 | `result.rewritten` |  已实现 |
| 法规引用（条目级） | `<RegulationPanel>`（深化） |  已实现 |
| 合规回执 | `generateReceipt()` + `<ComplianceReceiptCard>` |  已实现 |
| 批量回扫 | `<BatchComplianceScanPanel>` |  已实现 |
| 实时日志流 | `sandboxLogStore` |  已实现 |
| 历史审计 CSV 导出 | `exportSandboxLogCsv()` |  已实现 |

---

## 三、分级检测（Severity）

合规沙箱内置 3 级严重度：

| 级别 | 颜色 | 行为 |
|---|---|---|
| `block`（阻断） | 红 | 禁止导出 / 提交 / 派发 |
| `warn`（警告） | 黄 | 允许操作，但提示人工复核 |
| `pass`（通过） | 绿 | 正常 |

### 3.1 阻断规则示例

| 规则 ID | 名称 | 触发关键词 |
|---|---|---|
| `PROMISE_RETURN` | 承诺收益 | "保本保收益"、"无风险高回报" |
| `PRIVACY_LEAK` | 个人信息泄露 | 身份证号、银行卡号、手机号 |
| `AML_SUSPICIOUS` | 反洗钱可疑 | "拆分交易"、"规避报告" |
| `DISCLAIMER_MISSING` | 风险提示缺失 | 投资类产品未含"风险提示" |

> 完整规则库见 `src/services/sandbox/complianceRules.tsx`

---

## 四、法规引用（RegulationPanel）

### 4.1 设计

`<RegulationPanel regulationIds={[]}>` 是一个可折叠面板，每条法规显示：

```
┌─────────────────────────────────────────────┐
│ [网络安全法] 第 12 条         [2017]        │  ← 默认折叠
└─────────────────────────────────────────────┘
       ↓ 点击展开
┌─────────────────────────────────────────────┐
│ 全称: 《中华人民共和国网络安全法》           │
│ 颁布机构: 全国人大常委会                      │
│ 生效年份: 2017                              │
│ ─────────────────────────────────────────  │
│ 条款全文:                                    │
│ 任何个人和组织不得利用网络从事危害国家安全...  │
│ ─────────────────────────────────────────  │
│ 处罚标准: 由公安机关或有关主管部门处 5 万元    │
│          以上 50 万元以下罚款...              │
└─────────────────────────────────────────────┘
```

### 4.2 数据源

`src/services/sandbox/regulationRef.ts` 内置 30+ 条真实法规：

- 网络安全法、广告法、基金法、信披办法
- 个保法、适当性管理办法、理财销售办法
- 反洗钱法、大额交易报告管理办法
- 反不正当竞争法、银行卡管理办法
- 公司法、刑法（163、169 之一）
- 券商内控指引、证券业从业管理办法

### 4.3 真实可查

所有法规全称 / 颁布机构 / 生效年份 / 条款号均可在中国政府网 / 证监会 / 银保监会官网核实。

---

## 五、合规回执（Compliance Receipt）

### 5.1 设计目标

- 每次合规检查 → 生成一份**不可篡改**的电子回执
- 包含：操作人 / 时间戳 / 输入哈希 / 输出哈希 / 防伪码
- 可下载 JSON / 复制 Markdown / 打印 PDF

### 5.2 回执字段

| 字段 | 说明 |
|---|---|
| `receiptId` | 回执 ID（如 `CR-20260918-XXXX-V1`） |
| `version` | 版本号（当前 `1.0`） |
| `issuedAt` | 签发时间 ISO |
| `operator` | 操作人 |
| `operatorDept` / `operatorRole` | 操作人部门 / 角色 |
| `inputLength` | 输入文本长度 |
| `inputHash` | SHA-256 截断哈希 |
| `inputPreview` | 输入预览（脱敏） |
| `score` | 评分 |
| `passed` / `blocked` | 是否通过 / 是否阻断 |
| `issueCount` | 问题数 |
| `issues[]` | 命中规则详情（含 ruleId / ruleName / severity / hitCount / suggestion / regulationIds） |
| `businessRef` | 关联业务单据（report / meeting / approval） |
| `source` | 来源（approval / report / sandbox_page / ...） |
| `sealHash` | 防伪码：上述字段拼接后 SHA-256 截断 |
| `remark` | 备注 |

### 5.3 UI 落地

`SandboxRunner` 检测完成后，右侧新增 **`导出合规回执`** 按钮：

```
点击 → 调用 generateReceipt() → setReceiptModalOpen(true)
                                ↓
                       <ComplianceReceiptCard receipt={...} />
                                ↓
                  ┌─ 摘要 / 命中问题 / 原始 JSON 三个 Tab
                  ├─ 防伪码区（金色虚框 + SHA-256）
                  └─ 操作：复制 Markdown / 打印 / 下载 JSON
```

### 5.4 真实对接

- PDF 生成：用 `jspdf` 或后端生成（推荐后端，保证格式稳定）
- 持久化：`POST /api/sandbox/receipts`，回执 ID 由后端签发
- 防伪加强：后端使用 RSA 签名，前端只做展示

---

## 六、批量回扫（BatchComplianceScanPanel）

### 6.1 场景

- 月底 / 季末合规专员对历史研报 / 工单做"体检"
- 一次性输入多条文本，依次过沙箱引擎
- 输出表格 + 摘要：每条的 评分 / 通过 / 阻断 / 问题数
- 一键导出 CSV

### 6.2 落地位置

- 嵌入：合规沙箱页 (`/sandbox`) 底部
- 数据源：演示模式用 `meetingWorkItems`；真实对接 `POST /api/sandbox/batch`

### 6.3 CSV 格式

```
工单ID,标题,负责人,评分,是否通过,是否阻断,问题数
wi-demo-001,合规报送...,李娜,4.2,通过,否,0
wi-demo-005,合规采购协助...,张三,2.1,不通过,是,3
```

> CSV 文件头加 BOM `\ufeff`，保证 Excel 打开不乱码。

---

## 七、关键代码位置

| 文件 | 角色 |
|---|---|
| `src/services/sandbox/sandboxEngine.ts` | 检测引擎（同步纯函数） |
| `src/services/sandbox/sandboxApiContract.ts` | API 契约（异步 mock） |
| `src/services/sandbox/complianceRules.tsx` | 规则库（含 30+ 条规则） |
| `src/services/sandbox/regulationRef.ts` | 法规库（30+ 条真实法规） |
| `src/services/sandbox/complianceReceipt.ts` | 合规回执生成 / 导出 |
| `src/services/sandbox/sandboxLog.ts` | 运行日志 store |
| `src/components/Sandbox/SandboxRunner.tsx` | 主运行器（含回执按钮 + RegulationPanel） |
| `src/components/Sandbox/RegulationPanel.tsx` | 法规引用面板 |
| `src/components/Sandbox/ComplianceReceiptCard.tsx` | 回执 UI 卡片 |
| `src/components/Sandbox/BatchComplianceScanPanel.tsx` | 批量回扫面板 |

---

## 八、与业务系统的联动

| 来源 | 触发场景 | 落地 |
|---|---|---|
| Approval（智能审批） | 提交审批时 | `checkCompliance()` → 阻断级违规禁止提交 |
| Report（研报生成） | 导出 Word / PDF | `checkCompliance()` → 阻断级弹窗 |
| Meeting（会后报告） | 导出 Markdown | `exportMarkdownWithSandbox()` → 阻断级跳转沙箱 |
| PostMeeting 派单 | 工单正文 | `checkCompliance()` → 阻断级挂起工单 |
| 合规专员 | 批量回扫 | `<BatchComplianceScanPanel>` |

---

## 九、真实后端对接规划

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/sandbox/check` | POST | 单文本检测 |
| `/api/sandbox/batch` | POST | 批量检测 |
| `/api/sandbox/receipts` | POST | 持久化回执 |
| `/api/sandbox/receipts/{id}` | GET | 查询回执 |
| `/api/sandbox/logs` | GET | 运行历史 |
| `/api/sandbox/logs/export` | GET | 导出 CSV |
| `/api/sandbox/rules` | GET | 规则库元数据 |
| `/api/sandbox/regulations` | GET | 法规库元数据 |

---

## 十、合规审计场景演示

1. 客户提交一份宣传材料 → 系统自动过沙箱 → 命中"承诺收益"阻断
2. 合规专员在 `/sandbox` 页面导出"合规回执" → 下载 JSON
3. 监管检查时凭回执 ID 在系统内查询 → 看到完整的：操作人 / 时间 / 输入哈希 / 命中规则 / 关联法规
4. 该回执可作为合规留痕凭证
