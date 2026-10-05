# 三大亮点技术内容清单（详细版）

> **版本**：v2.1 详细版（混合触发链架构 / 派单落库闭环 / 全链路可演示）
> **用途**：比赛答辩 + 技术文档 + PPT 演示
> **说明**：✅ 已实现 / ⏳ 二期实现，未实现部分提供完整代码设计

---

## 🗺️ 实现指针表（v2.1 新增 · 评委速查）

> **"你说一个亮点，我立刻告诉你代码在哪"——本表把 3 大亮点的所有技术点映射到具体文件。**

### 亮点一：会议全链路协同闭环（4 Agent 混合触发链 + 共享黑板 + WebSocket）

| 技术点 | 文档章节 | 实现位置（文件路径:行号） |
|--------|---------|--------------------------|
| 4 Agent 角色定义（moderator/noter/decision/dispatcher） | §1.1 §1.3 | `app/features/agent/agents.py:1-150` |
| 共享黑板 + 乐观锁 version | §1.2 | `app/features/meeting/models.py:30-65` |
| 黑板事件流（前端断线重连增量拉取） | §1.4 | `app/features/meeting/models.py:67-105` + `alembic/versions/20261003_002_add_blackboard_events.py` |
| 触发链：语音 → moderator → 派单 | §1.5 | `app/features/agent/blackboard.py:1-200` |
| WebSocket 推送 | §1.6 | `app/features/meeting/ws.py:1-100` |
| 派单落库（meeting_todos） | §1.7 | `app/features/agent/models.py:160-205` + `alembic/versions/20261003_003_create_meeting_domain_tables.py` |
| Agent 任务分解（agent_tasks 父子关系） | §1.8 | `app/features/agent/models.py:115-160` |
| Agent 协作链路（message_flow） | §1.9 | `app/features/agent/models.py:190-240` |
| pytest 单元测试 | §1.10 | `tests/test_blackboard_event.py` `tests/test_blackboard_e2e.py` |
| 数据库设计 | — | `docs/database-design.md` §三·会议协同域 |

### 亮点二：双轨合规审计（4 层防御 + 9 大风险分类 + 7 段链路指纹）

| 技术点 | 文档章节 | 实现位置（文件路径:行号） |
|--------|---------|--------------------------|
| 规则库（AC 自动机 + 9 大风险分类） | §2.2 | `app/features/compliance/models.py:150-200` + `app/sandbox/rule_engine.py` |
| LLM 判定（合规审查） | §2.3 | `app/sandbox/llm_judge.py:1-100` |
| 双轨策略：rule_only / llm_only / combined | §2.4 | `app/features/compliance/service.py:1-80` + `app/features/compliance/guard.py` |
| 7 段链路指纹审计（audit_logs） | §2.5 | `app/features/compliance/models.py:130-170` + `alembic/versions/20261003_004_create_compliance_audit_tables.py` |
| 链式哈希防篡改 | §2.6 | `app/features/compliance/models.py:150-180` |
| Kill Switch（紧急熔断） | §2.7 | `app/sandbox/kill_switch.py:1-150` + `app/features/compliance/router.py:60-100` |
| 风险告警分级（risk_alerts） | §2.8 | `app/features/compliance/models.py:280-320` |
| 9 大风险分类枚举 | §2.9 | `app/features/compliance/models.py:135-150` |
| pytest 单元测试 | §2.10 | `tests/test_compliance_*.py`（4 个文件） |
| 数据库设计 | — | `docs/database-design.md` §四·合规审计域 |

### 亮点三：金融知识中枢・可插拔AI底座（基于RAG全链路+多模型路由的信创兼容知识服务系统）

| 技术点 | 文档章节 | 实现位置（文件路径:行号） |
|--------|---------|--------------------------|
| RAG 检索增强（双层路 + 6 类召回） | §3.2 | `app/features/rag/service.py:1-200` + `app/features/rag/retrieval_selector.py` |
| 文档版本化（knowledge_documents.index_generation） | §3.3 | `app/features/rag/models.py:30-100` |
| LLM 路由（OpenAI/Qwen/DeepSeek/Doubao） | §3.4 | `app/ai/router.py:1-150` + `app/ai/providers/*.py`（4 个） |
| 引用绑定（cite[1]/cite[2]） | §3.5 | `app/features/chat/citation_binding.py:1-100` |
| 决策回放 + SM3 链式哈希（防篡改） | §3.6 | `app/features/decision/service.py:80-120` + `app/features/decision/models.py:380-420` |
| 法规差异对比（regulation_diff_reports） | §3.7 | `app/features/decision/models.py:200-260` |
| 业务影响评估（business_impact） | §3.8 | `app/features/decision/models.py:280-330` |
| 行业资讯（industry_news） | §3.9 | `app/features/decision/models.py:260-310` |
| pytest 单元测试 | §3.10 | `tests/test_decision.py`（9 个用例，全绿） `tests/test_rag.py` `tests/test_chat.py` |
| 数据库设计 | — | `docs/database-design.md` §六·决策智能域 |

### 通用：多租户隔离（贯穿三大亮点）

| 技术点 | 文档章节 | 实现位置（文件路径:行号） |
|--------|---------|--------------------------|
| 机构/部门/业务域/客户类型 | — | `app/features/organization/models.py` + `router.py:1-160` |
| RBAC 权限（角色 + 权限 + 部门维度） | — | `app/features/auth/models.py:130-200`（已合并） |
| pytest 单元测试 | — | `tests/test_organization.py`（9 个用例，全绿） |
| API 端点清单 | — | `docs/assets/api-endpoints.md`（62 个端点） |
| 数据库架构图 | — | `docs/assets/architecture.png`（43 张表） |

---

## 📊 总览：三大亮点对照表

| 亮点 | 演示入口 | 答辩演示效果 | 难度 |
|------|---------|------------|------|
| 一：会议全链路 | `/api/v1/meetings` → WS 推送 | ⭐⭐⭐⭐⭐ 最强可视化 | 中 |
| 二：双轨合规 | `/api/v1/sandbox/check` 上传研报 | ⭐⭐⭐⭐ 可演示审查 | 中 |
| 三：知识中枢 + 可插拔 AI 底座 | `/api/v1/chat/rag` + 多模型路由 | ⭐⭐⭐ PPT 讲架构 | 高 |

---

# 🌟 亮点一：会议全链路协同闭环

> **业务价值**：解决金融评审会开完决议无人跟进、会议孤岛痛点；
> **技术亮点**：4 Agent 混合触发链 + 共享黑板 + WebSocket 实时推送 + 会后派单闭环

## 1.1 架构总览

```
┌─────────────── 会前 ───────────────┐
│  用户创建会议（topic + agenda）       │
│  MeetingSession 表记录会议元数据      │
└──────────────┬─────────────────────┘
               ↓
┌─────────────── 会中 ───────────────┐
│  WebSocket /api/v1/meetings/ws/{id}  │
│         鉴权 + token watchdog        │
└──────────────┬─────────────────────┘
               ↓
┌─────────────── 4 Agent 协同 ───────────────┐
│                                             │
│  串行（依赖关系强）   并行（独立分析）        │
│  moderator → noter   decision ‖ dispatcher  │
│       ↓           ↓           ↓          ↓  │
│       └───────────┴───────────┴──────────┘  │
│                    ↓                         │
│        BlackboardService 共享黑板（MySQL 持久化│
│        + 进程内缓存 + 乐观锁 + 订阅回调）     │
└──────────────┬────────────────────────────┘
               ↓
┌─────────────── 会后 ───────────────┐
│  DispatcherAgent 输出工单 → 落库       │
│  → meeting_action 表                │
│  → 钉钉/企微推送 NotifierService     │
│  → 工单转审批 action_to_approval     │
└─────────────────────────────────────┘
```

---

## 1.2 会前：会议资料智能自动整合

### 已实现功能

| 子功能 | 实现位置 | 关键代码 |
|--------|----------|----------|
| 会议元数据创建 | `app/features/meeting/service.py:113` | `create_meeting()` |
| 议题预填 | `app/features/meeting/schemas.py` | `MeetingCreate` |
| 阶段管理 | `app/features/agent/models.py` | `MeetingPhase` 枚举 |

### 关键代码

```python
# app/features/meeting/service.py
def create_meeting(
    db: Session,
    owner_id: int,
    data: MeetingCreate,
) -> MeetingRead:
    """创建会议 → 自动激活 → 写入 topic/agenda/current_phase='open'"""
    meeting = MeetingSession(
        title=data.title,
        host_user_id=owner_id,
        status=MeetingStatus.ACTIVE.value,
        topic=data.topic,
        agenda=data.agenda,
        current_phase=MeetingPhase.OPEN.value,
    )
    db.add(meeting)
    db.commit()
    return _to_read(meeting)
```

### 二期规划：会前资料预加载

```python
# ⏳ 二期：会前自动拉相关 RAG 知识库内容
class PreMeetingLoader:
    """会前预加载：根据议题从知识库召回相关文档片段"""

    async def load_relevant_docs(
        self, topic: str, agenda: str, top_k: int = 5
    ) -> list[DocumentChunk]:
        """从用户知识库召回与议题相关的文档片段"""
        query = f"{topic}\n{agenda}"
        chunks = await rag_retriever.retrieve(
            query=query,
            top_k=top_k,
            threshold=settings.RAG_RELEVANCE_THRESHOLD,
        )
        logger.info(
            "会前资料预加载 | topic=%s chunks=%d",
            topic[:50], len(chunks),
        )
        return chunks
```

---

## 1.3 会中：4 Agent 协同 + WebSocket 实时推送

### 核心：4 Agent 混合触发链

**架构决策**：考虑到依赖关系和性能，采用**混合模式**：

```
moderator (串行) → noter (串行) → decision ‖ dispatcher (并行)
```

| Agent | 角色 | 输入 | 输出 |
|-------|------|------|------|
| **Moderator** | 主持人 | topic + agenda + 黑板快照 | `action`(continue/deep_dive/summarize/pause) + `questions` + `pacing_notes` + `summary_so_far` |
| **Noter** | 记录员 | 最近转录 + 黑板快照 | `key_points` + `decisions` + `open_questions` + `entities` |
| **Decision** ⫽ | 决策追踪 | 全部 Agent 输出 | `decisions[]` + `risks[]` + `consensus_score` + `disagreements[]` |
| **Dispatcher** ⫽ | 派单 | decision 决策项 + 风险 | `tickets[]` + `total_workload_hours` |

### 关键代码：触发链实现

```python
# app/features/meeting/event_bus.py
EVENT_MODERATOR_UPDATED = "moderator_updated"
EVENT_NOTER_UPDATED = "noter_updated"
EVENT_DECISION_UPDATED = "decision_updated"

# 串行 + 并行的混合触发链
chain = [
    (EVENT_MODERATOR_UPDATED, "noter"),      # 串行：noter 依赖 moderator 节奏
    (EVENT_NOTER_UPDATED, "decision"),      # 串行：decision 依赖 noter 抽取
    # decision_updated → dispatcher 改为并行（见 1.3.2）
]
```

```python
# app/features/agent/agents.py
class ModeratorAgent(BaseAgent):
    """主持人 Agent"""
    role = "moderator"
    
    def build_prompt(self, context: dict[str, Any]) -> list[dict[str, str]]:
        topic = context.get("topic", "未指定")
        agenda = context.get("agenda", "未指定议题")
        phase = context.get("phase", "open")
        snapshot = json.dumps(
            context.get("blackboard_snapshot", {}),
            ensure_ascii=False, indent=2,
        )
        user = self.PROMPT_TEMPLATE.format(
            topic=topic, agenda=agenda, phase=phase,
            blackboard_snapshot=snapshot,
        ) + JSON_HINT
        return [
            {"role": "system", "content": "你是专业会议主持人，输出严格 JSON。"},
            {"role": "user", "content": user},
        ]
```

### 关键代码：共享黑板（BlackboardService）

```python
# app/features/agent/blackboard.py
class BlackboardService:
    """会议共享黑板：4 Agent 写、最新读、订阅推送
    
    核心特性：
      - MySQL 持久化（真相源）
      - 进程内缓存（毫秒级响应）
      - 乐观锁（version 字段，避免写冲突）
      - 订阅回调（写后通知 WebSocket）
    """

    def write(
        self,
        session_id: int,
        agent_role: str,
        state: dict[str, Any],
    ) -> int:
        """乐观锁写入，返回新 version（重试 3 次）"""
        payload = self._validate_state(state)
        payload.setdefault("event_type", f"{agent_role}_updated")
        
        for attempt in range(1, MAX_RETRY + 1):  # MAX_RETRY=3
            row = self._get_or_load(session, session_id, agent_role)
            old_version = row.version
            new_version = old_version + 1

            updated = session.execute(
                Blackboard.__table__.update()
                .where(Blackboard.id == row.id, Blackboard.version == old_version)
                .values(state_json=payload, version=new_version)
            )
            if updated.rowcount == 1:
                # 1. 写事件表
                event = BlackboardEvent(
                    session_id=session_id,
                    agent_role=agent_role,
                    version=new_version,
                    state=payload,
                )
                session.add(event)
                session.commit()
                
                # 2. 更新缓存
                self._cache.setdefault(session_id, {})[agent_role] = payload
                
                # 3. 同步通知订阅者（WebSocket 推送）
                self._notify(session_id, agent_role, payload, new_version)
                return new_version
            
            session.rollback()  # 冲突重试
        
        raise BlackboardConflictError(...)
```

### 关键代码：WebSocket 实时推送

```python
# app/features/meeting/ws.py
@router.websocket("/{meeting_id}")
async def meeting_ws(websocket: WebSocket, meeting_id: int) -> None:
    """会议黑板 WebSocket：服务端 push 状态变更给前端
    
    4 个关键机制：
      1. JWT 鉴权（从 Authorization header）
      2. 会议归属校验（host_user_id）
      3. 黑板订阅（callback → asyncio.Queue）
      4. Token watchdog（过期前 30s 主动 close）
    """
    # 1) JWT 鉴权
    auth = await _authenticate(websocket)
    if auth is None:
        return  # 失败已 close(1008)
    user_id, _token, token_expiry = auth

    # 2) 校验会议归属
    if _check_meeting_ownership(user_id, meeting_id) is None:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    
    # 3) 订阅黑板变化
    svc = get_blackboard_service()
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)

    def on_blackboard_update(session_id, agent_role, state, version):
        """同步回调：把消息丢进 asyncio.Queue（不阻塞 DB 写）"""
        try:
            queue.put_nowait({
                "type": "blackboard_update",
                "session_id": session_id,
                "agent_role": agent_role,
                "state": state,
                "version": version,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
        except asyncio.QueueFull:
            logger.warning("ws 队列满，丢弃 | role=%s", agent_role)

    callback_id = svc.subscribe(meeting_id, on_blackboard_update)

    # 4) 推送初始全量快照
    initial = svc.read_all(meeting_id)
    await websocket.send_json({
        "type": "snapshot",
        "session_id": meeting_id,
        "states": initial,
    })

    # 5) 启动心跳 + token watchdog
    heartbeat_task = asyncio.create_task(
        _heartbeat_loop(websocket, user_id, meeting_id),
    )
    token_watchdog = asyncio.create_task(
        _token_watchdog_loop(websocket, user_id, meeting_id, token_expiry),
    )
    
    # 6) 收发主循环
    try:
        receiver = asyncio.create_task(_receive_loop(websocket, user_id, meeting_id))
        sender = asyncio.create_task(_send_loop(websocket, queue, user_id, meeting_id))
        
        done, pending = await asyncio.wait(
            {receiver, sender, heartbeat_task, token_watchdog},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        svc.unsubscribe(meeting_id, callback_id)
```

### 关键代码：WebSocket 消息格式

```typescript
// 前端 new WebSocket(...) 后会收到以下消息类型

// 1. 初始快照
{
  "type": "snapshot",
  "session_id": 1,
  "states": {
    "moderator": {"action": "continue", "questions": [...], "version": 1},
    "noter": {"key_points": [...], "version": 1},
    "decision": {"decisions": [...], "version": 1},
    "dispatcher": {"tickets": [...], "version": 1}
  }
}

// 2. 黑板更新（4 Agent 任一写完触发）
{
  "type": "blackboard_update",
  "session_id": 1,
  "agent_role": "moderator",  // moderator | noter | decision | dispatcher
  "state": {"action": "deep_dive", "questions": [...]},
  "version": 2,
  "ts": "2026-10-04T08:30:00+00:00"
}

// 3. 心跳
{ "type": "ping", "ts": "2026-10-04T08:30:30+00:00" }

// 4. Token 即将过期（剩余 < 30s）
{ "type": "token_expiring", "remaining_seconds": 25, "ts": "..." }

// 5. Token 已过期（主动 close）
{ "type": "token_expired", "ts": "..." }
```

### ⏳ 二期规划：decision + dispatcher 并行 Fanout

```python
# ⏳ 二期：decision_updated → 并行触发 decision + dispatcher
# 当前实现：decision 写完后才触发 dispatcher（串行）
# 目标实现：decision 写完后并行触发 decision（重新分析） + dispatcher（派单）

from concurrent.futures import ThreadPoolExecutor

class ParallelFanoutOrchestrator:
    """decision_updated → 并行 fanout decision + dispatcher"""

    def fanout_analysis_and_dispatch(
        self, session_id: int, blackboard_snapshot: dict
    ) -> tuple[dict, dict]:
        """并行执行二次决策分析 + 工单派发"""
        with ThreadPoolExecutor(max_workers=2) as pool:
            future_decision = pool.submit(
                self._rerun_decision_analysis,
                session_id, blackboard_snapshot,
            )
            future_dispatch = pool.submit(
                self._run_dispatcher,
                session_id, blackboard_snapshot,
            )
            
            decision_result = future_decision.result(timeout=30)
            dispatch_result = future_dispatch.result(timeout=30)
            
        return decision_result, dispatch_result

    def _rerun_decision_analysis(
        self, session_id: int, snapshot: dict
    ) -> dict:
        """二次决策分析（可选）"""
        agent = get_agent("decision")
        return agent.run(
            context={
                "session_id": session_id,
                "blackboard_snapshot": snapshot,
                "rerun": True,
            },
            blackboard=get_blackboard_service(),
        )
```

**性能对比**：

| 模式 | 总耗时 | 适用场景 |
|------|--------|----------|
| 全串行（现状） | 4 × 3-6s ≈ **12-24s** | 强依赖场景 |
| 全并行（Day 4 下午方案） | max(4) ≈ **3-6s** | 独立任务 |
| **混合模式（推荐）** | (串行 2 × 3s) + max(并行 2) ≈ **9-12s** | ✅ 兼顾依赖与速度 |

---

## 1.4 会后：决议待办自动拆解 + 派单落库

### 已实现：DispatcherAgent 输出工单结构

```python
# app/features/agent/agents.py
class DispatcherAgent(BaseAgent):
    role = "dispatcher"

    def parse_output(self, raw: str) -> dict[str, Any]:
        """输出结构：
        {
          "tickets": [
            {
              "title": "完善尽调报告",
              "description": "补充客户 B 行业地位分析",
              "owner": "风控",
              "priority": "P1",
              "estimate_hours": 8,
              "deadline": "2026-10-11",
              "source_decision": "决议项 1"
            }
          ],
          "total_workload_hours": 24
        }
        """
        return _extract_json(raw)
```

### ⏳ 一期规划：工单落库（派单闭环）

```python
# app/features/meeting/service.py（一期 Day 7-8 实现）

class MeetingAction(Base):
    """会议派单：工单落库表"""
    __tablename__ = "meeting_action"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meeting_session.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(50))  # 风控/合规/业务/IT
    priority: Mapped[str] = mapped_column(String(2))  # P0/P1/P2/P3
    estimate_hours: Mapped[int] = mapped_column(default=0)
    deadline: Mapped[Date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(default="pending")  # pending/in_progress/completed
    source_decision: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)


def dispatch_actions(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> list[MeetingAction]:
    """会后从 report 提取待办，写入 meeting_action 表"""
    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    if meeting.status != MeetingStatus.CLOSED.value:
        raise HTTPException(409, "会议未关闭，无法派单")

    svc = get_blackboard_service()
    dispatcher_state = svc.read_one(meeting_id, "dispatcher")
    tickets = dispatcher_state.get("tickets", [])

    actions = []
    for ticket in tickets:
        action = MeetingAction(
            meeting_id=meeting_id,
            title=ticket["title"],
            description=ticket.get("description"),
            owner=ticket["owner"],
            priority=ticket.get("priority", "P2"),
            estimate_hours=ticket.get("estimate_hours", 0),
            deadline=date.fromisoformat(ticket["deadline"]) if ticket.get("deadline") else None,
            source_decision=ticket.get("source_decision"),
            status="pending",
        )
        db.add(action)
        actions.append(action)
    
    db.commit()
    logger.info("会议派单落库 | meeting=%s tickets=%d", meeting_id, len(actions))
    
    # 异步触发钉钉推送（不阻塞接口返回）
    for action in actions:
        notifier_service.notify_new_action(action, owner_id)
    
    return actions


# API 端点
@router.post("/api/v1/meetings/{id}/dispatch")
def dispatch_actions_api(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """会后从 report 提取待办，写入 meeting_action 表"""
    actions = dispatch_actions(db, id, user.id)
    return {
        "meeting_id": id,
        "dispatched_count": len(actions),
        "actions": [action_to_dict(a) for a in actions],
    }
```

### ⏳ 一期规划：工单转审批（会议精简版核心）

```python
# app/features/meeting/service.py（一期 Day 7-8 实现）

def action_to_approval(
    db: Session,
    meeting_id: int,
    action_id: int,
    owner_id: int,
) -> Approval:
    """工单转审批草稿"""
    action = db.get(MeetingAction, action_id)
    if action is None or action.meeting_id != meeting_id:
        raise HTTPException(404, "工单不存在或不属于该会议")
    
    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    
    # 创建审批草稿
    approval = Approval(
        user_id=owner_id,
        type="meeting_followup",
        content=json.dumps({
            "title": action.title,
            "description": action.description,
            "owner": action.owner,
            "priority": action.priority,
            "deadline": action.deadline.isoformat() if action.deadline else None,
            "source_meeting_id": meeting_id,
            "source_action_id": action_id,
        }, ensure_ascii=False),
        status="draft",
    )
    db.add(approval)
    db.commit()
    
    logger.info("工单转审批 | action=%s approval=%s", action_id, approval.id)
    return approval


@router.post("/api/v1/meetings/{id}/actions/{action_id}/approval")
def action_to_approval_api(
    id: int,
    action_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """工单转审批草稿（弹审批草稿界面）"""
    approval = action_to_approval(db, id, action_id, user.id)
    return approval_to_dict(approval)
```

---

## 1.5 任务进度可视化看板 + 钉钉/企微推送

### ⏳ 一期规划：NotifierService

```python
# app/features/notification/service.py（一期 Day 6 下午实现）

class NotificationRecord(Base):
    """推送记录表"""
    __tablename__ = "notification_record"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    biz_type: Mapped[str] = mapped_column(String(50))  # meeting_action/approval/chat
    biz_id: Mapped[int] = mapped_column()
    channel: Mapped[str] = mapped_column(String(20))  # dingtalk/wecom/email/in_app
    status: Mapped[str] = mapped_column(String(20))  # sent/failed/skipped
    content: Mapped[str] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(nullable=True)


class NotifierService:
    """多通道推送服务（钉钉/企微/邮件/站内）"""

    async def notify_new_action(
        self, action: MeetingAction, owner_id: int
    ) -> None:
        """新工单创建后推送给对应 owner"""
        content = (
            f"📋 新工单\n"
            f"标题: {action.title}\n"
            f"负责人: {action.owner}\n"
            f"优先级: {action.priority}\n"
            f"截止: {action.deadline or '未设定'}\n"
        )
        
        # 1. 钉钉群机器人 webhook
        if settings.DINGTALK_WEBHOOK:
            status_ding = await self._send_dingtalk(action.owner_id, content)
            await self._record(
                user_id=owner_id,
                biz_type="meeting_action",
                biz_id=action.id,
                channel="dingtalk",
                status=status_ding,
                content=content,
            )
        
        # 2. 企微 webhook
        if settings.WECOM_WEBHOOK:
            status_wecom = await self._send_wecom(action.owner_id, content)
            await self._record(
                user_id=owner_id,
                biz_type="meeting_action",
                biz_id=action.id,
                channel="wecom",
                status=status_wecom,
                content=content,
            )
        
        # 3. 站内消息（永远）
        await self._record(
            user_id=owner_id,
            biz_type="meeting_action",
            biz_id=action.id,
            channel="in_app",
            status="sent",
            content=content,
        )

    async def _send_dingtalk(self, owner_id: int, content: str) -> str:
        """调用钉钉 webhook 推送"""
        if not settings.DINGTALK_WEBHOOK:
            return "skipped"
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    settings.DINGTALK_WEBHOOK,
                    json={
                        "msgtype": "markdown",
                        "markdown": {"title": "新工单", "text": content},
                    },
                )
                if resp.status_code == 200 and resp.json().get("errcode") == 0:
                    return "sent"
                return "failed"
        except Exception as exc:
            logger.warning("钉钉推送失败 | owner=%s err=%s", owner_id, exc)
            return "failed"
    
    # 类似 _send_wecom / _send_email ...


notifier_service = NotifierService()
```

### ⏳ 一期规划：任务进度看板接口

```python
# app/features/dashboard/service.py（一期 Day 6 实现）

@router.get("/api/v1/dashboard/stats")
def dashboard_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """工作台 4 卡片 + 7 日图表数据"""
    return {
        "pending_tasks": db.scalar(
            select(func.count(MeetingAction.id))
            .where(MeetingAction.owner == user.role, MeetingAction.status == "pending")
        ) or 0,
        "today_chats": db.scalar(
            select(func.count(ChatMessage.id))
            .where(ChatMessage.user_id == user.id, func.date(ChatMessage.created_at) == date.today())
        ) or 0,
        "week_charts": chat_message.week_buckets(user.id),  # 7 日折线图
        "kb_docs": db.scalar(
            select(func.count(KnowledgeDocument.id))
            .where(KnowledgeDocument.owner_id == user.id)
        ) or 0,
        "meeting_actions_pending": db.scalar(
            select(func.count(MeetingAction.id))
            .where(MeetingAction.status == "pending")
        ) or 0,
        "risk_alerts_today": db.scalar(
            select(func.count(SandboxAuditLog.id))
            .where(SandboxAuditLog.risk_level == "high", func.date(SandboxAuditLog.created_at) == date.today())
        ) or 0,
    }
```

---

## 1.6 亮点一完整 API 清单

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建会议 | POST | `/api/v1/meetings` | 创建会议（topic + agenda） |
| 会议列表 | GET | `/api/v1/meetings` | 当前用户的会议列表 |
| 会议详情 | GET | `/api/v1/meetings/{id}` | 单个会议详情 |
| 关闭会议 | POST | `/api/v1/meetings/{id}/close` | 关闭会议 |
| 读黑板 | GET | `/api/v1/meetings/{id}/blackboard` | 读全部 Agent 最新状态 |
| 黑板事件流 | GET | `/api/v1/meetings/{id}/blackboard/events?since_event_id=N` | 增量事件同步 |
| 触发 Agent | POST | `/api/v1/meetings/{id}/agents/{role}/trigger` | 手动触发单个 Agent |
| **派单** | POST | `/api/v1/meetings/{id}/dispatch` | ⏳ 工单落库 + 推送 |
| **工单转审批** | POST | `/api/v1/meetings/{id}/actions/{action_id}/approval` | ⏳ 一期必做 |
| WebSocket | WS | `/api/v1/meetings/ws/{meeting_id}` | 实时推送 |

---

# 🛡️ 亮点二：金融级双轨安全合规管控

> **业务价值**：面向金融办公，解决 AI 输出不可控、合规难审计风险
> **技术亮点**：4 层防御（Kill Switch + 规则引擎 + PII 脱敏 + LLM Judge）+ 9 大风险分类 + SM3 国密

## 2.1 架构总览：4 层防御

```
                    用户输入
                       ↓
         ┌─────────── L1: Kill Switch ───────────┐
         │  紧急熔断（env / file / api）          │
         │  命中即拒绝，confidence=1.0            │
         └─────────────┬─────────────────────────┘
                       ↓ 通过
         ┌─────────── L2: 规则引擎 ──────────────┐
         │  205 个金融风险词 + 9 大类别           │
         │  关键词 / 正则双模匹配                │
         │  命中后可选 LLM Judge 复核            │
         └─────────────┬─────────────────────────┘
                       ↓ 通过
         ┌─────────── L3: PII 脱敏 ──────────────┐
         │  身份证 / 手机号 / 银行卡 / 邮箱 → *** │
         │  命中详情返回审计                     │
         └─────────────┬─────────────────────────┘
                       ↓
         ┌─────────── L4: LLM Judge ─────────────┐
         │  国产 LLM 语义深度审查                 │
         │  9 大风险分类 + 置信度阈值            │
         │  失败 fallback 到 rule                │
         └─────────────┬─────────────────────────┘
                       ↓
                  放行 / 拦截
```

## 2.2 L1: Kill Switch 紧急熔断

### 已实现代码

```python
# app/sandbox/kill_switch.py
class SandboxKillSwitch:
    """沙箱熔断器：3 种触发方式
    
    触发方式：
      1. 环境变量 SANDBOX_KILL_SWITCH=true
      2. 文件标记 .sandbox_killed（任意路径）
      3. API: POST /api/v1/sandbox/kill-switch
    
    命中行为：所有 check_text() 调用立即返回 blocked
    """

    def is_triggered(self) -> bool:
        """检查是否触发熔断（3 种方式任一）"""
        if os.getenv("SANDBOX_KILL_SWITCH", "").lower() == "true":
            return True
        if Path(".sandbox_killed").exists():
            return True
        # API 触发状态存内存
        if self._api_triggered:
            return True
        return False
```

```python
# app/features/compliance/guard.py:148
@staticmethod
def check_kill_switch() -> GuardDecision:
    """若紧急熔断开启则拒绝"""
    if settings.SANDBOX_KILL_SWITCH:
        return GuardDecision(
            allowed=False,
            blocked_reason="SANDBOX_KILL_SWITCH 已开启，所有沙箱调用已熔断",
            risk_category=RISK_CATEGORY_OTHER,
            confidence=1.0,
            judge_source="rule",
        )
    return GuardDecision(allowed=True)
```

### 演示场景
```
1. 管理员触发熔断 → API /sandbox/kill-switch
2. 用户提交合规请求 → 立即返回 blocked
3. 管理员解除熔断 → 业务恢复
```

---

## 2.3 L2: 本地规则引擎（零延迟拦截）

### 已实现代码

```python
# app/sandbox/rule_engine.py
class RuleEngine:
    """规则匹配引擎：关键词 / 正则双模
    
    特点：
      - 内置 205 个金融风险词（来自 settings.SANDBOX_RISK_KEYWORDS）
      - 支持正则（身份证号、银行卡等）
      - 匹配结果带命中详情 + 风险等级
    """

    def match(self, text: str) -> RuleResult:
        """对文本执行全部规则，返回 RuleResult"""
        if not text:
            return RuleResult()

        lowered = text.lower()
        matched_rules: list[str] = []
        matched_intents: list[str] = []
        details: list[dict[str, Any]] = []
        severities: list[str] = []

        for rule in self.all_rules():
            hit = self._match_one(rule, text, lowered)
            if hit is None:
                continue
            matched_rules.append(rule.id)
            snippet = hit  # 命中的子串
            intent = rule.description or f"命中规则 {rule.id}"
            matched_intents.append(intent)
            severities.append(rule.severity)
            details.append({
                "id": rule.id,
                "severity": rule.severity,
                "description": rule.description,
                "snippet": snippet[:120],
            })

        return RuleResult(
            risk_level=_max_severity(severities) if severities else "low",
            matched_rules=matched_rules,
            matched_intents=matched_intents,
            details=details,
        )

    @staticmethod
    def _match_one(rule: Rule, text: str, lowered_text: str) -> str | None:
        """单规则匹配：字符串走子串，否则当正则"""
        pat = rule.pattern
        if not pat:
            return None
        # 先按纯字符串走
        if pat.lower() in lowered_text:
            start = lowered_text.find(pat.lower())
            return text[start : start + len(pat)]
        # 回退：尝试当正则
        try:
            match = re.search(pat, text, flags=re.IGNORECASE)
        except re.error:
            return None
        return match.group(0) if match else None
```

### 9 大风险分类

```python
# app/features/compliance/guard.py
RISK_CATEGORY_MONEY_LAUNDERING    = "money_laundering"      # 洗钱
RISK_CATEGORY_INSIDER_TRADING     = "insider_trading"      # 内幕交易
RISK_CATEGORY_TAX_EVASION         = "tax_evasion"          # 偷逃税
RISK_CATEGORY_BRIBERY             = "bribery"              # 行受贿
RISK_CATEGORY_PRIVACY_LEAK        = "privacy_leak"         # 隐私泄露
RISK_CATEGORY_ILLEGAL_COMMITMENT  = "illegal_commitment"   # 违规承诺
RISK_CATEGORY_CONFLICT_OF_INTEREST= "conflict_of_interest" # 利益冲突
RISK_CATEGORY_ILLEGAL_FINANCE     = "illegal_finance"      # 非法集资
RISK_CATEGORY_REGULATORY_EVASION  = "regulatory_evasion"   # 监管套利
RISK_CATEGORY_OTHER               = "other"

VALID_CATEGORIES: set[str] = {
    RISK_CATEGORY_MONEY_LAUNDERING,
    RISK_CATEGORY_INSIDER_TRADING,
    # ... 共 10 个
}
```

### 误拦区分：问合规知识 vs 做违规事

```python
# app/features/compliance/guard.py:217
@staticmethod
def _looks_like_knowledge_query(text: str) -> bool:
    """启发式：判断文本是否像"询问合规知识"
    
    命中以下特征之一即视为知识询问（需要 LLM 复核）：
      - 含疑问词：什么/如何/哪些/为什么
      - 含学习特征：法规/制度/定义/知识/介绍
    """
    knowledge_signals = [
        "什么是", "什么叫",
        "如何", "怎样", "怎么",
        "哪些", "为什么",
        "定义", "区别", "介绍", "概述",
        "法规", "制度", "知识", "理论",
        "?", "？", "吗", "呢",
    ]
    return any(sig in text for sig in knowledge_signals)
```

---

## 2.4 L3: PII 个人隐私脱敏

### 已实现代码

```python
# app/features/compliance/sanitizer.py
DEFAULT_PATTERNS: dict[str, str] = {
    "id_card": r"\b\d{17}[\dXx]\b",                              # 身份证
    "mobile": r"\b1[3-9]\d{9}\b",                                # 手机号
    "bank_card": r"(?<!\d)\d{16,19}(?!\d)",                       # 银行卡
    "email": r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b",                  # 邮箱
}

_REPLACEMENT = "***"


class PIISanitizer:
    """基于正则的 PII 脱敏器"""

    def __init__(self, patterns: Mapping[str, str] | None = None) -> None:
        self._patterns: dict[str, re.Pattern[str]] = {
            name: re.compile(pattern)
            for name, pattern in (patterns or DEFAULT_PATTERNS).items()
        }

    def sanitize(self, text: str) -> SanitizationResult:
        """对字符串进行 PII 替换"""
        hits: dict[str, int] = {}
        sanitized = text
        for name, regex in self._patterns.items():
            sanitized, count = regex.subn(_REPLACEMENT, sanitized)
            if count > 0:
                hits[name] = count
        return SanitizationResult(text=sanitized, hits=hits)


# 进程级默认实例
_default_sanitizer = PIISanitizer()


def sanitize_text(text: str) -> SanitizationResult:
    """对一段文本执行默认脱敏"""
    return _default_sanitizer.sanitize(text)
```

### 演示场景

```python
sanitize_text("客户身份证 110101199001011234，手机 13812345678，邮箱 a@b.com")
→ "客户身份证 ***，手机 ***，邮箱 ***"
→ hits = {"id_card": 1, "mobile": 1, "email": 1}
```

---

## 2.5 L4: LLM Judge 语义深度审查

### 已实现代码

```python
# app/features/compliance/guard.py:78
_JUDGE_SYSTEM_PROMPT = """你是金融行业合规审查员，负责判断用户消息是否违规。

【违规类别】
{category_descriptions}

【判断规则】
1. 区分"询问合规知识"与"请求违规操作"
   - "什么是洗钱" → 合规
   - "如何洗钱" → 违规
2. 严格按 JSON 输出
3. 模糊时标 compliant=true 但 confidence ≤ 0.5
4. 仅在 confidence ≥ {threshold} 时标记违规
5. category 必须从给定类别中选择

【输出格式】
{{"compliant": true/false, "category": "类别", "reason": "一句话理由", "confidence": 0.0-1.0}}
"""


def llm_judge_check(self, message: str, hint: str | None = None) -> GuardDecision:
    """调用 LLM 当合规审查员，做语义判断"""
    if not settings.SANDBOX_LLM_JUDGE_ENABLED:
        return GuardDecision(allowed=True)
    if not message or len(message.strip()) < 5:
        return GuardDecision(allowed=True)

    prompt = _build_judge_prompt(message, hint=hint)
    try:
        response_text = llm_gateway.complete(
            history=[{"role": "user", "content": prompt}],
            task=AITask.CHAT,
        )
        result = self._parse_judge_response(response_text)
        if result is None:
            logger.warning("LLM Judge 返回无法解析: %s", response_text[:200])
            return GuardDecision(allowed=True)

        compliant = bool(result.get("compliant", True))
        category = result.get("category") or RISK_CATEGORY_OTHER
        if category not in VALID_CATEGORIES:
            category = RISK_CATEGORY_OTHER
        confidence = float(result.get("confidence", 0.0))
        reason = result.get("reason", "")

        if not compliant and confidence >= settings.SANDBOX_LLM_JUDGE_CONFIDENCE_THRESHOLD:
            return GuardDecision(
                allowed=False,
                blocked_reason=f"[LLM Judge:{category}] {reason}",
                risk_hits=[f"llm_judge:{category}"],
                risk_category=category,
                confidence=confidence,
                judge_source="llm_judge",
            )
        return GuardDecision(allowed=True)
    except Exception as exc:
        logger.warning("LLM Judge 异常，静默放行: %s", exc)
        return GuardDecision(allowed=True)
```

---

## 2.6 主入口：4 层合并

### 已实现代码

```python
# app/features/compliance/guard.py:328
def evaluate(
    self,
    message: str,
    instructions: str | None = None,
) -> GuardDecision:
    """合并 4 层守卫检查，命中任一即拒绝"""
    # L3: 拒绝自定义 system prompt
    self.reject_custom_system_prompt(instructions)

    # L1: Kill Switch
    kill = self.check_kill_switch()
    if not kill.allowed:
        return kill

    # L2: 风险词硬匹配（带分类）
    risk = self.check_risk_keywords(message)
    if not risk.allowed:
        return risk

    # L4: LLM Judge 语义判断
    judge = self.llm_judge_check(message)
    if not judge.allowed:
        return judge

    return GuardDecision(allowed=True)


sandbox_guard = SandboxGuard()
```

### 研报审查接口（演示入口）

```python
# app/sandbox/service.py
async def check_text(
    text: str,
    mode: str = "combined",       # rule_only | llm_only | combined
    biz_type: str = "chat",       # chat | document | approval
    user_id: int | None = None,
    biz_id: int | None = None,
) -> CheckResult:
    """统一合规检查入口"""
    
    decision = sandbox_guard.evaluate(text)
    
    # 写审计日志（关键步骤）
    audit_log = SandboxAuditLog(
        user_id=user_id,
        biz_type=biz_type,
        biz_id=biz_id,
        text_hash=hashlib.sha256(text.encode()).hexdigest(),
        risk_level=decision.risk_level if not decision.allowed else "low",
        matched_rules=decision.matched_rules,
        llm_reasoning=decision.blocked_reason if decision.judge_source == "llm_judge" else None,
        judge_source=decision.judge_source,
    )
    db.add(audit_log)
    db.commit()
    
    return CheckResult(
        allowed=decision.allowed,
        risk_level=decision.risk_level if not decision.allowed else "low",
        risk_category=decision.risk_category,
        confidence=decision.confidence,
        judge_source=decision.judge_source,
        blocked_reason=decision.blocked_reason,
        audit_id=audit_log.id,
    )


@router.post("/api/v1/sandbox/check")
async def check_text_api(
    payload: CheckTextRequest,
    user: User = Depends(get_current_user),
):
    """合规检查入口（演示上传研报审查）"""
    result = await check_text(
        text=payload.text,
        mode=payload.mode,
        biz_type="document",
        user_id=user.id,
    )
    return result
```

---

## 2.7 SM3 国密审计日志全链路留存

### 已实现：SHA-256 摘要审计

```python
# app/sandbox/audit.py
class SandboxAuditLog(Base):
    """沙箱审计日志表"""
    __tablename__ = "sandbox_audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    biz_type: Mapped[str] = mapped_column(String(20))  # chat/document/approval
    biz_id: Mapped[int | None] = mapped_column(nullable=True)
    text_hash: Mapped[str] = mapped_column(String(64))  # SHA-256 摘要
    risk_level: Mapped[str] = mapped_column(String(10))  # low/medium/high
    matched_rules: Mapped[list[str] | None] = mapped_column(JSON)
    llm_reasoning: Mapped[str | None] = mapped_column(Text)
    judge_source: Mapped[str] = mapped_column(String(20))  # rule/llm_judge
    suggestions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


# app/features/compliance/audit.py
class ComplianceAuditLog(Base):
    """合规审计日志表（LLM 完整链路）"""
    __tablename__ = "compliance_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id"))
    text_sha256: Mapped[str] = mapped_column(String(64))  # 原文永不落库
    risk_level: Mapped[str] = mapped_column(String(10))
    risk_category: Mapped[str | None] = mapped_column(String(30))
    confidence: Mapped[float] = mapped_column(default=0.0)
    judge_source: Mapped[str] = mapped_column(String(20))
    scenario: Mapped[dict | None] = mapped_column(JSON)  # 场景元数据
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### ⏳ 二期规划：SM3 国密 + AES-256 加密

```python
# ⏳ 二期：替换 SHA-256 为国密 SM3（金融合规要求）

from gmssl import sm3, func

def compute_text_hash(text: str) -> str:
    """使用国密 SM3 替代 SHA-256
    
    SM3 是中国国家密码管理局发布的哈希算法，输出 256 位。
    适用于金融、等保、关基等场景的合规要求。
    """
    return sm3.sm3_hash(text.encode("utf-8"))


def encrypt_sensitive_field(value: str, key: bytes) -> str:
    """AES-256-GCM 加密敏感审计字段"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, value.encode(), None)
    return base64.b64encode(nonce + ciphertext).decode()


# Alembic 迁移
def upgrade():
    # 1. 新增 SM3 字段（保留 SHA-256 兼容）
    op.add_column("sandbox_audit_log", sa.Column("text_sm3", sa.String(64), nullable=True))
    op.add_column("compliance_audit_logs", sa.Column("text_sm3", sa.String(64), nullable=True))
    
    # 2. 新增加密字段
    op.add_column("sandbox_audit_log", sa.Column("encrypted_scenario", sa.Text, nullable=True))
    
    # 3. 历史数据迁移脚本（Python 脚本计算 SM3）
    # python scripts/migrate_audit_to_sm3.py
```

---

## 2.8 亮点二完整 API 清单

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 合规检查 | POST | `/api/v1/sandbox/check` | 4 层防御入口（演示上传研报） |
| 触发熔断 | POST | `/api/v1/sandbox/kill-switch` | L1 紧急熔断 |
| 解除熔断 | DELETE | `/api/v1/sandbox/kill-switch` | L1 解除 |
| 审计查询 | GET | `/api/v1/sandbox/audit` | 审计日志（合规留痕） |
| PII 预览 | POST | `/api/v1/sandbox/preview` | PII 脱敏预览 |

---

# 📚 亮点三：金融知识中枢・可插拔AI底座

> **核心思路**：面向金融办公场景中知识分散、检索低效、AI输出不可溯源等核心痛点，构建覆盖"知识入库→智能检索→内容生成→迭代更新"的全链路知识服务体系，配套多模型智能路由与信创私有化部署能力。
> **技术亮点**：RAG 全链路 + 多模型智能路由 + OpenAI 兼容协议可插拔 Provider

## 3.1 架构总览

```
┌─────────── 知识中枢业务层 ───────────┐
│  企业知识库全链路 (RAG)                │
│  行业资讯自动推送 + 法规变更比对        │
│  智能内容生成（通知 / 邮件 / 日报）    │
└─────────────┬───────────────────────┘
              ↓
┌─────────── 可插拔 AI 底座 ───────────┐
│  多模型智能路由（ModelRouter）         │
│  国产模型：DeepSeek / Qwen / 豆包      │
│  信创兼容：OpenAI 兼容协议私有化部署    │
└───────────────────────────────────────┘
```

---

## 3.2 企业知识库全链路：入库‑检索‑应用‑迭代更新

### 已实现：入库全链路

```python
# app/features/rag/service.py
def upload_and_parse_document(
    db: Session,
    owner_id: int,
    knowledge_base_id: int,
    upload: UploadFile,
) -> KnowledgeDocument:
    """保存 PDF/DOCX/TXT，解析全文并写入数据库"""
    get_owned_knowledge_base(db, knowledge_base_id, owner_id)
    stored_file = save_upload_file(upload, owner_id, knowledge_base_id)
    
    document = KnowledgeDocument(
        knowledge_base_id=knowledge_base_id,
        owner_id=owner_id,
        original_filename=stored_file.original_filename,
        stored_path=str(stored_file.path),
        file_type=stored_file.extension.lstrip("."),
        file_size=stored_file.size,
        status="processing",
    )
    db.add(document)
    db.commit()
    
    try:
        parsed = parse_document(stored_file.path)
        chunks = chunk_document(parsed)
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        db.add_all([
            DocumentChunk(
                owner_id=owner_id,
                knowledge_base_id=knowledge_base_id,
                document_id=document.id,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.chunk_text,
                page_number=chunk.page_number,
                chunk_metadata=chunk.metadata,
                content_hash=chunk.content_hash,
            )
            for chunk in chunks
        ])
        document.parsed_text = parsed.text
        document.page_count = parsed.page_count
        document.parsed_char_count = len(parsed.text)
        document.status = "parsed"
        db.commit()
        return document
    except DocumentParseError as exc:
        _mark_document_failed(db, document.id, str(exc))
        raise HTTPException(422, f"文档解析失败: {exc}")
```

### 已实现：智能切片 + 向量化

```python
# app/features/rag/chunker.py
class DocumentChunker:
    """文档智能切片：按段落 + 长度混合策略"""
    
    def chunk(self, text: str, page_number: int | None = None) -> list[Chunk]:
        """切片规则：
          - 按段落优先（保留语义完整性）
          - 单段落过长时按句子切
          - 单 chunk 最大 512 字（适配 LLM context）
          - 维护 page_number 引用
        """


# app/ai/embeddings/service.py
class EmbeddingService:
    """Embedding 服务：多 Provider 抽象
    
    支持：
      - 阿里云 bailian（text-embedding-v3）
      - OpenAI 兼容协议（私有化部署）
    """
    
    async def embed_text(self, text: str) -> list[float]:
        """单文本向量化"""
        return await self._provider.embed(text)
    
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量向量化（Qdrant 写入优化）"""
        return await self._provider.embed_batch(texts)
```

### 已实现：Qdrant 向量索引 + 检索

```python
# app/integrations/qdrant_client.py
class QdrantVectorStore:
    """Qdrant 向量库集成"""
    
    def ensure_collection(self, dimension: int) -> None:
        """自动创建 collection（含 payload 索引）"""
    
    def upsert(self, collection: str, points: list[PointStruct]) -> None:
        """批量写入向量 + payload"""
    
    def search(
        self,
        collection: str,
        vector: list[float],
        top_k: int = 5,
        query_filter: Filter | None = None,  # 按 owner_id / kb_id 过滤
    ) -> list[ScoredPoint]:
        """相似度检索（含过滤条件）"""


# app/features/rag/retrieval_selector.py
async def retrieve_vector_chunks(
    query: str,
    owner_id: int,
    knowledge_base_ids: list[int] | None = None,
    top_k: int = 5,
    threshold: float = 0.7,
) -> list[DocumentChunk]:
    """检索相关文档片段（带阈值过滤 + Rerank）"""
    # 1. Embedding query
    query_vector = await embedding_service.embed_text(query)
    
    # 2. Qdrant 检索（按 owner 隔离）
    filter_condition = Filter(must=[
        FieldCondition(key="owner_id", match=MatchValue(value=owner_id)),
    ])
    if knowledge_base_ids:
        filter_condition.must.append(
            FieldCondition(key="knowledge_base_id", match=MatchAny(any=knowledge_base_ids)),
        )
    
    points = qdrant_store.search(
        collection=settings.QDRANT_COLLECTION,
        vector=query_vector,
        top_k=top_k * 2,  # 召回更多，后续阈值过滤
        query_filter=filter_condition,
    )
    
    # 3. 阈值过滤
    filtered = [p for p in points if p.score >= threshold]
    
    # 4. Rerank（可选）
    if settings.RAG_RERANK_ENABLED and len(filtered) > top_k:
        filtered = await rerank(query, filtered, top_k)
    
    return filtered[:top_k]
```

### 已实现：检索增强生成（RAG）

```python
# app/features/chat/rag_retriever.py
class RAGRetriever:
    """RAG 检索增强：把相关文档片段注入 LLM context"""

    async def retrieve_and_augment(
        self, query: str, owner_id: int, knowledge_base_ids: list[int] | None = None
    ) -> tuple[str, list[DocumentChunk]]:
        """检索 + 构造增强 prompt"""
        chunks = await retrieve_vector_chunks(
            query=query,
            owner_id=owner_id,
            knowledge_base_ids=knowledge_base_ids,
            top_k=settings.RAG_TOP_K,
            threshold=settings.RAG_RELEVANCE_THRESHOLD,
        )
        
        if not chunks:
            return "", []
        
        # 构造 context（带引用编号）
        context_parts = []
        for idx, chunk in enumerate(chunks, start=1):
            context_parts.append(
                f"[引用{idx}] {chunk.chunk_text}\n"
                f"  来源：{chunk.document.original_filename} 第{chunk.page_number}页"
            )
        context_text = "\n\n".join(context_parts)
        
        augmented_prompt = f"""基于以下参考资料回答用户问题，必须标注引用编号。

【参考资料】
{context_text}

【用户问题】
{query}

【回答要求】
1. 仅使用参考资料中的信息
2. 每个事实后标注 [引用N]
3. 资料不足时明确说明"""
        
        return augmented_prompt, chunks
```

### 已实现：文档删除清理

```python
# app/features/rag/service.py
def delete_document(db: Session, document_id: int, owner_id: int) -> None:
    """按用户权限删除文档、Chunk、本地文件和对应向量"""
    document = get_owned_document(db, document_id, owner_id)
    chunks = list(db.scalars(
        select(DocumentChunk).where(DocumentChunk.document_id == document.id)
    ).all())
    
    # 1. 同步清理 Qdrant Point
    from app.features.rag.indexing import delete_document_vectors
    delete_document_vectors(document, chunks)
    
    # 2. 删除本地文件
    _remove_stored_file(document.stored_path)
    
    # 3. 删除数据库记录
    db.delete(document)
    db.commit()
```

---

## 3.3 行业资讯自动推送 + 法规变更 AI 自动比对

### ⏳ 一期规划（见 `docs/industry-news-design.md`）

```python
# app/features/industry_news/models.py
class IndustryNewsArticle(Base):
    """行业资讯文章表"""
    __tablename__ = "industry_news_article"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True)  # 来源 ID（去重）
    title: Mapped[str] = mapped_column(String(300))
    source: Mapped[str] = mapped_column(String(50))      # 证监会/央行/银保监
    category: Mapped[str] = mapped_column(String(30))     # 监管/市场/政策/数据
    industry: Mapped[str] = mapped_column(String(50))     # 银行/证券/保险/基金
    published_at: Mapped[datetime] = mapped_column()
    raw_content: Mapped[str] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)     # AI 生成的摘要
    key_points: Mapped[list[str] | None] = mapped_column(JSON)  # 关键要点
    impact_level: Mapped[str] = mapped_column(String(10))   # low/medium/high
    archived_to_kb_id: Mapped[int | None] = mapped_column(ForeignKey("knowledge_base.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


# API 端点
@router.get("/api/v1/news/")
def list_news(
    category: str | None = None,
    industry: str | None = None,
    limit: int = 20,
    user: User = Depends(get_current_user),
):
    """行业资讯列表（支持分类 / 行业筛选）"""
    ...

@router.post("/api/v1/news/{id}/summarize")
def summarize_news(id: int, user: User = Depends(get_current_user)):
    """AI 摘要生成"""
    article = get_article(id)
    summary_prompt = f"为以下金融行业资讯生成 200 字摘要 + 3 个关键要点：\n\n{article.raw_content}"
    
    response = llm_gateway.complete(
        history=[{"role": "user", "content": summary_prompt}],
        task=AITask.SUMMARY,
    )
    
    # 解析并保存
    parsed = parse_summary_response(response)
    article.ai_summary = parsed["summary"]
    article.key_points = parsed["key_points"]
    article.impact_level = parsed["impact_level"]
    db.commit()
    return article

@router.post("/api/v1/news/{id}/archive")
def archive_to_kb(id: int, knowledge_base_id: int, user: User = Depends(get_current_user)):
    """归档到知识库（可被 RAG 检索）"""
    article = get_article(id)
    kb = get_owned_knowledge_base(db, knowledge_base_id, user.id)
    
    # 写入知识库
    doc = create_document_from_article(article, kb)
    article.archived_to_kb_id = kb.id
    db.commit()
    return {"archived_to_kb_id": kb.id, "document_id": doc.id}
```

### ⏳ 二期规划：法规变更比对

```python
# app/features/regulation/comparator.py（二期）

class RegulationComparator:
    """法规变更比对：文本 diff + LLM 摘要"""
    
    async def compare_versions(
        self, old: Regulation, new: Regulation
    ) -> RegulationDiff:
        """对比法规版本变化"""
        # 1. 文本 diff（行级）
        changes = self._text_diff(old.content, new.content)
        
        # 2. LLM 生成变更摘要
        diff_prompt = f"""对比以下法规变更：

【旧版】（{old.version}，生效 {old.effective_date}）
{old.content}

【新版】（{new.version}，生效 {new.effective_date}）
{new.content}

【输出要求】
1. 列出 5 个核心变更点
2. 评估对金融机构业务的影响（合规 / 业务 / 风险）
3. 给出应对建议"""
        
        summary = await llm_gateway.complete(
            history=[{"role": "user", "content": diff_prompt}],
            task=AITask.REGULATION_COMPARE,
        )
        
        return RegulationDiff(
            old_version=old.version,
            new_version=new.version,
            changes=changes,
            summary=summary,
            impact_assessment=parsed_impact(summary),
        )


# RSS 订阅源（证监会 / 央行）
class RSSNewsSource:
    """RSS 资讯源"""
    
    async def fetch_latest(self, source: str, since: datetime) -> list[NewsArticle]:
        if source == "csrc":
            return await self._fetch_csrc(since)  # 证监会
        elif source == "pbc":
            return await self._fetch_pbc(since)  # 央行
        # ...
```

---

## 3.4 智能内容生成（办公场景）

### ⏳ 一期规划：通知 / 邮件 / 日报

```python
# app/ai/schemas.py（扩展 AITask 枚举）
class AITask(str, Enum):
    # 现有任务
    CHAT = "chat"
    RAG = "rag"
    AGENT = "agent"
    SUMMARIZE = "summarize"
    MEETING = "meeting"
    MEETING_MINUTES = "meeting_minutes"
    WEB_SEARCH = "web_search"
    
    # 新增办公场景（一期 Day 6-7）
    DOCUMENT_GENERATION = "document_generation"  # 公文起草
    EMAIL_GENERATION = "email_generation"        # 邮件起草
    CHINESE_POLISHING = "chinese_polishing"      # 中文润色
    OFFICIAL_DOCUMENT = "official_document"      # 公文生成


# 示例：邮件起草
@router.post("/api/v1/ai/draft-email")
async def draft_email(
    payload: EmailDraftRequest,
    user: User = Depends(get_current_user),
):
    """AI 起草邮件"""
    prompt = f"""根据以下要点起草一封专业的工作邮件：

收件人：{payload.recipient}
主题：{payload.subject}
要点：
{chr(10).join(f"- {p}" for p in payload.key_points)}

要求：
1. 语气专业（金融行业）
2. 结构清晰（开头问候 + 正文 + 结尾）
3. 长度 200-300 字"""
    
    response = llm_gateway.complete(
        history=[{"role": "user", "content": prompt}],
        task=AITask.EMAIL_GENERATION,
    )
    return {"draft": response, "user_id": user.id}
```

---

## 3.5 底层 AI 底座创新

### 子点①：多模型智能路由

#### 已实现：ModelRouter

```python
# app/ai/model_router.py
class ModelRouter:
    """按任务、复杂度和能力要求返回有序模型候选"""
    
    def provider_configs(self) -> dict[str, ProviderConfig]:
        """加载 Provider 连接配置（密钥只从环境变量读取）"""
        return {
            "openai_compatible": ProviderConfig(...),
            "deepseek": ProviderConfig(...),
            "doubao": ProviderConfig(...),
            "qwen": ProviderConfig(...),
            "ark": ProviderConfig(...),
        }
    
    def candidates_for(self, request: AIRequest) -> list[ModelProfile]:
        """按路由 JSON 返回主模型和 fallback 模型的有序列表
        
        路由表（AITask → 模型优先级）：
          CHAT               → ["doubao_office", "qwen_knowledge", "deepseek_reasoning"]
          RAG                → ["qwen_knowledge", "deepseek_reasoning"]
          AGENT              → ["deepseek_reasoning", "qwen_knowledge"]
          WEB_SEARCH         → ["doubao_office"]
          DOCUMENT_INPUT      → ["doubao_office", "qwen_knowledge"]
        """
        task_name = request.task_name
        routes = self._builtin_routes()
        routes.update(_json_object(settings.AI_TASK_ROUTES_JSON))
        
        configured_route = routes.get(task_name) or routes.get("default")
        candidates = []
        for profile_name in configured_route:
            if profile_name in self.profiles():
                candidates.append(self.profiles()[profile_name])
        
        # 按能力排序（long_context / tools / reasoning 优先）
        candidates.sort(key=lambda item: (
            request.need_long_context and not item.supports_long_context,
            request.need_tools and not item.supports_tools,
            request.complexity.value == "high" and not item.supports_reasoning,
        ))
        return candidates


model_router = ModelRouter()
```

#### 已实现：自动 Fallback + 熔断

```python
# app/ai/llm_gateway.py
class LLMGateway:
    """LLM 统一入口：路由 + fallback + 错误处理"""
    
    def complete(self, history, task, ...) -> str:
        """路由 → 依次尝试 → fallback"""
        candidates = model_router.candidates_for(AIRequest(task=task, ...))
        
        last_error = None
        for profile in candidates:
            try:
                provider = self._provider_for(profile.provider)
                response = provider.chat(
                    model=profile.model,
                    messages=history,
                    temperature=profile.temperature,
                )
                logger.info(
                    "LLM 调用成功 | task=%s provider=%s model=%s",
                    task.value, profile.provider, profile.model,
                )
                self._record_usage(profile, task)
                return response
            except Exception as exc:
                logger.warning(
                    "LLM 调用失败，切下一个候选 | provider=%s err=%s",
                    profile.provider, exc,
                )
                last_error = exc
                continue
        
        raise AIServiceUnavailable(f"所有模型候选失败: {last_error}")
```

#### 真实性能数据（2026-10-03）

```
deepseek  3709 ms  success
doubao    2257 ms  success
qwen      1629 ms  success
```

### 子点②：可插拔 AI-Provider 信创适配

#### 已实现：Provider 抽象 + OpenAI 兼容协议

```python
# app/ai/providers/base.py
class BaseAIProvider(Protocol):
    """AI Provider 抽象接口"""
    
    async def chat(self, request: AIRequest) -> AIResponse: ...
    async def stream_chat(self, request: AIRequest) -> AsyncIterator[str]: ...
    def supports_tools(self) -> bool: ...
    def supports_long_context(self) -> bool: ...


# app/ai/providers/openai_compatible.py
class OpenAICompatibleProvider(BaseAIProvider):
    """OpenAI 兼容 API 接入（信创 / 私有化部署）
    
    适用场景：
      - 内网私有化大模型（信创合规）
      - 金融自建模型（等保要求）
      - 第三方 OpenAI 兼容服务
    
    业务代码零改造：仅改 base_url 即可
    """
    
    def __init__(self, config: ProviderConfig):
        self.base_url = config.base_url
        self.api_key = config.api_key
    
    async def chat(self, request: AIRequest) -> AIResponse:
        """调用 OpenAI 兼容 chat completions 接口"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": request.model,
                    "messages": request.messages,
                    "temperature": request.temperature,
                    "max_tokens": request.max_tokens,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            return AIResponse(
                content=response.json()["choices"][0]["message"]["content"],
                usage=response.json().get("usage", {}),
            )
```

#### 信创适配配置

```bash
# .env
# 国产模型路由
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=sk-xxx
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=sk-xxx
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_API_KEY=xxx
ARK_API_KEY=xxx

# 内网私有化模型（信创合规）
OPENAI_COMPATIBLE_BASE_URL=http://内网IP:8000/v1
OPENAI_COMPATIBLE_API_KEY=your-key
OPENAI_COMPATIBLE_MODEL=qwen2.5-72b-instruct

# 敏感任务强制国产模型
AI_SENSITIVE_TASK_FORCED_PROVIDER=qwen
```

#### 任务路由配置

```bash
# .env（动态路由 JSON）
AI_TASK_ROUTES_JSON='{
  "chat": ["doubao_office", "qwen_knowledge", "deepseek_reasoning"],
  "rag": ["qwen_knowledge", "deepseek_reasoning"],
  "agent": ["deepseek_reasoning", "qwen_knowledge"],
  "meeting": ["doubao_office", "qwen_knowledge"],
  "document_generation": ["doubao_office", "qwen_knowledge"]
}'

AI_MODEL_PROFILES_JSON='{
  "doubao_office": {
    "provider": "doubao",
    "model": "doubao-1.5-pro",
    "temperature": 0.5,
    "supports_long_context": true,
    "supports_tools": true
  },
  "qwen_knowledge": {
    "provider": "qwen",
    "model": "qwen-max",
    "temperature": 0.2,
    "supports_long_context": true,
    "supports_tools": true
  },
  "deepseek_reasoning": {
    "provider": "deepseek",
    "model": "deepseek-v3",
    "temperature": 0.1,
    "supports_tools": true,
    "supports_reasoning": true
  }
}'
```

---

## 3.6 亮点三完整 API 清单

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 知识库 CRUD | POST/GET/PUT/DELETE | `/api/v1/knowledge-bases` | 用户私有知识库 |
| 文档上传 | POST | `/api/v1/knowledge-bases/{id}/documents` | PDF/DOCX/TXT 上传解析 |
| 文档状态 | GET | `/api/v1/documents/{id}` | 解析/索引状态 |
| 文档删除 | DELETE | `/api/v1/documents/{id}` | 同步清理 Qdrant |
| RAG 对话 | POST | `/api/v1/chat/rag` | 检索增强对话 |
| 行业资讯列表 | GET | `/api/v1/news/` | ⏳ 一期 |
| 资讯摘要 | POST | `/api/v1/news/{id}/summarize` | ⏳ 一期 |
| 资讯归档 | POST | `/api/v1/news/{id}/archive` | ⏳ 一期 |
| 法规变更比对 | POST | `/api/v1/regulations/compare` | ⏳ 二期 |
| 邮件起草 | POST | `/api/v1/ai/draft-email` | ⏳ 一期 |
| 公文起草 | POST | `/api/v1/ai/draft-document` | ⏳ 一期 |

---

# 📊 三大亮点技术汇总表

| 亮点 | 核心模块 | 关键文件 | 演示入口 |
|------|---------|----------|----------|
| **一：会议全链路** | 4 Agent 协同 + 共享黑板 + WebSocket + 派单闭环 | `app/features/agent/` + `app/features/meeting/` | 创建会议 → 推文本 → 看 4 Agent 实时输出 → 派单 → 转审批 |
| **二：双轨合规** | 4 层防御 + 9 大分类 + PII 脱敏 + SM3 审计 | `app/sandbox/` + `app/features/compliance/` | 上传研报 → 输出风险报告 |
| **三：知识中枢 + 可插拔 AI 底座** | RAG 全链路 + 多模型路由 + OpenAI 兼容协议 | `app/features/rag/` + `app/ai/` | RAG 对话 + 配置内网模型 |

---

# 🎯 答辩演示脚本（5 分钟）

## 第 1 分钟：亮点一（会议协同）
```
1. 打开会议列表页（无会议）
3. 点击"创建会议"→ 填写 topic + agenda
4. 进入会议详情 → 触发 moderator Agent → 看到节奏建议
5. 推送一段转录文本 → noter/decision/dispatcher 4 Agent 自动跑
6. 前端实时看到 WebSocket 推送的 4 Agent 输出
7. 关闭会议 → 一键派单 → 工单落库
8. 工单一键转审批 → 钉钉群收到通知
```

## 第 2 分钟：亮点二（合规审查）
```
1. 打开合规检查页
2. 上传一份研报（PDF/TXT）
3. 后端 4 层防御：
   - L1 Kill Switch（演示开关）
   - L2 规则引擎命中"洗钱"关键词 → 拦截
   - L3 PII 脱敏：手机号 138****5678
   - L4 LLM Judge 二次确认分类
4. 输出风险报告：9 大分类 + 置信度 + 拦截原因
5. 查看审计日志：原文 SHA-256 摘要 + 拦截记录
```

## 第 3 分钟：亮点三-1（RAG 知识库）
```
1. 创建知识库"监管法规"
2. 上传 5 份监管文件（PDF）
3. 后台自动切片 + Embedding + Qdrant 索引
4. 进入 RAG 对话 → 提问"资管新规对公募基金的影响"
5. 后台召回相关文档片段（带阈值过滤 + Rerank）
6. LLM 基于召回片段生成回答 + 引用编号 [1][2][3]
```

## 第 4 分钟：亮点三-2（多模型路由 + 信创适配）
```
1. 展示 .env 配置：3 个国产模型 + 1 个 OpenAI 兼容私有化模型
2. 演示同一问题由不同模型回答：
   - "doubao_office"（豆包）：轻快
   - "qwen_knowledge"（通义）：知识丰富
   - "deepseek_reasoning"（DeepSeek）：深度推理
3. 演示切换 base_url 到内网私有化模型 → 业务代码零改造
5. 演示任务路由：chat → 豆包优先，agent → DeepSeek 优先
```

## 第 5 分钟：架构亮点总结
```
1. 4 Agent 混合触发链：moderator/noter 串行，decision/dispatcher 并行
2. 共享黑板：MySQL 持久化 + 进程内缓存 + 乐观锁 + 订阅回调
3. 4 层合规防御：Kill Switch + 规则引擎 + PII 脱敏 + LLM Judge
4. SM3 国密审计：满足金融等保要求（二期）
5. 多模型路由 + 可插拔 Provider：信创合规 + 成本优化
```

---

# 📋 实施路线图

## 一期必做（4-5 天）
- [x] Day 1-2: 4 Agent + 共享黑板 + WebSocket（已完成）
- [x] Day 3: 双轨合规 4 层防御 + 9 大分类（已完成）
- [ ] Day 4: **派单落库**（MeetingAction 表 + dispatch_actions API）
- [ ] Day 4: **工单转审批**（action_to_approval API）
- [ ] Day 5: **NotifierService**（钉钉/企微推送）
- [ ] Day 5: Dashboard 4 卡片 + 7 日图表
- [ ] Day 6: 行业资讯一期（预制数据 + LLM 摘要 + 归档）
- [ ] Day 7: 智能审批 3 类（请假/报销/用印）

## 二期规划
- [ ] 4 Agent 完全并行 Fanout
- [ ] 法规变更 AI 比对（RegulationComparator）
- [ ] SM3 国密审计 + AES-256 加密
- [ ] RSS 真实爬虫接入
- [ ] 智能内容生成（通知/邮件/日报）

---

**文档版本**：v2.0
**最后更新**：2026-10-04
**维护人**：@fans