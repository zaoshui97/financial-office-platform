/**
 * 通讯录 / 聊天 store
 *
 * ️ 模块定位（系统边界约束）：
 *   - 通讯录：员工档案库，用于会议邀请、审批指派、@通知
 *   - 一对一聊天：系统**内部辅助沟通**工具，不作为核心业务流程
 *   - 因此不做完整 IM 强交互（语音 / 已读回执 / 表情包等），仅保留发送文本消息能力
 *
 * - employees: 所有员工档案（启动时若空就注入 MOCK_EMPLOYEES）
 * - messagesByUser: 按 "当前用户 user.id" 索引，再按 "对端 peer.id" 索引的聊天记录
 * - unread: 每个 peer 的未读计数
 *
 * 注意：会话 key 是 user.id（来自 userStore），不是员工 id。
 *      因为登录后 userStore 中 user.id 形如 "user-zhangsan"，是稳定标识。
 *
 * actions 引用稳定性：
 *   所有 actions 来自 contactsActions 模块（稳定引用），不在 create 回调内重新包装。
 *   这样 zustand selector 订阅 action 引用时不会触发无限重渲染。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ContactEmployee } from '@/types/contacts';
import { attachStore, contactsActions } from './contactsActions';

type MessageMap = Record<string, Record<string, ChatMessage[]>>;
type UnreadMap = Record<string, Record<string, number>>;

interface ContactsState {
  employees: ContactEmployee[];
  messagesByUser: MessageMap;
  unread: UnreadMap;

  /** 注入 mock 数据（首次加载） */
  bootstrap: () => void;

  /** 工具：通过 username 解析为 employee */
  findByUsername: (username: string) => ContactEmployee | undefined;

  /** 获取某会话的消息列表 */
  getMessages: (userId: string, peerId: string) => ChatMessage[];

  /** 发送消息 */
  sendMessage: (userId: string, peerId: string, content: string) => ChatMessage | null;

  /** 标记某会话已读 */
  markRead: (userId: string, peerId: string) => void;

  /** 获取某会话的未读数 */
  getUnread: (userId: string, peerId: string) => number;
}

export const useContactsStore = create<ContactsState>()(
  persist(
    () => ({
      employees: [] as ContactEmployee[],
      messagesByUser: {} as MessageMap,
      unread: {} as UnreadMap,
      // actions 直接复用稳定的外部引用，不会被 set 重建
      bootstrap: contactsActions.bootstrap,
      findByUsername: contactsActions.findByUsername,
      getMessages: contactsActions.getMessages,
      sendMessage: contactsActions.sendMessage,
      markRead: contactsActions.markRead,
      getUnread: contactsActions.getUnread,
    }),
    {
      name: 'contacts-storage',
    }
  )
);

// 创建后注入 store 引用给 actions（打破循环依赖）
attachStore(useContactsStore);
