/**
 * ⚠️ 安全修复：DeepSeek API Key 不再放前端
 *
 * 之前（Phase 1 临时）：
 *   - 本文件直接用 `localStorage` 中保存的 DeepSeek API Key 在浏览器端发起请求
 *   - 任何能访问到页面的用户都能从 Network/DevTools 看到 Key
 *
 * 现在（Phase 2 演示安全修复）：
 *   - 所有 AI 调用走本文件 → /api/v1/ai/chat → 后端 LLMGateway → DeepSeek/豆包/Qwen
 *   - Key 仅保留在后端 .env 中（DEEPSEEK_API_KEY / DOUBAO_API_KEY / QWEN_API_KEY）
 *   - 前端 localStorage 不再保存任何 Key（已留兼容逻辑清理老 Key）
 */
import axios from 'axios';
import type { ActionItem, Meeting } from '@/types/api';

// 启动时清理旧版本 localStorage 残留的 Key（一次性迁移）
try {
  localStorage.removeItem('deepseek_api_key');
} catch {
  /* ignore */
}

// 统一调用后端 AI 代理
async function proxyChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<string> {
  const token = (() => {
    try { return localStorage.getItem('access_token') || ''; } catch { return ''; }
  })();
  const { data } = await axios.post<{ content: string }>(
    '/api/v1/ai/chat',
    {
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      model: options?.model,
    },
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 30_000,
    }
  );
  if (!data?.content) throw new Error('AI 代理返回为空');
  return data.content;
}

// 旧 API 兼容：检测 Key（永远 false，老代码不再走分支）
export const getApiKey = (): string | null => null;
export const hasApiKey = (): boolean => false;
export const setApiKey = (_key: string): void => {
  // no-op：演示场景下不再让前端存 Key
};

// AI Q&A response
export const aiChatResponse = async (
  question: string,
  context?: string
): Promise<string> => {
  const systemPrompt = `You are a professional financial office AI assistant. Please answer user questions concisely and accurately. If context is provided, refer to it.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: context ? `${context}\n\nQuestion: ${question}` : question },
  ];

  return proxyChat(messages, { temperature: 0.7, maxTokens: 2000 });
};

// Meeting minutes generation
export const generateMeetingSummary = async (
  transcript: string
): Promise<string> => {
  const systemPrompt = `You are a professional meeting minutes generator. Please generate concise meeting minutes from the provided transcript, including key discussion points, decisions made, and action items.`;

  return proxyChat(
    [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Meeting transcript:\n${transcript}` },
    ],
    { temperature: 0.5, maxTokens: 1500 }
  );
};

// Document generation
export const generateDocument = async (
  template: string,
  formData: Record<string, any>
): Promise<string> => {
  const systemPrompt = `You are a professional document generator. Generate the requested document based on the template and form data.`;

  return proxyChat(
    [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Template: ${template}\n\nData: ${JSON.stringify(formData, null, 2)}` },
    ],
    { temperature: 0.7, maxTokens: 2000 }
  );
};

// Compliance check
export const checkCompliance = async (
  document: string
): Promise<{ status: 'pass' | 'warning' | 'fail'; issues: string[]; suggestions: string[] }> => {
  const systemPrompt = `You are a compliance reviewer. Analyze the document and return JSON with: status (pass/warning/fail), issues array, suggestions array.`;

  const response = await proxyChat(
    [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Document:\n${document}` },
    ],
    { temperature: 0.3, maxTokens: 1000 }
  );

  try {
    return JSON.parse(response);
  } catch {
    return {
      status: 'warning',
      issues: ['AI 响应解析失败'],
      suggestions: ['请人工复核文档'],
    };
  }
};

// Smart dashboard insights
export const generateDashboardInsights = async (
  context: {
    userName: string;
    actionItems: ActionItem[];
    meetings: Meeting[];
    knowledgeUpdates: number;
  }
): Promise<{
  greeting: string;
  priorityItems: string[];
  suggestions: string[];
  timeEstimate: string;
}> => {
  const systemPrompt = `You are a personal office assistant. Generate today's dashboard insights based on user context. Return JSON with: greeting, priorityItems (max 3, each no more than 20 chars), suggestions (max 2), timeEstimate. Return only JSON, no other content.`;

  const response = await proxyChat(
    [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      {
        role: 'user' as const,
        content: `User: ${context.userName}
Pending tasks: ${JSON.stringify(context.actionItems)}
Upcoming meetings: ${JSON.stringify(context.meetings)}
Knowledge base updates today: ${context.knowledgeUpdates}`,
      },
    ],
    { temperature: 0.7, maxTokens: 500 });

  try {
    const parsed = JSON.parse(response);
    return {
      greeting: parsed.greeting || '欢迎回来',
      priorityItems: parsed.priorityItems || [],
      suggestions: parsed.suggestions || [],
      timeEstimate: parsed.timeEstimate || '预计 1-2 小时',
    };
  } catch {
    return {
      greeting: '欢迎回来',
      priorityItems: ['查看待处理任务', '检查即将开始的会议'],
      suggestions: ['优先处理紧急任务'],
      timeEstimate: 'Approximately 1-2 hours',
    };
  }
};

// Default export
export default {
  proxyChat,
  aiChatResponse,
  generateMeetingSummary,
  generateDocument,
  checkCompliance,
  generateDashboardInsights,
};
