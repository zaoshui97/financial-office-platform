/**
 * ⚠️ 安全风险提示（Phase 1 临时保留）
 *
 * 1) 本文件直接用 `localStorage` 中保存的 DeepSeek API Key 在浏览器端发起请求，
 *    任何能访问到页面的用户都能从 Network/DevTools 看到 Key，**生产环境严禁使用**。
 *  2) 本 Phase 维持现状以兼容既有业务方要求；后续阶段将改为后端代理：
 *      - 浏览器 → /api/v1/ai/... （带 JWT）
 *      - 后端 → DeepSeek / Volcengine / 自建网关
 *    Key 仅保留在后端 .env 中。
 *  3) VITE_USE_MOCK=false 时，这部分代码仍可被前端 import 调用，但应避免在生产
 *    静态资源中暴露任何 demo key（README 与 Phase 2 改造会进一步约束）。
 */
import axios from 'axios';
import type { ActionItem, Meeting } from '@/types/api';

// DeepSeek API configuration
const DEEPSEEK_API_BASE = 'https://api.deepseek.com';

// Get API Key (user must configure in settings)
export const getApiKey = (): string | null => {
  return localStorage.getItem('deepseek_api_key');
};

// Check if API Key is configured
export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

// Set API Key
export const setApiKey = (key: string): void => {
  localStorage.setItem('deepseek_api_key', key);
};

// Generic DeepSeek API call
export const callDeepSeek = async (
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }
): Promise<string> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('请先在设置中配置 DeepSeek API Key');
  }

  try {
    const response = await axios.post(
      `${DEEPSEEK_API_BASE}/chat/completions`,
      {
        model: options?.model || 'deepseek-chat',
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2000,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('DeepSeek API error:', error);
    throw new Error(error.response?.data?.error?.message || 'API call failed');
  }
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

  return callDeepSeek(messages, { temperature: 0.7, maxTokens: 2000 });
};

// Meeting minutes generation
export const generateMeetingSummary = async (
  transcript: string
): Promise<string> => {
  const systemPrompt = `You are a professional meeting minutes generator. Please generate concise meeting minutes from the provided transcript, including key discussion points, decisions made, and action items.`;

  return callDeepSeek(
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

  return callDeepSeek(
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

  const response = await callDeepSeek(
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

  const response = await callDeepSeek(
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
  callDeepSeek,
  aiChatResponse,
  generateMeetingSummary,
  generateDocument,
  checkCompliance,
  generateDashboardInsights,
};
