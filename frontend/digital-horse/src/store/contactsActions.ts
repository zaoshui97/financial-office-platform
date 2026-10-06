/**
 * Contacts store 的 actions 集合
 *
 * 模块定位：通讯录 + 一对一聊天是系统内部辅助工具。
 *   - 不作为核心业务流程，不做完整 IM 产品交互强化
 *   - 用途：员工查找 → 发起内部简单沟通 / @提及 / 邀请入会
 *   - 真实企业内部沟通仍走钉钉 / 企微，本系统通过"外部推送"配置对接
 *
 * 为什么 actions 要独立成文件？
 *   1. 引用稳定性：actions 在模块加载时创建一次，永远冻结，引用不变
 *   2. 避免 zustand selector 订阅函数引用导致的无限重渲染
 *
 * 注意：这里没有直接 import contactsStore，避免循环依赖。
 * store 在创建后调用 attachStore() 注入自身引用，actions 再访问它。
 */

import type { ChatMessage, ContactEmployee } from '@/types/contacts';
import { MOCK_EMPLOYEES } from '@/mock/employees';
import { generateId } from '@/utils/format';

// store 抽象：actions 只需要 getState / setState 两个能力
interface StoreLike {
  getState: () => {
    employees: ContactEmployee[];
    messagesByUser: Record<string, Record<string, ChatMessage[]>>;
    unread: Record<string, Record<string, number>>;
  };
  setState: (
    partial:
      | Partial<{
          employees: ContactEmployee[];
          messagesByUser: Record<string, Record<string, ChatMessage[]>>;
          unread: Record<string, Record<string, number>>;
        }>
      | ((state: {
          employees: ContactEmployee[];
          messagesByUser: Record<string, Record<string, ChatMessage[]>>;
          unread: Record<string, Record<string, number>>;
        }) => Partial<{
          employees: ContactEmployee[];
          messagesByUser: Record<string, Record<string, ChatMessage[]>>;
          unread: Record<string, Record<string, number>>;
        }>)
  ) => void;
}

let storeRef: StoreLike | null = null;

/** 由 contactsStore 在创建后调用，注入自身引用 */
export const attachStore = (store: StoreLike): void => {
  storeRef = store;
};

/** 获取当前注入的 store；未注入时抛错（保护编程错误） */
const getStore = (): StoreLike => {
  if (!storeRef) {
    throw new Error('[contactsActions] store not attached yet. Call attachStore() first.');
  }
  return storeRef;
};

// 全局"已 bootstrap"标记，避免多个组件（AppLayout、MeetingRoom、Contacts）
// 都调用 bootstrap() 时互相触发 store 更新导致 dev 死循环
let bootstrapped = false;

const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true';

export const contactsActions = {
  bootstrap: (): void => {
    if (bootstrapped) return;
    bootstrapped = true;
    if (USE_MOCK && getStore().getState().employees.length === 0) {
      getStore().setState({ employees: MOCK_EMPLOYEES });
    }
  },

  findByUsername: (username: string): ContactEmployee | undefined => {
    return getStore().getState().employees.find((e) => e.username === username);
  },

  getMessages: (userId: string, peerId: string): ChatMessage[] => {
    return getStore().getState().messagesByUser[userId]?.[peerId] ?? [];
  },

  sendMessage: (userId: string, peerId: string, content: string): ChatMessage | null => {
    const text = content.trim();
    if (!text) return null;
    const msg: ChatMessage = {
      id: generateId('msg'),
      fromId: userId,
      toId: peerId,
      content: text,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    getStore().setState((state) => {
      const userBucket = state.messagesByUser[userId] ?? {};
      const peerBucket = userBucket[peerId] ?? [];
      return {
        messagesByUser: {
          ...state.messagesByUser,
          [userId]: {
            ...userBucket,
            [peerId]: [...peerBucket, msg],
          },
        },
      };
    });
    return msg;
  },

  markRead: (userId: string, peerId: string): void => {
    getStore().setState((state) => {
      const userUnread = { ...(state.unread[userId] ?? {}) };
      if (userUnread[peerId]) {
        delete userUnread[peerId];
      }
      return {
        unread: { ...state.unread, [userId]: userUnread },
      };
    });
  },

  getUnread: (userId: string, peerId: string): number => {
    return getStore().getState().unread[userId]?.[peerId] ?? 0;
  },
};

// 冻结 actions 对象，防止意外修改引用
Object.freeze(contactsActions);
