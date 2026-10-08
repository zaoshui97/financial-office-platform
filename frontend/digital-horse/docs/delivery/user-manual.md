# 数字孪生办公平台 使用说明书

> 适用版本：v1.0 ｜ 更新日期：2026-10-08
> 适用对象：项目经理 / 业务骨干 / 风控合规 / 系统管理员
> 阅读时长：≈ 15 分钟上手，30 分钟精通
> 维护：<TODO: 填负责人姓名>
> 状态：🚧 编写中，章节前的 [ ] = 待完成，[x] = 已完成
> 截图目录：`docs/delivery/assets/user-manual/`

---

## 0. 写在前面

> 【图 0-1：系统 Logo + 一句话口号】<TODO: 白底 + Logo + 标语，分辨率 ≥ 1200×400>
> 文件路径：`docs/delivery/assets/user-manual/00-cover.png`

### 你能用这个系统做什么？
- ✅ <TODO: 列 4-5 个核心能力，每条 ≤ 15 字>

### 谁适合用？
<TODO: 填表>

| 你是… | 请看第几章 |
|---|---|
| 第一次接触，想 5 分钟跑通全流程 | 第 1 章「快速开始」 |
| 经常开会 | 第 2 章「会议中心」 |
| 经常审批/被审批 | 第 3 章「审批中心」 |
| 用 AI 提效 | 第 4 章「AI 智能中心」 |
| 管账号/看日志 | 第 5 章「系统管理」 |

---

## 1. 快速开始（5 分钟跑通）

### 1.1 打开系统
> 【图 1-1：浏览器地址栏截图】<TODO: 红框标出地址 + 登录按钮位置>
> 文件路径：`docs/delivery/assets/user-manual/01-address-bar.png`

步骤：
1. 打开 Chrome / Edge 浏览器（推荐 120+ 版本）
2. 在地址栏输入网址（**注意：http 不是 https**）
3. 用你的工号登录

> 【图 1-2：登录页截图，红框标出"工号+密码+登录"3 个元素】
> 文件路径：`docs/delivery/assets/user-manual/01-login.png`

> ⚠️ **常见问题**：
> - 打不开？<TODO: 填排查路径>
> - 登录失败？<TODO: 填锁定策略>

### 1.2 第一次进来
> 【图 1-3：登录后首页 Dashboard 截图】<TODO: 标注 4 个区域：欢迎语 / 待办数字 / 快捷入口 / 最近活动>
> 文件路径：`docs/delivery/assets/user-manual/01-dashboard.png`

### 1.3 跟着示例走一遍
> 【教程 1-1：5 分钟跑通「开会 → 纪要 → 派单」三步】

> 【图 1-4：三步流程大图，箭头 + 红色序号】<TODO: 把 3 个页面截图按顺序横向拼接，1、2、3 用红色数字标注>
> 文件路径：`docs/delivery/assets/user-manual/01-tutorial-3steps.png`

---

## 2. 会议中心

### 2.1 创建会议
> 【图 2-1：「新建会议」按钮位置】<TODO: 箭头从按钮指向弹窗>
> 文件路径：`docs/delivery/assets/user-manual/02-new-meeting-btn.png`

操作：
1. 点页面右上角「+ 新建会议」
2. 填标题（必填）、主题、议题
3. 点「创建」

> 【图 2-2：新建会议弹窗，标注 3 个必填项红色星号】
> 文件路径：`docs/delivery/assets/user-manual/02-new-meeting-modal.png`

### 2.2 邀请别人（三种方式）

#### 方式 A：搜索用户加入（适合内部同事）
> 【图 2-3：搜索用户下拉框截图】
> 文件路径：`docs/delivery/assets/user-manual/02-invite-search.png`

#### 方式 B：邀请码（适合临时外部人员）
> 【图 2-4：邀请码生成弹窗，6 位大写字母 + 复制按钮】
> 文件路径：`docs/delivery/assets/user-manual/02-invite-code-gen.png`

> 【图 2-5：把邀请码发给对方后，对方输入的截图】
> 文件路径：`docs/delivery/assets/user-manual/02-invite-code-input.png`

#### 方式 C：上传名单批量邀请（适合大型会议）
> 【图 2-6：上传 Excel 名单，标注"每行一个工号"】
> 文件路径：`docs/delivery/assets/user-manual/02-invite-bulk.png`

### 2.3 开实时会议
> 【图 2-7：点击「开始会议」按钮 → 进入实时会议室】
> 文件路径：`docs/delivery/assets/user-manual/02-start-meeting.png`

> 【图 2-8：实时会议室 4 Agent 协作界面】<TODO: 标注：① 你的麦 ② 4 个 AI 角色 ③ 转写文字 ④ 计时器>
> 文件路径：`docs/delivery/assets/user-manual/02-meeting-room.png`

### 2.4 结束会议
> 【图 2-9：会议自动结束 → 弹出"生成纪要"进度条】
> 文件路径：`docs/delivery/assets/user-manual/02-ending.png`

### 2.5 看纪要和派单
> 【图 2-10：自动生成的纪要 Markdown】
> 文件路径：`docs/delivery/assets/user-manual/02-minutes.png`

> 【图 2-11：行动项列表 + 「派发到审批」按钮】
> 文件路径：`docs/delivery/assets/user-manual/02-action-items.png`

> 💡 **小贴士**：
> - 邀请码有效期 7 天，到期重新生成
> - 行动项派发后会出现在审批中心，对方会收到通知
> - 误删了会议？找管理员，30 天内可恢复

### 2.6 常见问题
<TODO: 填表>

| 问题 | 原因 | 解决 |
|---|---|---|
| 看不到实时会议 | <TODO> | <TODO> |
| 麦没声音 | <TODO> | <TODO> |
| 纪要生成失败 | <TODO> | <TODO> |

---

## 3. 审批中心

### 3.1 看我的待办
> 【图 3-1：审批首页，4 列看板】<TODO: 箭头指向「待我审批」列>
> 文件路径：`docs/delivery/assets/user-manual/03-approval-home.png`

### 3.2 审批一个工单
> 【图 3-2：工单详情抽屉，标注 6 个区域】
> 文件路径：`docs/delivery/assets/user-manual/03-approval-drawer.png`

操作步骤：
1. 点工单卡片
2. 右侧抽屉展开
3. 看 AI 审查结果（红框）
4. 看附件（点击放大）
5. 写意见（可选）
6. 点「同意」/「驳回」/「转交」

> 【图 3-3：填写审批意见的输入框，标注"可不填"】
> 文件路径：`docs/delivery/assets/user-manual/03-approval-comment.png`

### 3.3 我提交的工单
> 【图 3-4：切换 Tab「我提交的」截图】
> 文件路径：`docs/delivery/assets/user-manual/03-my-submitted.png`

### 3.4 批量操作
> 【图 3-5：勾选多个工单 + 批量同意/驳回】
> 文件路径：`docs/delivery/assets/user-manual/03-batch.png`

### 3.5 闭环演示
> 【教程 3-1：从会议行动项看闭环怎么走通】

> 【图 3-6：会议页 → 审批页 → 关闭的三步动图】
> 文件路径：`docs/delivery/assets/user-manual/03-closed-loop.gif`

### 3.6 常见问题
<TODO: 填表>

| 问题 | 原因 | 解决 |
|---|---|---|
| 看不到工单 | <TODO> | <TODO> |
| 撤回不了 | <TODO> | <TODO> |
| 附件打不开 | <TODO> | <TODO> |

---

## 4. AI 智能中心

### 4.1 智能问答（适合临时问题）
> 【图 4-1：问答页输入框，标注"按 Enter 发送"】
> 文件路径：`docs/delivery/assets/user-manual/04-qa-input.png`

> 【图 4-2：回答带引用来源的截图】<TODO: 红框标出"引用 #1 #2"链接>
> 文件路径：`docs/delivery/assets/user-manual/04-qa-citation.png`

### 4.2 Agent 调度（适合重复任务）
> 【图 4-3：选 Agent 下拉框】
> 文件路径：`docs/delivery/assets/user-manual/04-agent-select.png`

> 【图 4-4：执行进度条 + 实时输出】
> 文件路径：`docs/delivery/assets/user-manual/04-agent-running.png`

### 4.3 多 Agent 协作（适合复杂任务）
> 【图 4-5：群聊模式，4 个 Agent 头像轮播】
> 文件路径：`docs/delivery/assets/user-manual/04-multi-agent.png`

### 4.4 上传文档让 AI 学习
> 【图 4-6：拖拽上传 + 解析进度】
> 文件路径：`docs/delivery/assets/user-manual/04-doc-upload.png`

### 4.5 常见问题
<TODO: 填 2-3 个 FAQ>

---

## 5. 系统管理（仅管理员）

### 5.1 加新员工
> 【图 5-1：用户管理 → 新增用户表单】
> 文件路径：`docs/delivery/assets/user-manual/05-add-user.png`

### 5.2 改角色
> 【图 5-2：编辑用户角色下拉框】
> 文件路径：`docs/delivery/assets/user-manual/05-edit-role.png`

### 5.3 看审计日志
> 【图 5-3：审计日志时间线，按时间倒序】
> 文件路径：`docs/delivery/assets/user-manual/05-audit.png`

### 5.4 系统监控
> 【图 5-4：CPU/内存/在线人数仪表盘】
> 文件路径：`docs/delivery/assets/user-manual/05-monitor.png`

---

## 6. 移动端使用（部分功能）

> 【图 6-1：手机访问首页，标注"3 个移动端可用的功能"】<TODO: 列出支持的功能>
> 文件路径：`docs/delivery/assets/user-manual/06-mobile.png`

支持：会议查看、审批、AI 问答
不支持：会议创建、大文件上传、Agent 调试

---

## 7. 快捷键大全

<TODO: 填表，按需扩展>

| 快捷键 | 功能 | 适用范围 |
|---|---|---|
| `Ctrl + K` | 全局搜索 | 全局 |
| `Ctrl + Enter` | 发送消息 | AI 问答 |
| `Esc` | 关闭弹窗 | 全局 |
| `?` | 显示帮助 | 全局 |

> 【图 7-1：按 `?` 弹出快捷键面板截图】
> 文件路径：`docs/delivery/assets/user-manual/07-shortcut.png`

---

## 8. 故障排查

<TODO: 填表>

| 现象 | 排查步骤 |
|---|---|
| 白屏 | ① 刷新 ② 换浏览器 ③ 清缓存 |
| 登录后秒退 | Cookie 被禁，浏览器设置允许 |
| 上传失败 | 文件 > 50MB，换个小的试试 |
| 接口 404 | 后端没启动，找管理员 |

> 【图 8-1：Chrome DevTools Network 标签的截图，标注"看红色行"】
> 文件路径：`docs/delivery/assets/user-manual/08-devtools.png`

---

## 9. 反馈与支持

- 内部群：<TODO: 群名/二维码>
- 邮箱：<TODO>
- 紧急联系电话：<TODO>

> 【图 9-1：反馈二维码 / 群二维码】
> 文件路径：`docs/delivery/assets/user-manual/09-contact.png`

---

## 附录 A：术语表

<TODO: 填表>

| 术语 | 解释 |
|---|---|
| 会议 | 多人语音/视频实时协作 |
| 工单 | 一个具体要办的事项 |
| 闭环 | 从创建到关闭全流程打通 |
| 彩排 | 开会前的模拟演练 |

## 附录 B：版本历史

| 版本 | 日期 | 主要变更 | 作者 |
|---|---|---|---|
| v1.0 | 2026-10-08 | 首版 | <TODO> |
