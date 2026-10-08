import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Avatar, Space, Typography, Spin, Empty, Dropdown, Modal, message, Tooltip, Tag, Badge, Upload } from 'antd';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PaperClipOutlined,
  InboxOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  CloseCircleFilled,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { formatDate } from '@/utils/format';
import { chatApi } from '@/api/chat';

const { TextArea } = Input;
const { Text } = Typography;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  references?: {
    id: string;
    title: string;
    source: string;
  }[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const QA: React.FC = () => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: t('qa.newConversation'),
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: t('qa.aiAssistantIntro'),
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const [currentConversationId, setCurrentConversationId] = useState('1');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  /** 动态获取当前用户知识库 ID（无 KB 时降级 LLM） */
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 启动时动态获取用户知识库列表
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('access_token');
        const resp = await fetch('/api/v1/rag/knowledge-bases', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.ok) {
          const kbs: { id: number }[] = await resp.json();
          if (kbs.length > 0) {
            setKnowledgeBaseId(kbs[0].id);
          }
        }
      } catch {
        // KB 获取失败 → 用 null
      }
    })();
  }, []);

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: t('qa.newConversation'),
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: t('qa.aiAssistantIntro'),
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    inputRef.current?.focus();
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(conversations[0]?.id || '');
    }
    message.success(t('qa.deleted'));
  };

  const startEditTitle = (id: string, title: string) => {
    setEditingConversationId(id);
    setEditingTitle(title);
  };

  const saveTitle = () => {
    if (editingConversationId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === editingConversationId ? { ...c, title: editingTitle, updatedAt: new Date() } : c
        )
      );
      setEditingConversationId(null);
      setEditingTitle('');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentConversation) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId
          ? {
              ...c,
              messages: [...c.messages, userMessage],
              updatedAt: new Date(),
              title: c.messages.length === 1 ? input.trim().slice(0, 20) + (input.trim().length > 20 ? '...' : '') : c.title,
            }
          : c
      )
    );

    const userInput = input;
    setInput('');
    setLoading(true);

    // ── 真实后端 RAG 问答（无知识库时降级 LLM）──
    try {
      const res = await chatApi.ask({
        message: userInput,
        ...(knowledgeBaseId != null
          ? { knowledge_base_id: knowledgeBaseId, mode: 'rag' as const, task: 'rag' }
          : {}),
      });
      const data = res.data;
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || t('qa.defaultResponse'),
        timestamp: new Date(),
        references: (data.citations || []).map((c: any) => ({
          id: String(c.document_id),
          title: c.filename || c.title || '未知文档',
          source: c.source || '',
        })),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? { ...c, messages: [...c.messages, aiMessage], updatedAt: new Date() }
            : c
        )
      );
    } catch (err: any) {
      // 网络错误：降级显示友好提示，不阻断对话
      const errorMsg = err?.response?.data?.detail || err?.message || '网络异常';
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ AI 服务暂时不可用：${errorMsg}\n\n请确保后端服务运行于 http://127.0.0.1:8030`,
        timestamp: new Date(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? { ...c, messages: [...c.messages, aiMessage], updatedAt: new Date() }
            : c
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const generateMockResponse = (input: string) => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return { content: t('qa.helloResponse'), references: [] };
    }

    if (lowerInput.includes('compliance') || lowerInput.includes('regulation')) {
      return {
        content: t('qa.complianceResponseTitle') + '\n\n' + t('qa.complianceFramework') + '\n\n' + t('qa.complianceRiskControl') + '\n\n' + t('qa.complianceMonitoring'),
        references: [
          { id: 'doc-001', title: '证券业 IT 管理办法', source: '合规' },
          { id: 'doc-002', title: '金融合规规范', source: '合规' },
        ],
      };
    }

    if (lowerInput.includes('meeting') || lowerInput.includes('summary')) {
      return {
        content: t('qa.meetingMinutesSteps') + '\n\n' + t('qa.meetingMinutesSetup') + '\n\n' + t('qa.meetingMinutesProcessing') + '\n\n' + t('qa.meetingMinutesOutput') + '\n\n```javascript\n' + t('qa.meetingMinutesApiJs') + '\n```\n\n' + t('qa.meetingMinutesResult'),
        references: [],
      };
    }

    return { content: t('qa.defaultResponse'), references: [] };
  };

  const getConversationMenu = (conv: Conversation) => ({
    items: [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: t('qa.rename'),
        onClick: () => startEditTitle(conv.id, conv.title),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: t('qa.deleteConfirmQ'),
        danger: true,
        onClick: () => deleteConversation(conv.id),
      },
    ],
  });

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 24,
        }}
      >
        <Space align="flex-start" style={{ maxWidth: '85%' }}>
          {isUser ? (
            <>
              <div style={{
                background: '#1a56db',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: '16px 16px 4px 16px',
                maxWidth: '100%',
              }}>
                <Text style={{ color: '#fff', whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
              </div>
              <Avatar icon={<UserOutlined />} style={{ background: '#059669', flexShrink: 0 }} />
            </>
          ) : (
            <>
              <Avatar icon={<RobotOutlined />} style={{ background: '#1a56db', flexShrink: 0 }} />
              <div style={{
                background: '#fff',
                border: '1px solid #e8e8e8',
                padding: '12px 16px',
                borderRadius: '16px 16px 16px 4px',
                maxWidth: '100%',
              }}>
                <ReactMarkdown
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      return !inline ? (
                        <code className={className} {...props}>{children}</code>
                      ) : (
                        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </>
          )}
        </Space>

        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, marginLeft: isUser ? 0 : 48, marginRight: isUser ? 48 : 0 }}>
          {formatDate(msg.timestamp, 'HH:mm')}
        </Text>

        {msg.references && msg.references.length > 0 && (
          <div style={{ marginTop: 8, marginLeft: isUser ? 0 : 48 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('qa.references')}:</Text>
            <div style={{ marginTop: 4 }}>
              {msg.references.map((ref) => (
                <Tooltip key={ref.id} title={`${t('qa.source')}: ${ref.source}`}>
                  <Tag icon={<FileTextOutlined />} color="blue" style={{ marginRight: 4 }}>
                    {ref.title.length > 20 ? ref.title.slice(0, 20) + '...' : ref.title}
                  </Tag>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLoading = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
      <Avatar icon={<RobotOutlined />} style={{ background: '#1a56db' }} />
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', padding: '12px 16px', borderRadius: 16 }}>
        <Space>
          <Spin size="small" />
          <Text type="secondary">{t('qa.thinkingShort')}</Text>
        </Space>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
      }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={createNewConversation}
          >
            {t('qa.newChatShort')}
          </Button>
        </Space>
        <Space>
          <Badge count={conversations.length - 1} overflowCount={99}>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setShowHistory(!showHistory)}
            >
              {t('qa.history')}
            </Button>
          </Badge>
        </Space>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showHistory && (
          <div style={{
            width: 280,
            background: '#fff',
            borderRight: '1px solid #e8e8e8',
            overflow: 'auto',
          }}>
            <div style={{ padding: 16 }}>
              <Text strong>{t('qa.historySession')}</Text>
            </div>
            {conversations.length === 0 ? (
              <Empty description={t('qa.noHistory')} style={{ marginTop: 40 }} />
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: conv.id === currentConversationId ? '#f0f7ff' : 'transparent',
                    borderLeft: conv.id === currentConversationId ? '3px solid #1a56db' : '3px solid transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onClick={() => {
                    setCurrentConversationId(conv.id);
                    setShowHistory(false);
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text ellipsis style={{ display: 'block' }}>
                      {conv.title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(conv.updatedAt, 'MM/DD HH:mm')}
                    </Text>
                  </div>
                  <Dropdown menu={getConversationMenu(conv)} trigger={['click']}>
                    <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
                  </Dropdown>
                </div>
              ))
            )}
          </div>
        )}

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          overflow: 'hidden',
        }}>
          {messages.length === 1 && messages[0].role === 'assistant' && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}>
              <Avatar icon={<RobotOutlined />} style={{ background: '#1a56db', width: 64, height: 64, fontSize: 32 }} />
              <Text strong style={{ fontSize: 24, marginTop: 16 }}>{t('qa.aiAssistantTitle')}</Text>
              <Text type="secondary" style={{ marginTop: 8, maxWidth: 400 }}>
                {t('qa.aiAssistantDesc')}
              </Text>
            </div>
          )}

          {messages.length > 1 && (
            <div style={{
              flex: 1,
              overflow: 'auto',
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              border: '1px solid #e8e8e8',
              marginBottom: 16,
            }}>
              {messages.map(renderMessage)}
              {loading && renderLoading()}
              <div ref={messagesEndRef} />
            </div>
          )}

          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 16,
              border: dragOver ? '2px dashed #0F2B5B' : '1px solid #e8e8e8',
              transition: 'all 0.2s',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const files = Array.from(e.dataTransfer.files);
              if (files.length === 0) return;
              const newFiles: UploadFile[] = files.map((f, idx) => ({
                uid: `-${Date.now()}-${idx}`,
                name: f.name,
                status: 'done',
                size: f.size,
                type: f.type,
                originFileObj: f as RcFile,
              }));
              setFileList(prev => [...prev, ...newFiles]);
              message.success(t('qa.filesAdded', { count: files.length }));
            }}
          >
            {fileList.length > 0 && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: '#F7F9FC',
                  borderRadius: 6,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {fileList.map((file) => (
                  <Tag
                    key={file.uid}
                    closable
                    icon={<FileTextOutlined />}
                    onClose={() => setFileList(prev => prev.filter(f => f.uid !== file.uid))}
                    style={{ padding: '4px 8px' }}
                  >
                    {file.name}
                  </Tag>
                ))}
                <span style={{ fontSize: 12, color: '#666', alignSelf: 'center' }}>
                  {t('qa.selectedCount', { count: fileList.length })}
                </span>
              </div>
            )}

            <Space.Compact style={{ width: '100%' }}>
              <Tooltip title={t('qa.attachFile')}>
                <Button
                  icon={<PaperClipOutlined />}
                  onClick={() => setUploadModalOpen(true)}
                />
              </Tooltip>
              <TextArea
                ref={inputRef as any}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={dragOver ? t('qa.dropUploadHint') : t('qa.inputPlaceholder')}
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={!input.trim() || loading}
              />
            </Space.Compact>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              {t('qa.pressEnterToSend')}
              <span style={{ marginLeft: 12, color: '#3B82F6' }}>
                <PaperClipOutlined style={{ marginRight: 4 }} />
                {t('qa.attachContext')}
              </span>
            </Text>
          </div>
        </div>
      </div>

      <Modal
        title={t('qa.uploadModalTitle')}
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        onOk={() => {
          if (fileList.length === 0) {
            message.warning(t('qa.uploadSelectFiles'));
            return;
          }
          setUploadModalOpen(false);
          message.success(t('qa.filesAdded', { count: fileList.length }));
        }}
        okText={t('qa.uploadConfirm')}
        cancelText={t('common.cancel')}
        style={{ width: 600, maxWidth: 'calc(100vw - 32px)' }}
      >
        <Upload.Dragger
          multiple
          showUploadList={false}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg"
          beforeUpload={(file) => {
            const newFile: UploadFile = {
              uid: `-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              status: 'done',
              size: file.size,
              type: file.type,
              originFileObj: file,
            };
            setFileList(prev => [...prev, newFile]);
            message.success(t('qa.fileAdded', { name: file.name }));
            return false;
          }}
          style={{ borderRadius: 6 }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
            <InboxOutlined style={{ fontSize: 48, color: '#0F2B5B' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, color: '#1D2129', marginBottom: 4 }}>
            {t('qa.draggerText')}
          </p>
          <p className="ant-upload-hint" style={{ fontSize: 12, color: '#666' }}>
            {t('qa.draggerHint')}
          </p>
        </Upload.Dragger>

        {fileList.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 200, overflowY: 'auto' }}>
            <Text strong style={{ fontSize: 13, color: '#1D2129' }}>
              {t('qa.selectedCount', { count: fileList.length })}
            </Text>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fileList.map((file) => (
                <div
                  key={file.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: '#F7F9FC',
                    borderRadius: 6,
                  }}
                >
                  <Space>
                    <FileTextOutlined style={{ color: '#0F2B5B' }} />
                    <Text style={{ fontSize: 13 }}>{file.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({(file.size! / 1024).toFixed(1)} KB)
                    </Text>
                  </Space>
                  <CloseCircleFilled
                    style={{ color: '#bfbfbf', cursor: 'pointer' }}
                    onClick={() => setFileList(prev => prev.filter(f => f.uid !== file.uid))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QA;
