/**
 * 越权访问审计 store
 *
 * 记录任何"权限码不通过 / 路由越权 / API 阻断"事件，用于：
 *   - 系统设置 → 安全审计页查看
 *   - 满足金融行业对"留痕可审计"的合规要求
 *
 * 真实对接后端：record() 内调用 axios.post('/api/audit/access-denied')
 */

import { create } from 'zustand';
import type { Role, Resource, Action } from '@/types/permission';

export interface AccessAuditEntry {
  id: string;
  /** 时间戳 ms */
  timestamp: number;
  /** 用户名 */
  user: string;
  /** 用户显示名 */
  userName?: string;
  /** 部门 */
  department?: string;
  /** 当前角色 */
  role: Role;
  /** 触发资源 */
  resource: Resource;
  /** 触发操作 */
  action: Action;
  /** 触发时的路径 */
  path: string;
  /** 阻断原因 */
  reason: 'permission_denied' | 'route_forbidden' | 'api_blocked' | 'data_scope_violation';
  /** 附加备注 */
  remark?: string;
}

interface AccessAuditState {
  entries: AccessAuditEntry[];
  record: (entry: Omit<AccessAuditEntry, 'id' | 'timestamp'>) => AccessAuditEntry;
  clear: () => void;
  /** 按用户筛选 */
  filterByUser: (username: string) => AccessAuditEntry[];
  /** 按时间区间筛选 */
  filterByRange: (fromMs: number, toMs: number) => AccessAuditEntry[];
}

export const useAccessAuditStore = create<AccessAuditState>()((set, get) => ({
  entries: [],

  record: (entry) => {
    const full: AccessAuditEntry = {
      ...entry,
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    set((state) => ({ entries: [full, ...state.entries].slice(0, 500) }));
    return full;
  },

  clear: () => set({ entries: [] }),

  filterByUser: (username) => get().entries.filter((e) => e.user === username),

  filterByRange: (fromMs, toMs) =>
    get().entries.filter((e) => e.timestamp >= fromMs && e.timestamp <= toMs),
}));
