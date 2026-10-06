/**
 * 待办任务 store
 *
 * - items: 当前用户的待办列表（mock 驱动；后续接真实 API 时换成接口拉取）
 * - bootstrap: 首次加载注入 mock 数据（只注入一次）
 * - updateStatus / markDone / add / remove: 本地 CRUD
 *
 * 注意：actions 来自 todoActions 模块（稳定引用），不在 create 回调内重新包装。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActionItem } from '@/types/api';
import { todoActions } from './todoActions';

interface TodoState {
  items: ActionItem[];

  /** 通知中心跳转时设置的高亮 ID（用于 Dashboard 高亮显示） */
  activeId?: string;

  bootstrap: () => void;
  getByAssignee: (assignee: string) => ActionItem[];
  updateStatus: (id: string, status: ActionItem['status']) => void;
  markDone: (id: string) => void;
  add: (item: Omit<ActionItem, 'id'>) => ActionItem;
  remove: (id: string) => void;
  /** 设置高亮 ID（通知中心跳转后使用） */
  setActiveId: (id: string | undefined) => void;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      items: [],
      // actions 直接复用稳定的外部引用，不会被 set 重建
      bootstrap: todoActions.bootstrap,
      getByAssignee: todoActions.getByAssignee,
      updateStatus: todoActions.updateStatus,
      markDone: todoActions.markDone,
      add: todoActions.add,
      remove: todoActions.remove,
      setActiveId: (id) => set({ activeId: id }),
    }),
    {
      name: 'todo-storage',
      // activeId 不需要持久化
      partialize: (state) => ({ items: state.items }) as Partial<TodoState>,
    }
  )
);
