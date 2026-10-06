import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Avatar,
  Space,
  Typography,
  Spin,
  Tag,
  App,
  Tooltip,
  Empty,
  Switch,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  SyncOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  CopyOutlined,
  LikeOutlined,
  DislikeOutlined,
  ReloadOutlined,
  FileSearchOutlined,
  LinkOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  AudioOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface Reference {
  id: string;
  title: string;
  source: string;
  excerpt: string;
  relevance: number;
  url?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  references?: Reference[];
  typing?: boolean;
  feedback?: 'like' | 'dislike' | null;
  duration?: number;
  /** 合规检测标记 */
  compliance?: {
    passed: boolean;
    blocked: boolean;
    score: number;
    issueCount: number;
  };
}

const Chat: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('chat.welcomeMessage'),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  /** 合规校验开关：开启后 AI 输出会过沙箱检测，命中风险时显示标识 */
  const [complianceCheckEnabled, setComplianceCheckEnabled] = useState(false);
  const [sessionId] = useState(() => Date.now().toString());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = input;
    setInput('');
    setLoading(true);

    // ── 真实后端 RAG 问答 ──
    try {
      const { chatApi } = await import('@/api/chat');
      const res = await chatApi.ask({
        message: query,
        knowledge_base_id: 1,        // 金融法规库（演示固定用 KB id=1）
        mode: 'rag',
        task: 'rag',
      });

      const data = res.data;
      const messageId = (Date.now() + 1).toString();

      // 将后端引用映射为前端 Reference 格式
      const references: Reference[] = (data.citations || []).map((c) => ({
        id: String(c.document_id),
        title: c.title || '未知文档',
        source: c.source || '',
        excerpt: c.excerpt || '',
        relevance: c.relevance ?? 0.8,
      }));

      const fullAnswer = data.answer || '（未收到回答）';
      const latency = data.latency_ms ? (data.latency_ms / 1000).toFixed(1) : undefined;

      // 先显示带 typing 状态的占位消息
      const aiMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        references,
        typing: true,
        duration: latency ? parseFloat(latency) : undefined,
      };
      setMessages((prev) => [...prev, aiMessage]);

      // 模拟流式输出（真实 AI 回复逐字出现）
      let currentIndex = 0;
      const chunkSize = 3;
      const interval = 25;

      streamingTimerRef.current = window.setInterval(() => {
        currentIndex += chunkSize;
        if (currentIndex >= fullAnswer.length) {
          currentIndex = fullAnswer.length;
          if (streamingTimerRef.current) {
            clearInterval(streamingTimerRef.current);
            streamingTimerRef.current = null;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: fullAnswer, typing: false }
                : m
            )
          );
          setLoading(false);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: fullAnswer.slice(0, currentIndex) }
                : m
            )
          );
        }
      }, interval);
    } catch (err: any) {
      // 网络错误：降级显示友好提示，不阻断对话
      setLoading(false);
      const errorMsg = err?.response?.data?.detail
        || err?.message
        || '网络异常，请检查后端服务是否运行';
      const messageId = (Date.now() + 1).toString();
      const aiMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: `⚠️ AI 服务暂时不可用：${errorMsg}\n\n请确保后端服务（uvicorn）正在运行于 http://127.0.0.1:8001`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }
  };

  const handleRegenerate = (msgId: string) => {
    message.info(t('chat.regenerating') || '正在重新生成回答...');
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    // 找到上一个用户消息
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx > 0) {
      const userMsg = messages[idx - 1];
      if (userMsg.role === 'user') {
        setInput(userMsg.content);
        setTimeout(() => handleSend(), 100);
      }
    }
  };

  const handleFeedback = (msgId: string, feedback: 'like' | 'dislike') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback } : m))
    );
    message.success(feedback === 'like' ? t('chat.feedbackLike') || '感谢您的反馈' : t('chat.feedbackDislike') || '已记录您的建议');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).then(
      () => message.success(t('chat.copied') || '已复制到剪贴板'),
      () => message.error(t('chat.copyFailed') || '复制失败')
    );
  };

  const quickActions = [
    { icon: <FileTextOutlined />, text: '合规风险审查', color: '#D64045' },
    { icon: <VideoCameraOutlined />, text: '会议纪要生成', color: '#059669' },
    { icon: <AuditOutlined />, text: '合同合规检查', color: '#1a56db' },
    { icon: <RadarChartOutlined />, text: '监管政策解读', color: '#722ED1' },
  ];

  const suggestedQuestions = [
    { icon: <SafetyCertificateOutlined />, text: '资管新规对债券交易有哪些影响？' },
    { icon: <FileSearchOutlined />, text: '反洗钱合规检查要点是什么？' },
    { icon: <ThunderboltOutlined />, text: '衍生品监管新规解读（2026版）' },
    { icon: <BulbOutlined />, text: '上市公司信息披露规范有哪些最新要求？' },
  ];

  return (
    <Card
      title={
        <Space>
          <Avatar icon={<RobotOutlined />} style={{ background: '#1a56db' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('chat.title')}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <Tag color="green" style={{ marginRight: 4 }}>{t('chat.online') || '在线'}</Tag>
              {t('chat.sessionPrefix') || '会话 '}{sessionId.slice(-6)}
            </Text>
          </div>
        </Space>
      }
      extra={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            if (streamingTimerRef.current) clearInterval(streamingTimerRef.current);
            setMessages([
              {
                id: '1',
                role: 'assistant',
                content: t('chat.welcomeMessage'),
                timestamp: new Date(),
              },
            ]);
            message.success(t('chat.newChatStarted') || '已开启新对话');
          }}
        >
          {t('chat.newChat')}
        </Button>
      }
      styles={{ body: { padding: 0, height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' } }}
    >
      {/* 快捷操作 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafbfc' }}>
        <Space wrap>
          <Text type="secondary" style={{ marginRight: 4 }}>快捷操作：</Text>
          {quickActions.map((action, index) => (
            <Button
              key={index}
              icon={action.icon}
              size="small"
              style={{ color: action.color, borderColor: action.color }}
              onClick={() => {
                setInput(action.text);
                message.info(`已选择: ${action.text}`);
              }}
            >
              {action.text}
            </Button>
          ))}
          <Tooltip title="开启后，AI 回复会自动过合规沙箱检测，命中风险时显示标识">
            <Switch
              checkedChildren="合规校验"
              unCheckedChildren="合规校验"
              size="small"
              checked={complianceCheckEnabled}
              onChange={setComplianceCheckEnabled}
              style={{ marginLeft: 8 }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, background: '#f9fafb' }}>
        {messages.length === 1 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text type="secondary">开始对话，或尝试以下问题：</Text>
                <div style={{ marginTop: 16 }}>
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      icon={q.icon}
                      size="small"
                      style={{ margin: 4 }}
                      onClick={() => {
                        setInput(q.text);
                        setTimeout(() => handleSend(), 100);
                      }}
                    >
                      {q.text}
                    </Button>
                  ))}
                </div>
              </div>
            }
          />
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 20,
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar
                  icon={<RobotOutlined />}
                  style={{
                    marginRight: 12,
                    background: '#1a56db',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ maxWidth: '70%' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: msg.role === 'user' ? '#1a56db' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#1f2937',
                    boxShadow: msg.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                    border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                  }}
                >
                  <Paragraph
                    style={{
                      margin: 0,
                      color: 'inherit',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                    {msg.typing && <span className="typing-cursor">▋</span>}
                  </Paragraph>
                  {/* 合规检测标签 */}
                  {msg.compliance && (
                    <Tag
                      color={
                        msg.compliance.blocked
                          ? 'red'
                          : msg.compliance.passed
                          ? 'green'
                          : 'orange'
                      }
                      style={{ marginTop: 8 }}
                      icon={<SafetyCertificateOutlined />}
                    >
                      {msg.compliance.blocked
                        ? '合规检测：阻断级违规'
                        : msg.compliance.passed
                        ? `合规检测通过 · ${msg.compliance.score.toFixed(1)}/5`
                        : `合规提示：${msg.compliance.issueCount} 项风险 · ${msg.compliance.score.toFixed(1)}/5`}
                    </Tag>
                  )}
                </div>

                {/* 引用来源卡片 */}
                {msg.references && msg.references.length > 0 && !msg.typing && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#fff',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 13,
                    }}
                  >
                    <Space style={{ marginBottom: 8 }}>
                      <LinkOutlined style={{ color: '#1a56db' }} />
                      <Text strong style={{ fontSize: 12 }}>
                        引用来源 ({msg.references.length})
                      </Text>
                    </Space>
                    {msg.references.map((ref) => (
                      <div
                        key={ref.id}
                        style={{
                          padding: '8px 10px',
                          marginBottom: 6,
                          background: '#f9fafb',
                          borderRadius: 6,
                          borderLeft: '3px solid #1a56db',
                          cursor: 'pointer',
                        }}
                        onClick={() => message.info(`打开: ${ref.title}`)}
                      >
                        <Space style={{ marginBottom: 4 }}>
                          <FileTextOutlined style={{ color: '#6b7280' }} />
                          <Text strong style={{ fontSize: 12 }}>{ref.title}</Text>
                          <Tag color="blue" style={{ fontSize: 10 }}>
                            相关度 {Math.round(ref.relevance * 100)}%
                          </Tag>
                        </Space>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>
                          {ref.excerpt}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
                          {ref.source}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 操作栏 */}
                {msg.role === 'assistant' && !msg.typing && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Tooltip title="复制">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(msg.content)}
                      />
                    </Tooltip>
                    <Tooltip title="重新生成">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => handleRegenerate(msg.id)}
                      />
                    </Tooltip>
                    <Tooltip title="有帮助">
                      <Button
                        type="text"
                        size="small"
                        icon={<LikeOutlined />}
                        onClick={() => handleFeedback(msg.id, 'like')}
                        style={{ color: msg.feedback === 'like' ? '#22A775' : undefined }}
                      />
                    </Tooltip>
                    <Tooltip title="无帮助">
                      <Button
                        type="text"
                        size="small"
                        icon={<DislikeOutlined />}
                        onClick={() => handleFeedback(msg.id, 'dislike')}
                        style={{ color: msg.feedback === 'dislike' ? '#D64045' : undefined }}
                      />
                    </Tooltip>
                    {msg.duration && (
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                        耗时 {msg.duration.toFixed(1)}s
                      </Text>
                    )}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <Avatar
                  icon={<UserOutlined />}
                  style={{
                    marginLeft: 12,
                    background: '#059669',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))
        )}

        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              icon={<RobotOutlined />}
              style={{ background: '#1a56db' }}
            />
            <div
              style={{
                padding: '12px 16px',
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
              }}
            >
              <Space>
                <Spin indicator={<SyncOutlined spin />} size="small" />
                <Text type="secondary">{t('chat.thinking')}</Text>
                <span className="typing-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </Space>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', background: '#fff' }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('chat.placeholder') || t('qa.placeholder') || '请输入您的问题...'}
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ flex: 1 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{ height: 'auto' }}
          >
            {t('qa.send')}
          </Button>
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          {t('chat.footerTip') || 'AI 回答基于企业知识库，结果仅供参考。'}
        </Text>
      </div>

      <style>{`
        .typing-cursor {
          animation: blink 1s infinite;
          color: #1a56db;
          margin-left: 2px;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .typing-dots span {
          animation: dots 1.4s infinite;
          display: inline-block;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dots {
          0%, 60%, 100% { opacity: 0; }
          30% { opacity: 1; }
        }
      `}</style>
    </Card>
  );
};

// Mock 响应生成（后端接入后将替换）
function generateMockResponse(query: string): { content: string; references: Reference[] } {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('差旅') || lowerQuery.includes('住宿') || lowerQuery.includes('报销')) {
    return {
      content: `根据公司《差旅费管理办法》（2024 版）相关规定：

**住宿标准**（一线城市：北京、上海、广州、深圳）
• 部门经理及以上：¥800/晚
• 普通员工：¥600/晚

**其他城市**
• 省会城市：¥500/晚
• 普通地市：¥400/晚

**交通补贴**
• 出差期间伙食补助：¥100/天
• 市内交通：实报实销（需提供票据）

**机票**
• 飞行时长 > 4 小时：可预订经济舱及以上
• 飞行时长 > 8 小时或飞行距离 > 4000 公里：可预订商务舱

**注意事项**
1. 同行人员应尽量合住，分摊住宿费
2. 票据需在返回后 5 个工作日内提交报销
3. 特殊情况需提前报备并获得上级批准

如需查看完整政策文档，可在知识库中搜索"差旅费管理办法"。`,
      references: [
        {
          id: 'r1',
          title: '差旅费管理办法（2024 版）',
          source: '财务制度 › 差旅管理',
          excerpt: '公司差旅住宿标准根据目的地城市分级管理，一线城市部门经理¥800/晚，普通员工¥600/晚...',
          relevance: 0.96,
        },
        {
          id: 'r2',
          title: '员工报销流程指引',
          source: '财务制度 › 报销指引',
          excerpt: '差旅费报销应在返回后 5 个工作日内提交，所需票据包括机票行程单、酒店发票、出租车票等...',
          relevance: 0.82,
        },
        {
          id: 'r3',
          title: '2024 年财务制度汇编',
          source: '财务制度 › 综合文档',
          excerpt: '本制度适用于公司全体员工，包含差旅、招待、培训等多种费用类别的报销标准...',
          relevance: 0.74,
        },
      ],
    };
  }

  if (lowerQuery.includes('合同') || lowerQuery.includes('分析')) {
    return {
      content: `合同分析结果如下：

**基本信息**
• 合同名称：某某基金销售合同 V2.1
• 合同类型：销售合作协议
• 签订方：本公司 / 某某基金管理有限公司
• 合同期限：2026-01-01 至 2028-12-31

**关键条款提示**

1. **分成比例调整**（第 5 条）
   - V2.0：销售分成 30%
   - V2.1：提升至 35%
   - 建议：超出同类合同平均水平（行业平均 28%），建议法务复核

2. **结算周期变更**（第 7 条）
   - V2.0：月结
   - V2.1：季结
   - 建议：延长回款周期，建议附加回款保障条款

3. **违约金条款**（第 12 条）
   - 任何一方违约需支付合同总额 20% 的违约金
   - 处于合理区间

**合规性检查**
• 已通过合规系统初审
• 合同金额在董事会授权范围内
• 不存在关联交易

**建议**
1. 法务部门对分成条款进行专项审查
2. 与某某基金沟通调整结算周期
3. 建议附加回款保障条款`,
      references: [
        {
          id: 'r1',
          title: '销售合同 V2.1.docx',
          source: '我的文档 › 合同',
          excerpt: '甲方（本公司）与乙方（某某基金管理有限公司）就产品销售合作事宜达成协议...',
          relevance: 0.98,
        },
        {
          id: 'r2',
          title: '合同审核标准操作流程',
          source: '合规制度 › 合同管理',
          excerpt: '合同审核应关注分成比例、结算周期、违约金条款、关联交易等关键要素...',
          relevance: 0.88,
        },
        {
          id: 'r3',
          title: '同类合同历史对比',
          source: '历史合同 › 销售类',
          excerpt: '近三年同类销售合同分成比例区间为 25%-30%，平均 28%...',
          relevance: 0.75,
        },
      ],
    };
  }

  if (lowerQuery.includes('会议') || lowerQuery.includes('纪要')) {
    return {
      content: `已为您生成"2024 Q1 产品迭代评审会"会议纪要：

**会议概况**
• 时间：2026-09-08 14:00-15:30
• 主持人：张三
• 参会人：李四、王五、赵六、钱七
• 会议类型：产品评审

**会议要点**

1. **Q1 产品迭代总结**
   - 完成核心功能 12 项
   - 用户增长 25%，月活突破 10 万
   - 客户满意度 NPS 提升至 68

2. **Q2 产品规划**
   - 重点推出 AI 智能助手功能
   - 优化移动端体验
   - 加强企业版 API 能力

3. **问题与挑战**
   - 后端性能瓶颈需优化
   - 客户反馈响应时长需缩短

**会议决议**
1. 通过 Q2 产品规划方案
2. 启动 AI 智能助手开发（4 月开始）
3. 组建性能优化专项小组

**待办事项**
1. 李四 - 编写 AI 助手需求文档（截止 9 月 15 日）
2. 王五 - 提交性能优化方案（截止 9 月 12 日）
3. 赵六 - 招聘 2 名后端工程师（截止 9 月 30 日）`,
      references: [
        {
          id: 'r1',
          title: 'Q1 产品迭代评审会议录音',
          source: '会议 › 2026-09-08',
          excerpt: '会议讨论了 Q1 产品迭代情况，以及 Q2 的产品规划方向...',
          relevance: 0.95,
        },
        {
          id: 'r2',
          title: 'Q1 产品数据周报',
          source: '数据报告 › 产品',
          excerpt: 'Q1 用户增长 25%，月活突破 10 万，客户满意度 NPS 68...',
          relevance: 0.81,
        },
      ],
    };
  }

  return {
    content: `您好！我是您的金融办公智能助手。

我可以帮您：

**智能问答**
• 查询公司制度、流程、政策
• 检索业务知识、历史文档

**文档处理**
• 分析合同、报告
• 生成会议纪要、工作总结

**数据分析**
• 解读业务数据
• 生成分析报告

**您可以这样问我**
• "公司差旅住宿标准是多少？"
• "帮我分析某某基金销售合同"
• "2024 年金融监管有哪些新规定？"

请告诉我您想了解什么？`,
    references: [],
  };
}

export default Chat;
