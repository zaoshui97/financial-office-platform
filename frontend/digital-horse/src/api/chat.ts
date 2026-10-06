/**
 * RAG 问答 + 合规沙箱 API（前端 → 后端 /api/v1/chat, /api/v1/compliance/sandbox/chat）
 */

import { http } from '@/utils/request';

// ── 类型定义 ────────────────────────────────────────────────

export interface Citation {
  document_id: number;
  chunk_id: number;
  title: string;
  source: string;
  excerpt: string;
  page_number?: number;
  relevance: number;
}

export interface RetrievedContext {
  chunk_id: number;
  document_id: number;
  content: string;
  score: number;
  page_number?: number;
}

export interface ChatResponse {
  conversation_id: string;
  assistant_message_id: string;
  mode: string;
  answer: string;
  citations: Citation[];
  retrieved_contexts: RetrievedContext[];
  used_citations: number[];
  task: string;
  provider: string;
  model: string;
  latency_ms: number;
  retrieval_method: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  knowledge_base_id?: number;
  mode?: 'llm' | 'rag' | 'web_search' | 'compliance_sandbox';
  task?: string;
}

export interface SandboxChatResponse {
  conversation_id: string;
  assistant_message_id: string;
  answer: string;
  mode: string;
  provider: string;
  model: string;
  latency_ms: number;
  sanitized_fields: string[];
  risk_hits: string[];
  audit_id: string;
  risk_category: string;
  confidence: number;
  judge_source: string;
}

export interface SandboxChatRequest {
  message: string;
  conversation_id?: string;
  task?: string;
}

// ── API ────────────────────────────────────────────────────

export const chatApi = {
  /** RAG 智能问答 */
  ask: (payload: ChatRequest) =>
    http.post<ChatResponse>('/chat', payload),

  /** 合规沙箱检测（独立的合规审查入口） */
  sandbox: (payload: SandboxChatRequest) =>
    http.post<SandboxChatResponse>('/compliance/sandbox/chat', payload),
};

export default chatApi;
