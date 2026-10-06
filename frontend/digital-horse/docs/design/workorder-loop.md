# 业务闭环深化设计文档（工单生命周期 + 闭环指标 + 会议片段回溯）

> 修订时间：2026-09-18
> 适用版本：v1.1+

---

## 一、设计目标

1. **全生命周期**：工单从派发 → 领取 → 处理 → 复核 → 关闭，状态清晰可追溯
2. **可视化指标**：Dashboard 实时展示闭环时长 / 滞留工单 / 异常派单率
3. **可回溯**：点击工单即可跳到触发生成的会议原文片段，定位决策依据

---

## 二、工单生命周期（6 态）

```
┌─────────┐   领取   ┌─────────┐  开始  ┌─────────────┐  提交  ┌─────────┐  通过  ┌─────────┐
│ assigned │ ───────▶ │ pending │ ─────▶ │ in_progress │ ─────▶ │reviewing│ ─────▶ │approved │
└─────────┘          └─────────┘        └─────────────┘        └─────────┘        └─────────┘
     │                  │                    │                     │                  │
     │ 派发（系统）      │                    │                     │                  │
     │                  │                    │   滞留 > 72h         │                  ▼
     │                  │                    │                     │             ┌──────────┐
     │                  │                    ▼                     └─────────────│ rejected │
     │                  │              ┌─────────┐  驳回                驳回      └──────────┘
     │                  │              │ rejected │ ◀───────────────────────────┘
     │                  │              └─────────┘
     ▼                  ▼
   (重新派发)        (重新派发)
```

### 2.1 状态机说明

| 状态 | 中文 | 触发事件 | 谁可以触发 |
|---|---|---|---|
| `assigned` | 待领取 | 工单派发 | 系统 / DEPT_ADMIN |
| `pending` | 待处理 | 执行人认领 | 执行人 |
| `in_progress` | 进行中 | 执行人开始处理 | 执行人 |
| `reviewing` | 待复核 | 执行人提交完成 | 执行人 |
| `approved` | 已通过 | 复核人通过 | 复核人 / DEPT_ADMIN |
| `rejected` | 已驳回 | 复核人驳回 | 复核人 / DEPT_ADMIN |

### 2.2 状态迁移约束

- `assigned → pending` 必须由 assignee 本人触发
- `pending → in_progress` 必须由 assignee 本人触发
- `in_progress → reviewing` 必须由 assignee 本人触发
- `reviewing → approved / rejected` 由 DEPT_ADMIN 或 SUPER_ADMIN 触发
- `rejected → pending` 支持"驳回后再次发起"

---

## 三、闭环指标（Metrics）

Dashboard 顶部 `<WorkItemMetricsPanel />` 实时计算：

| 指标 | 计算公式 | 健康阈值 |
|---|---|---|
| 总工单数 | `items.length` | - |
| 已闭环 | `approved + rejected` | - |
| 在途 | `assigned + pending + in_progress + reviewing` | - |
| 平均闭环时长（小时） | `Σ(closedAt - createdAt) / closed` | < 48h |
| 滞留工单数 | `in_progress / reviewing 超过 72h 未推进` | 0 |
| 异常派单率 | `rejected / closed` | < 10% |
| 部门工单分布 | 按 `assigneeDept` 聚合 | - |

> 真实对接后端 `GET /api/workitems/metrics`，前端轮询 30s 一次。

---

## 四、会议片段回溯

### 4.1 业务流程

```
会议转写 → 关键词命中 → 自动派单 → 工单关联 meetingSegmentId
                                              │
                                              ▼
                                  Dashboard 点击工单卡片
                                              │
                                              ▼
                              MeetingSegmentDrawer（右侧抽屉）
                                              │
                                              ▼
                          显示：会议标题 / 说话人 / 时间戳 / 原文片段
                          + 触发生成该工单的关键词
                          + 关联法规（如有）
```

### 4.2 数据结构

`MeetingWorkItem` 新增字段：

```ts
meetingSegmentId?: string;        // 关联会议转写片段 ID
meetingSegmentSnippet?: string;   // 触发的原文片段（前 80 字）
```

### 4.3 演示模式数据

`src/mock/meetingDemo.ts` 提供 `DEMO_WORKITEMS`：
- 7 条工单覆盖全部 6 态
- 包含 1 条滞留工单（`in_progress` 96h 未推进）
- 包含 1 条已驳回工单（驳回率演示）
- 每条工单关联会议片段 ID + 原文

---

## 五、关键代码位置

| 文件 | 角色 |
|---|---|
| `src/store/meetingWorkItemStore.ts` | 6 态 / Metrics / getMeetingSegment |
| `src/components/Meeting/WorkItemMetricsPanel.tsx` | Dashboard 闭环指标看板 |
| `src/components/Meeting/MeetingSegmentDrawer.tsx` | 会议片段回溯抽屉 |
| `src/mock/meetingDemo.ts` | 演示工单种子 |
| `src/pages/Dashboard/index.tsx` | 集成入口 |

---

## 六、关键交互流程

### 6.1 一键跳转审批

```
PostMeetingReport → ActionDispatchPanel / ActionCard
  └─ 点击"一键跳转审批"
      └─ navigate('/approval', { state: { workItemId, meetingId, meetingTitle } })
          └─ Approval 页顶部出现"会议派单工单"卡片
              └─ 触发 <Can resource="workitem" action="approve"> 按钮
                  └─ meetingWorkItemStore.setStatus(id, 'approved')
                      └─ Dashboard 闭环指标实时更新
```

### 6.2 工单驳回到会议回溯

```
Dashboard → WorkItemMetricsPanel（指标卡）
  └─ 点击"近期会议工单"
      └─ MeetingSegmentDrawer（抽屉打开）
          └─ 显示会议原文 + 触发关键词
```

---

## 七、后端对接规划

- 工单状态机迁移接口：`POST /api/workitems/{id}/transition` body: `{ to, note }`
- Metrics 接口：`GET /api/workitems/metrics?dept=xxx`
- 会议片段接口：`GET /api/meetings/{meetingId}/segments/{segmentId}`
- WebSocket：`/ws/workitem` 推送状态变化，前端 Dashboard 实时刷新
