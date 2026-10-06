/**
 * Sandbox Log —— 沙箱运行日志存储
 *
 * 设计：
 *   - 单例内存 store（重启清空）
 *   - 最多保留 200 条历史快照
 *   - 每条日志：调用人 / 时间 / 输入哈希 / 输出结果 / 命中规则数
 *   - 真实对接后端时，只需把 record() 内的 update 替换为 axios.post
 *
 * 改动（业务联动）：
 *   - 每条日志绑定 businessRef（业务单据引用：研报 ID / 会议 ID / 审批 ID）
 *   - source 字段标准化：枚举 'approval' | 'report' | 'qa' | 'sandbox_page' | 'demo'
 *     | 'meeting_report' | 'meeting_export' | 'chat_ai' | 'industry_news_review'
 *
 * 用于：演示"全程留痕可审计"+ 报告页"本次检查历史"+ 业务单据"沙箱回溯"
 */

export type SandboxSource =
  | 'approval'
  | 'report'
  | 'qa'
  | 'sandbox_page'
  | 'demo'
  // 新增：业务联动场景
  | 'meeting_report'
  | 'meeting_export'
  | 'chat_ai'
  | 'industry_news_review';

export interface BusinessRef {
  /** 业务类型 */
  type: 'report' | 'meeting' | 'approval' | 'news' | 'chat';
  /** 业务单据 ID */
  id: string;
  /** 业务标题（便于审计时一眼看懂） */
  title?: string;
}

export interface SandboxLogEntry {
  id: string;
  timestamp: number;
  /** 调用人 */
  user: string;
  /** 输入文本长度 */
  inputLength: number;
  /** 输入文本前 80 字符 + 哈希 */
  inputPreview: string;
  /** 输入文本 SHA-256 哈希（脱敏存储） */
  inputHash: string;
  /** 评分 */
  score: number;
  /** 是否通过 */
  passed: boolean;
  /** 是否阻断 */
  blocked: boolean;
  /** 命中问题数 */
  issueCount: number;
  /** 总命中片段数 */
  totalHits: number;
  /** 耗时 ms */
  durationMs: number;
  /** 调用来源（页面） */
  source: string;
  /** 业务单据引用（可选；用于联动追溯） */
  businessRef?: BusinessRef;
}

class SandboxLogStore {
  private logs: SandboxLogEntry[] = [];
  private subscribers = new Set<() => void>();
  private readonly MAX = 200;

  list(): SandboxLogEntry[] {
    return [...this.logs].reverse(); // 最新在前
  }

  /** 按业务单据查询历史检测记录 */
  listByBusiness(type: BusinessRef['type'], id: string): SandboxLogEntry[] {
    return [...this.logs]
      .filter((l) => l.businessRef?.type === type && l.businessRef?.id === id)
      .reverse();
  }

  record(
    entry: Omit<SandboxLogEntry, 'id' | 'timestamp'> & { businessRef?: BusinessRef }
  ): SandboxLogEntry {
    const fullEntry: SandboxLogEntry = {
      ...entry,
      id: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.logs.push(fullEntry);
    if (this.logs.length > this.MAX) {
      this.logs = this.logs.slice(-this.MAX);
    }
    this.notify();
    return fullEntry;
  }

  clear(): void {
    this.logs = [];
    this.notify();
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    this.subscribers.forEach((fn) => fn());
  }
}

export const sandboxLogStore = new SandboxLogStore();

// ============================================================
// 工具：生成 SHA-256 哈希（前端用 SubtleCrypto）
// ============================================================

export async function hashInput(text: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    // 浏览器不支持 SubtleCrypto 时降级
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 16);
  }
}

// ============================================================
// 工具：生成输入预览（前 80 字 + ...）
// ============================================================

export function previewInput(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
}
