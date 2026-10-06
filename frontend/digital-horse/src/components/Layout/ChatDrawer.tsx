import React, { useEffect, useRef, useState } from 'react';
import { Drawer, Input, Avatar, Typography, Empty, Space, Tag } from 'antd';
import { SendOutlined, UserOutlined } from '@ant-design/icons';
import type { ContactEmployee, ChatMessage } from '@/types/contacts';
import { useContactsStore, useUserStore } from '@/store';
import { ROLE_LABELS } from '@/types/permission';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// 常量空数组（保持引用稳定，避免 zustand selector 无限重渲染）
const EMPTY_MESSAGES: ChatMessage[] = [];

interface ChatDrawerProps {
  open: boolean;
  peer: ContactEmployee | null;
  onClose: () => void;
}

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatDrawer: React.FC<ChatDrawerProps> = ({ open, peer, onClose }) => {
  const { i18n, t } = useTranslation();
  const { user } = useUserStore();

  // 订阅当前会话消息：使用常量空数组保持引用稳定，避免无限重渲染
  const messages = useContactsStore((s) =>
    user && peer ? (s.messagesByUser[user.id]?.[peer.id] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const sendMessage = useContactsStore((s) => s.sendMessage);
  const markRead = useContactsStore((s) => s.markRead);

  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // 打开时标记已读 + 滚动到底
  useEffect(() => {
    if (open && user && peer) {
      markRead(user.id, peer.id);
      // 等到 messages 更新完再滚
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [open, user, peer, messages.length, markRead]);

  // 新消息时滚动到底
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !user || !peer) return;
    sendMessage(user.id, peer.id, text);
    setInput('');
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      destroyOnClose={false}
      title={null}
      closable={false}
      mask={true}
      className="chat-drawer"
      styles={{ body: { padding: 0 }, wrapper: { width: 420, maxWidth: 'calc(100vw - 32px)' } }}
    >
      {peer && user ? (
        <>
          {/* 头部 */}
          <div className="chat-header">
            <Avatar
              size={44}
              style={{ backgroundColor: peer.avatar || '#1890ff', flexShrink: 0 }}
            >
              {peer.name.charAt(0)}
            </Avatar>
            <div className="chat-header-info">
              <Text className="chat-header-name">{peer.name}</Text>
              <Space size={4} className="chat-header-meta" wrap>
                <Tag style={{ margin: 0, fontSize: 11 }}>{peer.department}</Tag>
                <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                  {peer.position}
                </Tag>
                <Tag style={{ margin: 0, fontSize: 11 }}>
                  {ROLE_LABELS[peer.role]}
                </Tag>
              </Space>
            </div>
            <a
              onClick={onClose}
              style={{
                fontSize: 20,
                color: '#999',
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </a>
          </div>

          {/* 消息区 */}
          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: '#999' }}>
                      {`和 ${peer.name} 还没有消息，发送第一条吧`}
                    </span>
                  }
                />
              </div>
            ) : (
              messages.map((m: ChatMessage) => {
                const mine = m.fromId === user.id;
                return (
                  <div
                    key={m.id}
                    className={`chat-message-row ${mine ? 'mine' : 'theirs'}`}
                  >
                    {(!mine || true) && (
                      <Avatar
                        size={36}
                        className="chat-message-avatar"
                        style={{
                          backgroundColor: mine
                            ? '#0F2B5B'
                            : peer.avatar || '#1890ff',
                        }}
                        icon={mine ? <UserOutlined /> : undefined}
                      >
                        {!mine ? peer.name.charAt(0) : undefined}
                      </Avatar>
                    )}

                    {/* 气泡列：对方显示名字 + 气泡（气泡内右下角小字时间戳）；自己只显示气泡 */}
                    <div className="chat-message-col">
                      {!mine && (
                        <div className="chat-message-sender">{peer.name}</div>
                      )}
                      <div className="chat-message-bubble">
                        <span className="chat-message-content">{m.content}</span>
                        <span className="chat-message-time-inline">{formatTime(m.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 输入区 */}
          <div className="chat-input-area">
            <Input.Search
              placeholder={`发送给 ${peer.name}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onSearch={handleSend}
              enterButton={
                <>
                  <SendOutlined /> '发送'
                </>
              }
              size="large"
              disabled={!user}
            />
          </div>
        </>
      ) : (
        <Empty
          style={{ marginTop: 80 }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={'请选择一个联系人开始聊天'}
        />
      )}
    </Drawer>
  );
};

export default ChatDrawer;
