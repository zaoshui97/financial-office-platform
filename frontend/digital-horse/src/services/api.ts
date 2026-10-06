/**
 * 统一仿真 API 服务层
 *
 * 设计目的：
 *   - 集中所有"假后端"调用入口，方便后续切换为真实接口（每个方法只需替换实现）
 *   - 提供延迟、随机失败、可控错误码等仿真特征
 *   - 与 eventBus 协同：所有"状态变更"操作都会触发对应事件
 *
 * 用法（推荐）：
 *   import { api } from '@/services/api';
 *   const meetings = await api.meeting.list({ page: 1, pageSize: 20 });
 *
 * 用法（兼容）：原有页面直接调 service 文件（如 postMeetingService.dispatchMeetingActions）
 *   这些 service 会转发到本 api，最终所有"写操作"都走 api + eventBus
 *
 * 真实对接时：每个方法体里把 mockImpl 替换为 axios.post('/api/v1/...', req) 即可。
 */

import { eventBus } from './eventBus';

// ============================================================
// 仿真配置
// ============================================================

const SIM_LATENCY_MIN = 80;
const SIM_LATENCY_MAX = 280;
const SIM_FAIL_RATE = 0.03; // 3% 随机失败（生产中常见网络抖动）

function randLatency(): number {
  return SIM_LATENCY_MIN + Math.random() * (SIM_LATENCY_MAX - SIM_LATENCY_MIN);
}

class SimulatedError extends Error {
  constructor(message: string, public code: number = 500) {
    super(message);
    this.name = 'SimulatedError';
  }
}

async function simulate<T>(fn: () => T | Promise<T>, opts?: { skipFailRate?: boolean }): Promise<T> {
  await new Promise((r) => setTimeout(r, randLatency()));
  if (!opts?.skipFailRate && Math.random() < SIM_FAIL_RATE) {
    throw new SimulatedError('仿真：网络抖动导致请求失败，请重试');
  }
  return await fn();
}

// ============================================================
// 类型
// ============================================================

export interface ApiListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  category: 'policy' | 'project' | 'faq' | 'template' | 'report' | 'minutes';
  content?: string;
  size: number;
  fileType: string;
  status: 'indexed' | 'indexing' | 'failed';
  uploadedAt: string;
  updatedAt: string;
  uploader?: string;
}

export interface ApprovalDraftSummary {
  id: string;
  title: string;
  approvalType: 'contract' | 'document' | 'reimbursement' | 'procurement' | 'travel' | 'budget' | 'seal';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  fromMeetingId?: string;
}

export interface ReportSummary {
  id: string;
  title: string;
  type: 'weekly' | 'monthly' | 'project' | 'topic';
  status: 'drafting' | 'generating' | 'completed' | 'sent';
  createdAt: string;
  recipientCount?: number;
}

// ============================================================
// 内置 mock 数据
// ============================================================

const MOCK_KNOWLEDGE: KnowledgeItem[] = [
  { id: 'k001', title: '员工手册 2026 版', category: 'policy', size: 2_048_000, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-08-01', updatedAt: '2026-09-10', uploader: 'HR' },
  { id: 'k002', title: '金融监管沙箱使用规范', category: 'policy', size: 768_000, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-08-15', updatedAt: '2026-08-15', uploader: '法务部' },
  { id: 'k003', title: 'Q3 行业洞察报告', category: 'report', size: 4_096_000, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-09-01', updatedAt: '2026-09-05', uploader: '研究院' },
  { id: 'k004', title: '项目结项模板', category: 'template', size: 256_000, fileType: 'docx', status: 'indexed', uploadedAt: '2026-08-20', updatedAt: '2026-08-20', uploader: 'PMO' },
  { id: 'k005', title: '微服务架构设计 v3', category: 'project', size: 3_072_000, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-09-08', updatedAt: '2026-09-12', uploader: '架构组' },
  { id: 'k006', title: '合规 FAQ 100 问', category: 'faq', size: 512_000, fileType: 'md', status: 'indexed', uploadedAt: '2026-08-25', updatedAt: '2026-09-15', uploader: '合规部' },
  { id: 'k007', title: '9 月周会纪要 W1', category: 'minutes', size: 128_000, fileType: 'doc', status: 'indexed', uploadedAt: '2026-09-08', updatedAt: '2026-09-08', uploader: '行政' },
  { id: 'k008', title: 'OKR 撰写指南', category: 'template', size: 384_000, fileType: 'pptx', status: 'indexed', uploadedAt: '2026-08-30', updatedAt: '2026-08-30', uploader: 'HR' },
];

const MOCK_APPROVALS: ApprovalDraftSummary[] = [
  { id: 'a001', title: '采购审批：服务器扩容', approvalType: 'procurement', status: 'pending', createdAt: '2026-09-18T10:00:00Z' },
  { id: 'a002', title: '合同审批：XX 银行合作协议', approvalType: 'contract', status: 'pending', createdAt: '2026-09-17T15:00:00Z' },
  { id: 'a003', title: '差旅报销：上海出差', approvalType: 'travel', status: 'approved', createdAt: '2026-09-15T08:00:00Z' },
  { id: 'a004', title: '用印申请：战略合作备忘录', approvalType: 'seal', status: 'pending', createdAt: '2026-09-20T09:00:00Z' },
  { id: 'a005', title: '预算调整：Q4 营销预算', approvalType: 'budget', status: 'rejected', createdAt: '2026-09-12T11:00:00Z' },
];

const MOCK_REPORTS: ReportSummary[] = [
  { id: 'r001', title: 'Q3 业务复盘报告', type: 'quarterly', status: 'completed', createdAt: '2026-09-19', recipientCount: 28 },
  { id: 'r002', title: '9 月合规月报', type: 'monthly', status: 'completed', createdAt: '2026-09-18', recipientCount: 12 },
  { id: 'r003', title: '数字化转型专题', type: 'topic', status: 'generating', createdAt: '2026-09-20' },
  { id: 'r004', title: '周报 W38', type: 'weekly', status: 'sent', createdAt: '2026-09-15', recipientCount: 50 },
];

// ============================================================
// API 模块
// ============================================================

const knowledge = {
  async list(params: { page: number; pageSize: number; keyword?: string; category?: string }): Promise<ApiListResponse<KnowledgeItem>> {
    return simulate(() => {
      let filtered = MOCK_KNOWLEDGE;
      if (params.keyword) {
        const kw = params.keyword.toLowerCase();
        filtered = filtered.filter((k) => k.title.toLowerCase().includes(kw));
      }
      if (params.category) {
        filtered = filtered.filter((k) => k.category === params.category);
      }
      const start = (params.page - 1) * params.pageSize;
      return {
        list: filtered.slice(start, start + params.pageSize),
        total: filtered.length,
        page: params.page,
        pageSize: params.pageSize,
      };
    });
  },

  async upload(input: { title: string; category: KnowledgeItem['category']; fileType?: string; size?: number }): Promise<KnowledgeItem> {
    return simulate(async () => {
      const item: KnowledgeItem = {
        id: `k${Date.now().toString(36)}`,
        title: input.title,
        category: input.category,
        fileType: input.fileType || 'pdf',
        size: input.size || 1024,
        status: 'indexing',
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uploader: '当前用户',
      };
      MOCK_KNOWLEDGE.unshift(item);
      // 模拟索引完成
      setTimeout(() => {
        item.status = 'indexed';
        eventBus.emit('knowledge.uploaded', { id: item.id, title: item.title, category: item.category, size: item.size });
      }, 1500);
      eventBus.emit('knowledge.uploaded', { id: item.id, title: item.title, category: item.category, size: item.size });
      return item;
    });
  },

  async search(keyword: string): Promise<KnowledgeItem[]> {
    return simulate(() => {
      const kw = keyword.toLowerCase();
      const hits = MOCK_KNOWLEDGE.filter((k) => k.title.toLowerCase().includes(kw));
      eventBus.emit('knowledge.searched', { keyword, hits: hits.length });
      return hits;
    });
  },
};

const approval = {
  async list(): Promise<ApprovalDraftSummary[]> {
    return simulate(() => [...MOCK_APPROVALS]);
  },

  async submit(id: string, decision: 'approved' | 'rejected', note?: string): Promise<ApprovalDraftSummary> {
    return simulate(async () => {
      const target = MOCK_APPROVALS.find((a) => a.id === id);
      if (!target) throw new SimulatedError(`审批单 ${id} 不存在`, 404);
      target.status = decision;
      eventBus.emit('approval.changed', { id, status: decision, title: target.title });
      return target;
    });
  },

  async create(input: Omit<ApprovalDraftSummary, 'id' | 'status' | 'createdAt'>): Promise<ApprovalDraftSummary> {
    return simulate(() => {
      const created: ApprovalDraftSummary = {
        id: `a${Date.now().toString(36)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...input,
      };
      MOCK_APPROVALS.unshift(created);
      eventBus.emit('approval.draft.created', { id: created.id, title: created.title, fromWorkitemId: created.fromMeetingId });
      return created;
    });
  },
};

const report = {
  async list(): Promise<ReportSummary[]> {
    return simulate(() => [...MOCK_REPORTS]);
  },

  async generate(input: { title: string; type: ReportSummary['type'] }): Promise<ReportSummary> {
    return simulate(async () => {
      const created: ReportSummary = {
        id: `r${Date.now().toString(36)}`,
        title: input.title,
        type: input.type,
        status: 'generating',
        createdAt: new Date().toISOString(),
      };
      MOCK_REPORTS.unshift(created);
      eventBus.emit('report.generated', { id: created.id, title: created.title, format: 'pdf' });
      // 模拟生成完成
      setTimeout(() => {
        created.status = 'completed';
      }, 2000);
      return created;
    });
  },
};

// ============================================================
// 导出统一 api 对象
// ============================================================

export const api = {
  knowledge,
  approval,
  report,
};

export { SimulatedError };
export type { KnowledgeItem, ApprovalDraftSummary, ReportSummary };
