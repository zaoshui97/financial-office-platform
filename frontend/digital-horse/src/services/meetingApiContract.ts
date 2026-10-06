/**
 * Meeting API Contract（前后端契约）
 *
 * ️ 本文件只定义类型与契约路径，不写实现。
 *
 * 设计原则：
 *   - 前端组件只调用 src/services/postMeetingService.ts 等业务 service
 *   - 业务 service 内部实现现在用 setTimeout mock，未来直接替换为 fetch/axios
 *   - 后端对照本文件的路径、请求体、响应体来实现即可
 *
 * 后端实现路径（真实对接时）：
 *   - POST /api/v1/meetings/:id/actions/dispatch
 *   - GET  /api/v1/meetings/:id/report
 *   - GET  /api/v1/meetings/:id/actions
 *   - PATCH /api/v1/actions/:id/close
 */

// ============================================================
// 1. POST /api/v1/meetings/:id/actions/dispatch
//    会后自动派单：把 Blackboard 中识别出的待办转成可执行工单
// ============================================================

export interface DispatchActionRequest {
  /** 由前端自动生成的去重幂等键，后端收到重复 key 应直接返回已存在工单 */
  idempotencyKey: string;
  /** 来源会议 ID */
  meetingId: string;
  /** 待办列表（来自 Blackboard.actions 的快照） */
  actions: Array<{
    id: string;
    description: string;
    assignee?: string;
    dueDate?: string;
    priority: 'low' | 'medium' | 'high';
    source: string;
    sourceTimestamp: number;
  }>;
  /** 是否立即通知被指派人（默认 true） */
  notify?: boolean;
}

export interface DispatchActionResponse {
  code: 200;
  message: 'success';
  data: {
    /** 本次派单总单号 */
    dispatchBatchId: string;
    /** 已生成的工单列表（带后端工单 ID） */
    workItems: Array<{
      /** 工单唯一 ID（后端生成） */
      workItemId: string;
      /** 对应的前端 Blackboard action ID */
      sourceActionId: string;
      /** 工单状态机：pending → in_progress → done */
      status: 'pending' | 'in_progress' | 'done';
      /** 工单创建时间（ISO 8601） */
      createdAt: string;
      /** 工单详情页 URL，前端可跳转 */
      url: string;
    }>;
    /** 是否所有 action 都派单成功 */
    allSuccess: boolean;
    /** 失败原因（如有） */
    failures?: Array<{ sourceActionId: string; reason: string }>;
  };
}

// ============================================================
// 2. GET /api/v1/meetings/:id/report
//    获取会后结构化报告（替代前端实时组装，真实场景后端可持久化）
// ============================================================

export interface GetReportResponse {
  code: 200;
  message: 'success';
  data: {
    meetingId: string;
    meetingTitle: string;
    startedAt: string;
    endedAt: string;
    durationSec: number;
    participants: Array<{ userId: string; name: string; department?: string }>;
    summary: string;
    sections: {
      decisions: Array<{ topic: string; decision: string; owner: string; confidence: number }>;
      actions: Array<{ id: string; description: string; assignee: string; dueDate: string; priority: string; status: string }>;
      risks: string[];
      facts: Array<{ content: string; speaker: string; ts: number }>;
      topics: string[];
    };
    /** 关联到知识库的文档 ID（可选） */
    linkedKnowledgeIds?: string[];
  };
}

// ============================================================
// 3. GET /api/v1/meetings/:id/actions
//    列出本次会议产生的全部工单
// ============================================================

export interface ListMeetingActionsResponse {
  code: 200;
  message: 'success';
  data: Array<{
    workItemId: string;
    description: string;
    assignee: string;
    dueDate: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'done';
    url: string;
    createdAt: string;
    /** 关联会议 ID（用于跳转审批后回填上下文） */
    meetingId?: string;
    /** 关联会议标题（可选） */
    meetingTitle?: string;
  }>;
}

// ============================================================
// 4. PATCH /api/v1/actions/:id/close
//    关闭某个工单（标记 done）
// ============================================================

export interface CloseOutActionRequest {
  remark?: string;
}

export interface CloseOutActionResponse {
  code: 200;
  message: 'success';
  data: {
    workItemId: string;
    status: 'done';
    closedAt: string;
  };
}

// ============================================================
// 5. POST /api/v1/reports/upload
//    PDF 上传到 OSS（导出 PDF 后可选择性归档）
// ============================================================

export interface UploadReportRequest {
  meetingId: string;
  /** base64 编码的 PDF 文件内容 */
  base64: string;
  filename: string;
}

export interface UploadReportResponse {
  code: 200;
  message: 'success';
  data: {
    fileId: string;
    url: string;
  };
}
