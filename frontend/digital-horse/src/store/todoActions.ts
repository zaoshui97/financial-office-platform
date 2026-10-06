/**
 * Todo store 的 actions 集合
 *
 * 与 contactsActions 同样的设计原则：
 *   1. 模块加载时创建一次并冻结，引用稳定
 *   2. 避免 zustand selector 订阅函数引用导致无限重渲染
 *   3. 通过 getState/setState 读写 store，规避循环依赖
 */

import type { ActionItem } from '@/types/api';
import { MOCK_TODOS } from '@/mock/todos';
import { useTodoStore } from './todoStore';

let bootstrapped = false;

const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true';

export const todoActions = {
  /** 首次加载注入 mock 数据（仅 mock 模式） */
  bootstrap: (): void => {
    if (bootstrapped) return;
    bootstrapped = true;
    const state = useTodoStore.getState();
    if (USE_MOCK && state.items.length === 0) {
      useTodoStore.setState({ items: MOCK_TODOS });
    }
  },

  /** 按当前用户名过滤（后续接真实接口可由后端按 session 过滤） */
  getByAssignee: (assignee: string): ActionItem[] => {
    return useTodoStore
      .getState()
      .items.filter((it) => it.assignee === assignee);
  },

  /** 更新单条待办状态（todo → in_progress → done） */
  updateStatus: (id: string, status: ActionItem['status']): void => {
    useTodoStore.setState((state) => ({
      items: state.items.map((it) => (it.id === id ? { ...it, status } : it)),
    }));
  },

  /** 快捷：把一条 todo 标记为 done */
  markDone: (id: string): void => {
    todoActions.updateStatus(id, 'done');
  },

  /** 新增一条待办 */
  add: (item: Omit<ActionItem, 'id'>): ActionItem => {
    const newItem: ActionItem = {
      ...item,
      id: `a-${Date.now().toString(36)}`,
    };
    useTodoStore.setState((state) => ({
      items: [newItem, ...state.items],
    }));
    return newItem;
  },

  /** 删除一条待办 */
  remove: (id: string): void => {
    useTodoStore.setState((state) => ({
      items: state.items.filter((it) => it.id !== id),
    }));
  },
};

Object.freeze(todoActions);
