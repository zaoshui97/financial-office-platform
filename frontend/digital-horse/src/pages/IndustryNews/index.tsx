import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Typography,
  Tag,
  Button,
  Switch,
  Input,
  Select,
  App,
  Empty,
  Divider,
  Badge,
  Tooltip,
  List,
  Tabs,
  Drawer,
  Descriptions,
  Avatar,
  Timeline,
} from 'antd';
import type { TabsProps } from 'antd';
import {
  RadarChartOutlined,
  BellOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  StarOutlined,
  StarFilled,
  ReloadOutlined,
  SettingOutlined,
  EyeOutlined,
  FireOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  PlusOutlined,
  DeleteOutlined,
  MailOutlined,
  MessageOutlined,
  FilterOutlined,
  LinkOutlined,
  ShareAltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '@/store/todoStore';
import { useNotificationStore } from '@/store/notificationStore';
import { eventBus } from '@/services/eventBus';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  publishTime: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  hot: boolean;
  starred: boolean;
  read: boolean;
}

interface Subscription {
  id: string;
  name: string;
  keywords: string[];
  channels: string[];
  frequency: 'realtime' | 'daily' | 'weekly';
  enabled: boolean;
  lastSent?: string;
}

const IndustryNews: React.FC = () => {
  const { t } = useTranslation();
  const { message: msg } = App.useApp();
  const [activeTab, setActiveTab] = useState<'news' | 'subscriptions'>('news');
  const navigate = useNavigate();

  // 业务联动：资讯一键发起合规审查
  const todoAdd = useTodoStore((s) => s.add);
  const addNotification = useNotificationStore((s) => s.addNotification);

  /** 一键发起合规审查：高/中影响度的资讯直接生成待办 + 风险通知 */
  const handleLaunchComplianceReview = (item: NewsItem) => {
    if (item.impact === 'low') {
      msg.info('该资讯影响度较低，无需发起合规审查');
      return;
    }
    // 1. 生成系统待办
    todoAdd({
      description: `审查监管资讯「${item.title}」并出具合规应对方案（来源：${item.source}）`,
      assignee: 'user-001',
      assigneeName: '当前用户',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'todo',
    });
    // 1.1 仿真联动：触发事件总线（Dashboard 风险卡片 +1）
    eventBus.emit('news.risk.flagged', {
      id: item.id,
      title: item.title,
      severity: item.impact === 'high' ? 'high' : 'medium',
    });
    // 2. 风险告警（risk 类型）
    addNotification({
      type: 'risk',
      title: '监管风险事件已识别',
      content: `${item.title}（${item.source}）影响度：${item.impact === 'high' ? '高' : '中'}。已自动生成合规审查待办，请在截止日期前完成。`,
      action: [
        { label: '查看待办', key: 'view_todo' },
        { label: '前往沙箱', key: 'sandbox' },
      ],
    });
    // 3. 外部推送：监管情报风险预警（钉钉/企微/邮件）
    (async () => {
      const { dispatchRiskAlert } = await import('@/services/notificationDispatchService');
      const { usePushChannelConfigStore } = await import('@/store/pushChannelConfigStore');
      const result = await dispatchRiskAlert({
        title: `监管风险预警：${item.title}`,
        content: `${item.summary}（来源：${item.source}，影响度：${item.impact === 'high' ? '高' : '中'}）。已生成合规审查待办。`,
        newsId: item.id,
        link: '/industry-news',
      });
      if (result.success || Object.values(result.channelResults).some((r) => r?.ok)) {
        usePushChannelConfigStore.getState().recordSent('risk_alert');
      }
    })();
    msg.success('已发起合规审查，待办 + 风险通知已生成');
  };

  // 新闻数据
  const [newsList, setNewsList] = useState<NewsItem[]>(MOCK_NEWS);

  // 详情 Drawer 状态
  const [detailItem, setDetailItem] = useState<NewsItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /** 打开资讯详情 */
  const handleOpenDetail = (item: NewsItem) => {
    setDetailItem(item);
    setDetailOpen(true);
    // 顺手标记已读（实时反映到顶部"今日已读"统计）
    setNewsList((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
  };

  /** 详情中复制原文 */
  const handleCopyContent = async () => {
    if (!detailItem) return;
    try {
      await navigator.clipboard.writeText(detailItem.content);
      msg.success('已复制资讯全文到剪贴板');
    } catch {
      msg.warning('复制失败，请手动选择');
    }
  };

  // 订阅数据
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);

  // 未读数统计
  const unreadCount = newsList.filter((i) => !i.read).length;

  // 获取影响度颜色
  const getImpactColor = (impact: NewsItem['impact']) => {
    return { high: '#D64045', medium: '#fa8c16', low: '#22A775' }[impact];
  };

  // 获取影响度标签
  const getImpactLabel = (impact: NewsItem['impact']) => {
    return { high: '高影响', medium: '中影响', low: '低影响' }[impact];
  };

  // 获取分类图标
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      政策: <SafetyCertificateOutlined style={{ color: '#D64045' }} />,
      市场: <RiseOutlined style={{ color: '#22A775' }} />,
      行业: <FireOutlined style={{ color: '#fa8c16' }} />,
      监管: <SafetyCertificateOutlined style={{ color: '#722ED1' }} />,
      AI: <RobotOutlined style={{ color: '#1890ff' }} />,
    };
    return icons[category] || <RadarChartOutlined style={{ color: '#1890ff' }} />;
  };

  // 获取分类颜色
  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      '政策': 'red',
      '市场': 'green',
      '行业': 'orange',
      '监管': 'blue',
      'AI': 'blue',
    };
    return colorMap[category] || 'default';
  };

  // 获取订阅频率标签
  const getFrequencyLabel = (freq: Subscription['frequency']) => {
    return { realtime: '实时', daily: '每日摘要', weekly: '每周摘要' }[freq];
  };

  // 切换订阅状态
  const handleToggleSubscription = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // 删除订阅
  const handleDeleteSubscription = (id: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    msg.success('订阅已删除');
  };

  // 收藏/取消收藏
  const handleStar = (id: string) => {
    setNewsList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, starred: !item.starred } : item
      )
    );
  };

  // 标记已读
  const handleMarkRead = (id: string) => {
    setNewsList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  // Tab 配置
  const tabItems: TabsProps['items'] = [
    {
      key: 'news',
      label: (
        <span>
          <FireOutlined style={{ marginRight: 6 }} />
          资讯浏览
          {unreadCount > 0 && (
            <Badge
              count={unreadCount}
              style={{ marginLeft: 6, backgroundColor: '#D64045' }}
              size="small"
            />
          )}
        </span>
      ),
    },
    {
      key: 'subscriptions',
      label: (
        <span>
          <SettingOutlined style={{ marginRight: 6 }} />
          订阅管理
        </span>
      ),
    },
  ];

  // 热门新闻
  const hotNews = newsList.filter((n) => n.hot).slice(0, 3);
  // 普通新闻
  const regularNews = newsList.filter((n) => !n.hot);

  return (
    <div style={{ padding: 24 }}>
      {/* 顶部统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Space>
              <Badge count={unreadCount} style={{ backgroundColor: '#D64045' }}>
                <BellOutlined style={{ fontSize: 20, color: '#D64045' }} />
              </Badge>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>待阅资讯</Text>
                <div>
                  <Text strong style={{ fontSize: 20 }}>{unreadCount}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}> 条</Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Space>
              <SettingOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>活跃订阅</Text>
                <div>
                  <Text strong style={{ fontSize: 20 }}>
                    {subscriptions.filter((s) => s.enabled).length}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}> 个</Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Space>
              <CheckCircleOutlined style={{ fontSize: 20, color: '#22A775' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>今日已读</Text>
                <div>
                  <Text strong style={{ fontSize: 20 }}>
                    {newsList.filter((i) => i.read).length}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}> 条</Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 主面板 */}
      <Card
        title={
          <Space>
            <RadarChartOutlined style={{ color: '#0F2B5B' }} />
            <span>行业资讯</span>
            <Tag color="blue">智能订阅</Tag>
          </Space>
        }
        tabList={tabItems}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as 'news' | 'subscriptions')}
      >
        {/* 资讯浏览 */}
        {activeTab === 'news' && (
          <div>
            {/* 摘要时间范围 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: 6,
              }}
            >
              <Space>
                <ClockCircleOutlined style={{ color: '#1890ff' }} />
                <Text type="secondary">
                  更新时间：{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} 09:00
                </Text>
              </Space>
              <Button icon={<ReloadOutlined />} size="small" onClick={() => msg.success('资讯已刷新')}>
                刷新
              </Button>
            </div>

            {/* AI 摘要卡片 */}
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: '#f0f7ff',
                borderColor: '#1890ff',
              }}
            >
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Space>
                  <RobotOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ color: '#1890ff' }}>AI 摘要</Text>
                  <Tag color="blue" style={{ fontSize: 11 }}>今日要点</Tag>
                </Space>
                <Paragraph style={{ margin: 0, color: '#374151', fontSize: 13, lineHeight: 1.8 }}>
                  今日金融资讯涉及 <Text strong>监管政策</Text> 层面最多，其中"基金销售管理办法修订"对行业影响较大，关系到各基金公司的合规整改期限，建议重点关注。
                  <Text type="secondary">此外，市场方面，公募基金规模再创新高，AI 技术在金融领域的应用持续深化，智能投顾赛道迎来新一轮发展机遇。</Text>
                </Paragraph>
              </Space>
            </Card>

            {/* 热门头条 */}
            {hotNews.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ marginBottom: 12, display: 'block' }}>
                  <FireOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
                  热门头条
                </Text>
                <Row gutter={[12, 12]}>
                  {hotNews.map((item) => (
                    <Col xs={24} md={8} key={item.id}>
                      <Card
                        hoverable
                        size="small"
                        style={{
                          borderLeft: `3px solid ${getImpactColor(item.impact)}`,
                        }}
                        onClick={() => handleOpenDetail(item)}
                      >
                        <Space style={{ marginBottom: 8 }}>
                          <Tag color="red">热门</Tag>
                          <Tag color={getCategoryColor(item.category)}>{item.category}</Tag>
                        </Space>
                        <Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                          {item.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.summary}
                        </Text>
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.source} · {item.publishTime}
                          </Text>
                          <Space size={4}>
                            {item.impact !== 'low' && (
                              <Tooltip title="一键发起合规审查（生成待办 + 风险通知）">
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<SafetyCertificateOutlined />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLaunchComplianceReview(item);
                                  }}
                                  style={{ fontSize: 12 }}
                                >
                                  发起审查
                                </Button>
                              </Tooltip>
                            )}
                            <Tooltip title={item.starred ? '取消收藏' : '收藏'}>
                              <Button
                                type="text"
                                size="small"
                                icon={item.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                                onClick={(e) => { e.stopPropagation(); handleStar(item.id); }}
                              />
                            </Tooltip>
                            <Tooltip title="标记已读">
                              <Button
                                type="text"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={(e) => { e.stopPropagation(); handleMarkRead(item.id); }}
                                disabled={item.read}
                              />
                            </Tooltip>
                          </Space>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* 最新资讯列表 */}
            <div>
              <Text strong style={{ marginBottom: 12, display: 'block' }}>
                <FilterOutlined style={{ marginRight: 6 }} />
                最新资讯
              </Text>
              {regularNews.length === 0 ? (
                <Empty description="暂无相关资讯" />
              ) : (
                regularNews.map((item) => (
                  <Card
                    key={item.id}
                    hoverable
                    size="small"
                    style={{
                      marginBottom: 12,
                      borderLeft: `4px solid ${getImpactColor(item.impact)}`,
                      background: item.read ? '#fafafa' : '#fff',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleOpenDetail(item)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        {/* 标题行 */}
                        <Space style={{ marginBottom: 6 }}>
                          {getCategoryIcon(item.category)}
                          <Text strong style={{ fontSize: 14 }}>{item.title}</Text>
                          <Tag
                            color={item.impact === 'high' ? 'error' : item.impact === 'medium' ? 'warning' : 'success'}
                            style={{ fontSize: 10 }}
                          >
                            {getImpactLabel(item.impact)}
                          </Tag>
                          {!item.read && (
                            <Tag color="blue" style={{ fontSize: 10 }}>新</Tag>
                          )}
                        </Space>

                        {/* 摘要 */}
                        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                          {item.summary}
                        </Text>

                        {/* 来源和时间 */}
                        <Space size="large">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.source} · {item.publishTime}
                          </Text>
                        </Space>
                      </div>

                      {/* 操作 */}
                      <Space>
                        <Tooltip title={item.starred ? '取消收藏' : '收藏'}>
                          <Button
                            type="text"
                            size="small"
                            icon={item.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                            onClick={() => handleStar(item.id)}
                          />
                        </Tooltip>
                        <Tooltip title="标记已读">
                          <Button
                            type="text"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleMarkRead(item.id)}
                            disabled={item.read}
                          />
                        </Tooltip>
                        <Tooltip title="查看详情">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleOpenDetail(item)}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* 订阅管理 */}
        {activeTab === 'subscriptions' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text type="secondary">
                配置您关注的资讯类型和关键词，AI 将自动追踪并在重要内容更新时通知您。
              </Text>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => msg.info('新建订阅功能开发中')}>
                新建订阅
              </Button>
            </div>

            <Row gutter={[16, 16]}>
              {subscriptions.map((sub) => (
                <Col xs={24} md={12} key={sub.id}>
                  <Card
                    size="small"
                    style={{
                      borderColor: sub.enabled ? '#1890ff' : '#e5e7eb',
                      opacity: sub.enabled ? 1 : 0.7,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <Space style={{ marginBottom: 8 }}>
                          <Text strong>{sub.name}</Text>
                          <Tag color="default" style={{ fontSize: 11 }}>
                            {getFrequencyLabel(sub.frequency)}
                          </Tag>
                        </Space>

                        {/* 关键词 */}
                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>关键词：</Text>
                          <Space wrap style={{ marginTop: 4 }}>
                            {sub.keywords.map((kw) => (
                              <Tag key={kw} color="blue" style={{ fontSize: 11 }}>{kw}</Tag>
                            ))}
                          </Space>
                        </div>

                        {/* 通知渠道 */}
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>通知渠道：</Text>
                          <Space size={4} style={{ marginTop: 4 }}>
                            {sub.channels.includes('mail') && (
                              <Tooltip title="邮件通知">
                                <Tag icon={<MailOutlined />} style={{ fontSize: 11 }}>
                                  邮件
                                </Tag>
                              </Tooltip>
                            )}
                            {sub.channels.includes('sms') && (
                              <Tooltip title="短信通知">
                                <Tag style={{ fontSize: 11 }}>短信</Tag>
                              </Tooltip>
                            )}
                            {sub.channels.includes('inapp') && (
                              <Tooltip title="站内通知">
                                <Tag color="blue" style={{ fontSize: 11 }}>
                                  <MessageOutlined /> 站内
                                </Tag>
                              </Tooltip>
                            )}
                          </Space>
                        </div>

                        {sub.lastSent && (
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              <ClockCircleOutlined /> 上次推送：{sub.lastSent}
                            </Text>
                          </div>
                        )}
                      </div>

                      <Space orientation="vertical">
                        <Switch
                          checked={sub.enabled}
                          onChange={() => handleToggleSubscription(sub.id)}
                          size="small"
                        />
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteSubscription(sub.id)}
                        />
                      </Space>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            <Divider />

            {/* 通知时间偏好 */}
            <Card size="small" title="通知时间偏好">
              <Space wrap>
                <Text type="secondary" style={{ fontSize: 13 }}>每日推送时间：</Text>
                <Select
                  defaultValue="09:00"
                  style={{ width: 120 }}
                  size="small"
                  options={[
                    { label: '08:00', value: '08:00' },
                    { label: '09:00', value: '09:00' },
                    { label: '10:00', value: '10:00' },
                    { label: '18:00', value: '18:00' },
                  ]}
                />
                <Text type="secondary" style={{ fontSize: 13, marginLeft: 16 }}>周末推送：</Text>
                <Switch defaultChecked size="small" />
                <Text type="secondary" style={{ fontSize: 11 }}>（周末不推送）</Text>
              </Space>
            </Card>
          </div>
        )}
      </Card>

      {/* 资讯详情 Drawer */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        styles={{ wrapper: { width: 720, maxWidth: 'calc(100vw - 32px)' } }}
        title={
          detailItem ? (
            <Space size="small" wrap>
              <Tag color={getCategoryColor(detailItem.category)}>{detailItem.category}</Tag>
              <Tag
                color={
                  detailItem.impact === 'high'
                    ? 'error'
                    : detailItem.impact === 'medium'
                    ? 'warning'
                    : 'success'
                }
              >
                {getImpactLabel(detailItem.impact)}
              </Tag>
              {detailItem.hot && <Tag color="red">热门</Tag>}
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                {detailItem.source} · {detailItem.publishTime}
              </Text>
            </Space>
          ) : null
        }
        extra={
          detailItem ? (
            <Space>
              <Tooltip title={detailItem.starred ? '取消收藏' : '收藏'}>
                <Button
                  type="text"
                  icon={
                    detailItem.starred ? (
                      <StarFilled style={{ color: '#faad14' }} />
                    ) : (
                      <StarOutlined />
                    )
                  }
                  onClick={() => {
                    handleStar(detailItem.id);
                    setDetailItem((prev) =>
                      prev ? { ...prev, starred: !prev.starred } : prev
                    );
                  }}
                />
              </Tooltip>
              <Button icon={<ShareAltOutlined />} onClick={() => msg.info('已生成内部分享链接')}>
                分享
              </Button>
              {detailItem.impact !== 'low' && (
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => handleLaunchComplianceReview(detailItem)}
                >
                  发起合规审查
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {detailItem && (
          <div>
            {/* 标题 */}
            <Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
              {detailItem.title}
            </Title>

            {/* 元信息 */}
            <Space size="large" style={{ marginBottom: 16, color: '#666' }}>
              <span>
                <ClockCircleOutlined /> {detailItem.publishTime}
              </span>
              <span>
                <FireOutlined /> 阅读 {Math.floor(Math.random() * 4000) + 1200}
              </span>
              <span>
                <LinkOutlined /> 来源：{detailItem.source}
              </span>
            </Space>

            <Divider style={{ margin: '12px 0' }} />

            {/* 摘要 */}
            <Card size="small" style={{ background: '#f0f7ff', borderColor: '#91caff', marginBottom: 16 }}>
              <Space>
                <RobotOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ color: '#1890ff' }}>
                  AI 摘要
                </Text>
              </Space>
              <Paragraph style={{ marginTop: 8, marginBottom: 0, color: '#374151' }}>
                {detailItem.summary}
              </Paragraph>
            </Card>

            {/* 关键信息 */}
            <Descriptions
              size="small"
              column={2}
              bordered
              style={{ marginBottom: 16 }}
              title="关键信息"
            >
              <Descriptions.Item label="分类">{detailItem.category}</Descriptions.Item>
              <Descriptions.Item label="影响度">
                <Tag
                  color={
                    detailItem.impact === 'high'
                      ? 'error'
                      : detailItem.impact === 'medium'
                      ? 'warning'
                      : 'success'
                  }
                >
                  {getImpactLabel(detailItem.impact)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">{detailItem.source}</Descriptions.Item>
              <Descriptions.Item label="发布时间">{detailItem.publishTime}</Descriptions.Item>
            </Descriptions>

            {/* 正文（按段落渲染） */}
            <Title level={5}>
              <FileTextOutlined /> 资讯全文
            </Title>
            {detailItem.content
              .split(/\n\n+/)
              .filter((p) => p.trim())
              .map((para, idx) => (
                <Paragraph
                  key={idx}
                  style={{ fontSize: 14, lineHeight: 1.9, color: '#262626' }}
                >
                  {para.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < para.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </Paragraph>
              ))}

            <Divider style={{ margin: '20px 0 12px' }} />

            {/* 操作时间线 */}
            <Title level={5}>
              <SafetyCertificateOutlined /> 处理记录
            </Title>
            <Timeline
              style={{ marginTop: 8 }}
              items={[
                {
                  color: 'green',
                  children: `系统采集：${detailItem.publishTime} · 来源 ${detailItem.source}`,
                },
                {
                  color: 'blue',
                  children: 'AI 摘要生成完成，已自动归类到【行业资讯】',
                },
                {
                  color: detailItem.read ? 'gray' : 'orange',
                  children: detailItem.read
                    ? `已于 ${new Date().toLocaleString('zh-CN')} 阅读`
                    : '尚未阅读',
                },
                ...(detailItem.starred
                  ? [{ color: 'gold' as const, children: '已加入我的收藏' }]
                  : []),
              ]}
            />

            {/* 底部操作 */}
            <div
              style={{
                position: 'sticky',
                bottom: 0,
                background: '#fff',
                paddingTop: 12,
                marginTop: 16,
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space>
                <Avatar size="small" style={{ backgroundColor: '#0F2B5B' }}>
                  AI
                </Avatar>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  本文由 AI 中台·资讯引擎 自动采编
                </Text>
              </Space>
              <Space>
                <Button icon={<ShareAltOutlined />} onClick={handleCopyContent}>
                  复制全文
                </Button>
                <Button onClick={() => setDetailOpen(false)}>关闭</Button>
                {detailItem.impact !== 'low' && (
                  <Button
                    type="primary"
                    icon={<SafetyCertificateOutlined />}
                    onClick={() => handleLaunchComplianceReview(detailItem)}
                  >
                    发起合规审查
                  </Button>
                )}
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

// Mock 订阅数据
const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: '1',
    name: '金融监管政策',
    keywords: ['证监会', '银保监会', '基金销售', '合规', '监管新规'],
    channels: ['inapp', 'mail'],
    frequency: 'realtime',
    enabled: true,
    lastSent: '2026-09-09 08:00',
  },
  {
    id: '2',
    name: '公募基金动态',
    keywords: ['公募基金', 'ETF', '基金规模', '基金发行'],
    channels: ['inapp'],
    frequency: 'daily',
    enabled: true,
    lastSent: '2026-09-09 09:00',
  },
  {
    id: '3',
    name: 'AI + 金融科技',
    keywords: ['智能投顾', 'AI金融', '大模型', '金融科技'],
    channels: ['inapp', 'mail'],
    frequency: 'daily',
    enabled: true,
    lastSent: '2026-09-09 09:00',
  },
  {
    id: '4',
    name: '竞品动态',
    keywords: ['蚂蚁财富', '天天基金', '理财通', '基金代销'],
    channels: ['mail'],
    frequency: 'weekly',
    enabled: false,
    lastSent: '2026-09-06 10:00',
  },
  {
    id: '5',
    name: '宏观经济',
    keywords: ['GDP', 'CPI', '货币政策', '利率', '外汇'],
    channels: ['inapp'],
    frequency: 'daily',
    enabled: true,
    lastSent: '2026-09-09 08:30',
  },
];

// Mock 资讯数据
const MOCK_NEWS: NewsItem[] = [
  {
    id: 'n1',
    title: '证监会发布《基金销售管理办法》修订征求意见稿',
    summary:
      '新版办法强化了基金销售机构的信息披露义务，要求代销机构完善客户风险评估体系，并对基金组合销售提出更严格要求。此举对行业代销格局将产生深远影响。',
    content: '一、修订背景与总体思路\n\n近年来公募基金销售规模快速扩张，截至 2026 年三季度末，全市场公募基金资产管理规模已达 28.6 万亿元。但在销售环节，仍存在客户风险评估不充分、组合销售合规边界模糊、销售机构信息披露不充分等问题。证监会于近日发布《基金销售管理办法》修订征求意见稿，进一步完善基金销售行为监管框架。\n\n二、主要修订内容\n\n1. 强化代销机构适当性管理。要求销售机构建立完整的客户风险评估动态调整机制，至少每两年更新一次客户风险等级。\n2. 完善基金组合销售合规边界。明确"基金组合销售"应以投资者利益优先为前提，禁止通过"组合打包"方式规避单个基金的适当性匹配要求。\n3. 强化信息披露要求。代销机构应在产品销售前 5 个工作日，通过官网及销售平台完整披露基金产品风险等级、费率结构、近 1 年业绩比较基准。\n4. 提高违规处罚力度。对未按规定进行客户风险评估、销售超出风险等级匹配的基金产品的代销机构，最高可暂停基金销售业务 6 个月。\n\n三、对行业的影响\n\n业内分析师普遍认为，本次修订对头部第三方代销机构影响相对有限，但对中小代销机构将带来显著的合规整改压力。预计行业整体代销手续费率短期内将下降 5-10 个基点。建议各代销机构尽快组织合规、法务部门对照修订条款进行差距分析。\n\n四、合规应对建议\n\n1. 立即启动全产品线客户适当性匹配复查，重点关注近 6 个月新增客户。\n2. 升级销售系统风险揭示页面，确保与新版格式要求一致。\n3. 内部组织一线销售人员开展不少于 2 课时的合规培训。\n4. 法务部牵头梳理本机构涉及的合规风险点，形成应对方案并报备证监会地方监管局。',
    source: '证监会官网',
    publishTime: '2026-09-09 10:30',
    category: '政策',
    impact: 'high',
    hot: true,
    read: false,
    starred: true,
  },
  {
    id: 'n2',
    title: '公募基金规模突破 28.6 万亿，再创历史新高',
    summary:
      '截至 2026 年三季度末，全市场公募基金资产管理规模达到 28.6 万亿元，较上季度增长 5.3%。其中权益类基金规模占比回升，指数基金延续快速增长。',
    content: '一、整体规模情况\n\n中国基金业协会发布数据显示，截至 2026 年 9 月 8 日，全市场公募基金资产管理规模合计 28.6 万亿元，较 2026 年二季度末增长 1.44 万亿元，环比增幅 5.3%，创历史新高。这是公募基金规模连续 9 个季度实现正增长。\n\n二、结构变化亮点\n\n1. 权益类基金（含股票型、混合型）规模合计 8.7 万亿元，占比 30.4%，较上季度提升 1.2 个百分点。\n2. 指数型基金（含被动指数、增强指数、ETF）规模达 3.6 万亿元，环比增长 11.2%，新发产品数量同比增加 38%。\n3. 货币基金规模 8.1 万亿元，占比 28.3%，较上季度小幅下降 0.6 个百分点。\n4. 债券型基金规模 7.9 万亿元，占比 27.6%，整体保持稳定。\n\n三、市场驱动因素\n\n分析师指出，本季度规模快速扩张主要受三方面因素驱动：A股市场情绪回暖带动权益类基金净申购；银行理财净值化转型持续推进，部分低风险偏好资金向货币 + 短债基金迁移；被动投资理念持续普及，指数基金受到机构与零售客户共同青睐。\n\n四、对销售渠道的影响\n\n头部代销平台（蚂蚁财富、天天基金、理财通）合计代销规模占全市场约 65%。建议渠道侧重点优化 ETF 与指数基金的运营资源投放，并加强投资者教育，避免出现"指数过热"风险。',
    source: '中国基金业协会',
    publishTime: '2026-09-09 09:15',
    category: '市场',
    impact: 'high',
    hot: true,
    read: false,
    starred: false,
  },
  {
    id: 'n3',
    title: '多家基金公司获批开展 AI 智能投顾业务试点',
    summary:
      '继易方达、华夏之后，又有 5 家基金公司获批开展智能投顾业务试点。监管部门鼓励基金公司与科技公司合作，探索 AI 在基金投资顾问领域的应用。',
    content: '一、试点扩容情况\n\n证监会于近日批准第二批共 5 家基金公司开展 AI 智能投顾业务试点，加上首批的易方达基金、华夏基金，目前全市场已有 7 家机构获得智能投顾试点资格。监管部门同时发布配套业务指引，对客户适当性、模型可解释性、信息披露等关键环节提出明确要求。\n\n二、监管关注重点\n\n1. 模型可解释性：智能投顾算法应能清晰展示推荐逻辑，包括风险等级匹配、组合再平衡触发条件等。\n2. 客户适当性：投资者单户风险承受能力评估结果须与智能投顾组合风险等级严格匹配。\n3. 应急预案：算法出现异常或市场极端波动时，应能立即切换至人工接管。\n4. 信息披露：每季度向客户出具 AI 投资顾问运作报告，包括组合表现、关键决策归因。\n\n三、行业应用场景\n\n业内已落地的应用场景包括：基于客户画像的资产配置建议、基于宏观信号的组合再平衡、基于舆情分析的行业轮动、基于自然语言交互的智能问答等。其中"客户画像 + 风险匹配"环节 AI 提效最为显著。\n\n四、本公司机会分析\n\n1. 评估与监管沙箱合作，争取试点资格。\n2. 现有智能投研助手产品（如本平台的"AI 中台"）可作为差异化竞争点。\n3. 提前布局合规体系，重点完善模型可解释性与信息披露模块。',
    source: '证券时报',
    publishTime: '2026-09-08 16:20',
    category: '行业',
    impact: 'medium',
    hot: true,
    read: false,
    starred: false,
  },
  {
    id: 'n4',
    title: '央行宣布降准 0.25 个百分点，释放长期资金约 5000 亿',
    summary:
      '央行宣布于 2026 年 9 月 15 日下调金融机构存款准备金率 0.25 个百分点，预计释放长期资金约 5000 亿元。业内分析此举旨在维护流动性合理充裕，支持实体经济发展。',
    content: '一、政策要点\n\n中国人民银行决定于 2026 年 9 月 15 日起，下调金融机构存款准备金率 0.25 个百分点（不含已执行 5% 存款准备金率的金融机构）。本次下调后，金融机构加权平均存款准备金率约为 6.8%，预计释放长期资金约 5000 亿元。\n\n二、政策意图\n\n央行有关部门负责人答记者问时表示，本次降准主要有三方面考虑：\n1. 保持银行体系流动性合理充裕，支持地方政府专项债发行。\n2. 提升金融机构信贷投放能力，更好满足实体经济融资需求。\n3. 引导市场利率下行，降低实体经济综合融资成本。\n\n三、市场反应\n\n消息发布后，10 年期国债收益率小幅下行 3 个基点，A 股银行板块开盘后整体上涨 0.6%。市场普遍预计本次降准将带动 LPR 在 9 月 20 日小幅下调 5 个基点。\n\n四、对资管业务的影响\n\n1. 短端利率有望进一步下行，货币基金与现金管理类理财收益率或小幅承压。\n2. 中长端债券配置价值上升，建议择机配置中长期利率债。\n3. 信贷投放规模扩张，银行、地产、基建等板块或迎来阶段性机会。',
    source: '中国人民银行',
    publishTime: '2026-09-08 11:00',
    category: '政策',
    impact: 'medium',
    hot: false,
    read: false,
    starred: false,
  },
  {
    id: 'n5',
    title: '天天基金推出"AI 研报助手"，一键生成投资分析报告',
    summary:
      '天天基金宣布上线 AI 研报助手功能，用户输入投资标的后可自动生成包含基本面分析、技术面分析和风险提示的投资分析报告，大幅提升投研效率。',
    content: '一、产品概述\n\n天天基金于 2026 年 9 月 7 日宣布上线"AI 研报助手"功能。用户输入投资标的名称或代码，系统可在 30 秒内自动生成包含公司基本面、技术面、估值水平、风险提示的完整投资分析报告。\n\n二、核心能力\n\n1. 基本面自动抓取：实时对接交易所公告、年报、研报数据，生成近三年营收、净利润、ROE 等关键指标走势。\n2. 技术面智能解读：基于近 5 年日线、均线、成交量数据，自动识别趋势阶段、关键支撑/压力位。\n3. 估值横向对比：自动与同行业可比公司进行 PE、PB、PS 估值比较。\n4. 风险智能提示：基于公告、舆情、监管动态生成风险标签。\n\n三、用户定位\n\n产品主要面向两类用户：\n- 个人投资者：辅助快速了解投资标的，降低研究门槛。\n- 机构客户：作为研究底稿生成工具，节省基础数据整理时间。\n\n四、竞争启示\n\n建议我方产品重点补齐两个能力：\n1. 行业横向对比与产业链分析。\n2. 多模态输入（语音、图片、PDF 研报）。\n3. 报告二次编辑与团队协作能力。',
    source: '天天基金官网',
    publishTime: '2026-09-07 14:30',
    category: 'AI',
    impact: 'low',
    hot: false,
    read: true,
    starred: false,
  },
  {
    id: 'n6',
    title: '金融监管科技应用白皮书正式发布',
    summary:
      '中国互联网金融协会发布《金融科技监管应用白皮书》，系统总结了 RegTech 在合规、风控、监管报告等领域的应用实践与未来趋势。',
    content: '一、白皮书概况\n\n中国互联网金融协会于 2026 年 9 月 6 日正式发布《金融科技监管应用白皮书》，全文共 6 章、120 页，覆盖监管科技（RegTech）在反洗钱、客户身份识别、监管数据报送、合规自动化检查等 7 大领域的应用现状与典型案例。\n\n二、核心观点\n\n1. 监管科技已从"单点工具"演进为"全链路合规操作系统"。\n2. 大模型在监管文本解读、合规问答、报告生成中表现突出，平均可替代 60-70% 的人工合规工作量。\n3. 监管侧和机构侧数据共享机制仍需进一步打通。\n4. AI 模型可解释性是 RegTech 落地的前提条件。\n\n三、典型应用案例\n\n1. 工商银行：基于大模型的反洗钱可疑交易识别模型，可疑交易识别准确率提升 32%。\n2. 招商银行：客户风险评级自动化引擎，单户评估时长由 4 分钟缩短至 12 秒。\n3. 中国平安：监管政策追踪系统，覆盖 11 个监管机构、23 个细分领域，政策更新到内部培训平均 1.2 天。\n\n四、对本平台的启示\n\n本平台 AI 中台能力与白皮书指引方向高度吻合，可重点拓展：\n1. 监管政策智能解读与一键生成应对方案。\n2. 合规风险点自检 + 整改跟踪。\n3. 监管报送数据自动化生成。',
    source: '中国互联网金融协会',
    publishTime: '2026-09-06 09:00',
    category: '监管',
    impact: 'medium',
    hot: false,
    read: false,
    starred: false,
  },
  {
    id: 'n7',
    title: '银行理财市场半年报：净值化转型进入深水区',
    summary:
      '上半年银行理财市场存续规模达 26.6 万亿元，其中净值型产品占比超过 85%，理财子公司数量已增至 30 家，行业竞争格局持续分化。',
    content: '一、市场规模\n\n银行业理财登记托管中心数据显示，截至 2026 年 6 月末，全市场银行理财产品存续规模 26.6 万亿元，较上年末增长 4.2%。净值型产品占比 85.6%，较上年末提升 6.3 个百分点。\n\n二、行业格局\n\n1. 理财子公司增至 30 家（含 2 家外资控股），存续规模占全部理财产品的 78%。\n2. 国有大行理财子规模占比 41%，股份制银行理财子占比 27%，城商行理财子占比 23%，外资控股理财子占比 9%。\n3. 行业前 10 家理财子规模合计占比 71%，头部效应进一步显现。\n\n三、产品创新方向\n\n1. 混合估值产品：通过"摊余成本 + 市值法"组合，平滑净值波动。\n2. 养老主题理财：试点扩围至 10 个城市，存续规模突破 1200 亿元。\n3. ESG 主题理财：存续规模约 2400 亿元，同比增长 58%。\n4. 跨境理财通：粤港澳大湾区参与客户突破 12 万户。\n\n四、对基金代销的启示\n\n1. 银行理财净值化转型后，部分低风险偏好客户回流公募基金趋势明显，重点关注中短债基金与"固收+"产品。\n2. 养老、ESG 等主题型理财产品为公募基金带来差异化竞争压力，应加强相应主题产品供给。\n3. 渠道侧可探索"理财 + 基金"组合配置工具，提升客户 AUM。',
    source: '银行业理财登记托管中心',
    publishTime: '2026-09-05 15:30',
    category: '市场',
    impact: 'medium',
    hot: false,
    read: false,
    starred: false,
  },
];

export default IndustryNews;
