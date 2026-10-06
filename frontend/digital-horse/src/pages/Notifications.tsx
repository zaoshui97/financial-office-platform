import React, { useState, useMemo } from 'react';
import {
  App,
  Card,
  Tag,
  Button,
  Space,
  Typography,
  Badge,
  Empty,
  Tabs,
  Divider,
  Tooltip,
  Checkbox,
  Statistic,
  Segmented,
} from 'antd';
import {
  BellOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  RobotOutlined,
  FileTextOutlined,
  CheckOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FireOutlined,
  ClockCircleOutlined,
  DingtalkOutlined,
  WechatWorkOutlined,
  MailOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/store';
import {
  dispatchNotification,
  type PushChannel,
  type NotificationEventType,
} from '@/services/notificationDispatchService';
import { useTodoStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import './Notifications.css';

const { Text, Title } = Typography;

const channelMeta: Record<PushChannel, { icon: React.ReactNode; label: string; color: string }> = {
  dingtalk: { icon: <DingtalkOutlined />, label: '钉钉', color: '#1677FF' },
  wecom: { icon: <WechatWorkOutlined />, label: '企微', color: '#07C160' },
  email: { icon: <MailOutlined />, label: '邮件', color: '#722ED1' },
};

// 推送状态徽章组件
const PushStatusBadge: React.FC<{
  pushResult: NonNullable<import('@/store/notificationStore').Notification['pushResult']>;
  notificationId: string;
}> = ({ pushResult, notificationId }) => {
  const { message } = App.useApp();
  const [retrying, setRetrying] = useState<Set<PushChannel>>(new Set());

  const handleRetry = async (channel: PushChannel) => {
    setRetrying((prev) => new Set(prev).add(channel));
    try {
      const result = await dispatchNotification({
        eventType: 'sandbox_critical' as NotificationEventType, // 用通用类型
        channels: [channel],
        recipients: [],
        payload: { title: '重试推送', content: '通知推送重试' },
      }, { force: true });

      // 更新通知的 pushResult
      const { notifications, ...rest } = useNotificationStore.getState();
      const updated = notifications.map((n) =>
        n.id === notificationId
          ? {
              ...n,
              pushResult: {
                ...n.pushResult!,
                channelResults: {
                  ...n.pushResult!.channelResults,
                  [channel]: result.channelResults[channel],
                },
              },
            }
          : n
      );
      useNotificationStore.setState({ notifications: updated, ...rest });

      if (result.channelResults[channel]?.ok) {
        message.success(`${channelMeta[channel].label} 重试成功`);
      } else {
        message.error(`${channelMeta[channel].label} 重试失败：${result.channelResults[channel]?.error}`);
      }
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(channel);
        return next;
      });
    }
  };

  const channels = Object.entries(pushResult.channelResults) as Array<
    [PushChannel, NonNullable<typeof pushResult.channelResults[keyof typeof pushResult.channelResults]>]
  >;

  return (
    <Space size={4} style={{ marginLeft: 4 }}>
      {channels.map(([ch, r]) => (
        <Tooltip
          key={ch}
          title={
            r.ok
              ? `${channelMeta[ch].label} 推送成功`
              : `${channelMeta[ch].label} 失败：${r.error || '未知错误'} — 点击重试`
          }
        >
          <Tag
            icon={channelMeta[ch].icon}
            color={r.ok ? 'success' : 'error'}
            style={{ cursor: r.ok ? 'default' : 'pointer', fontSize: 11 }}
            onClick={r.ok ? undefined : () => handleRetry(ch)}
          >
            {r.ok ? channelMeta[ch].label : '失败'}
            {r.ok ? '' : ''}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
};

const typeMeta: Record<
  string,
  { color: string; iconColor: string; textKey: string; bg: string; barColor: string }
> = {
  urgent: {
    color: 'red',
    iconColor: '#D64045',
    textKey: 'notification.urgent',
    bg: 'rgba(214, 64, 69, 0.08)',
    barColor: '#D64045',
  },
  meeting: {
    color: 'blue',
    iconColor: '#3B82F6',
    textKey: 'notification.meeting',
    bg: 'rgba(59, 130, 246, 0.08)',
    barColor: '#3B82F6',
  },
  ai: {
    color: 'gold',
    iconColor: '#C9A459',
    textKey: 'notification.ai',
    bg: 'rgba(201, 164, 89, 0.08)',
    barColor: '#C9A459',
  },
  system: {
    color: 'default',
    iconColor: '#8B949E',
    textKey: 'notification.system',
    bg: 'rgba(139, 148, 158, 0.08)',
    barColor: '#8B949E',
  },
  risk: {
    color: 'volcano',
    iconColor: '#D64045',
    textKey: 'notification.risk',
    bg: 'rgba(214, 64, 69, 0.12)',
    barColor: '#D64045',
  },
  todo: {
    color: 'cyan',
    iconColor: '#0EA5E9',
    textKey: 'notification.todo',
    bg: 'rgba(14, 165, 233, 0.08)',
    barColor: '#0EA5E9',
  },
};

const Notifications: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'compact'>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    unreadCount,
  } = useNotificationStore();

  const todoStore = useTodoStore();

  /**
   * 根据 businessRef 把通知跳转到对应业务单据详情页
   * 真实对接后端时，此处改为 fetch 单据详情 + 跳转
   */
  const routeByBusinessRef = (ref?: { type: string; id: string }): string | null => {
    if (!ref) return null;
    switch (ref.type) {
      case 'todo': {
        // 演示模式：跳到 /dashboard 并通过 location.state 高亮对应待办
        return `/dashboard?highlightTodo=${encodeURIComponent(ref.id)}`;
      }
      case 'meeting':
        return `/meeting/${encodeURIComponent(ref.id)}`;
      case 'approval':
        return `/approval?workItemId=${encodeURIComponent(ref.id)}`;
      case 'report':
        return `/report?reportId=${encodeURIComponent(ref.id)}`;
      case 'news':
        return `/industry-news?id=${encodeURIComponent(ref.id)}`;
      default:
        return null;
    }
  };

  const getTimeAgo = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('common.justNow');
    if (minutes < 60) return t('common.minutesAgo', { count: minutes });
    if (hours < 24) return t('common.hoursAgo', { count: hours });
    return t('common.daysAgo', { count: days });
  };

  const renderTypeIcon = (type: string) => {
    const meta = typeMeta[type] ?? typeMeta.system;
    const icon = (() => {
      switch (type) {
        case 'urgent':
          return <FireOutlined />;
        case 'meeting':
          return <CalendarOutlined />;
        case 'ai':
          return <RobotOutlined />;
        case 'risk':
          return <FireOutlined />;
        case 'todo':
          return <CheckOutlined />;
        default:
          return <FileTextOutlined />;
      }
    })();
    return (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: meta.bg,
          color: meta.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    );
  };

  const renderTypeTag = (type: string) => {
    const meta = typeMeta[type] ?? typeMeta.system;
    return (
      <Tag color={meta.color} style={{ margin: 0, borderRadius: 4 }}>
        {t(meta.textKey)}
      </Tag>
    );
  };

  // 统计
  const total = notifications.length;
  const unread = unreadCount();
  const urgentCount = useMemo(
    () => notifications.filter((n) => n.type === 'urgent' && !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const tabItems = [
    { key: 'all', label: `${t('common.all')} (${total})` },
    {
      key: 'unread',
      label: (
        <span>
          {t('notification.unread')}
          {unread > 0 && (
            <Badge
              count={unread}
              size="small"
              style={{ marginLeft: 6, backgroundColor: '#D64045' }}
            />
          )}
        </span>
      ),
    },
    { key: 'urgent', label: `${t('notification.urgent')} (${notifications.filter((n) => n.type === 'urgent').length})` },
    { key: 'risk', label: `${t('notification.risk') || '风险事件'} (${notifications.filter((n) => n.type === 'risk').length})` },
    { key: 'meeting', label: `${t('notification.meeting')} (${notifications.filter((n) => n.type === 'meeting').length})` },
    { key: 'todo', label: `${t('notification.todo') || '待办'} (${notifications.filter((n) => n.type === 'todo').length})` },
    { key: 'ai', label: `${t('notification.ai')} (${notifications.filter((n) => n.type === 'ai').length})` },
    { key: 'system', label: `${t('notification.system')} (${notifications.filter((n) => n.type === 'system').length})` },
  ];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要删除的消息');
      return;
    }
    selectedIds.forEach((id) => deleteNotification(id));
    message.success(`已删除 ${selectedIds.length} 条消息`);
    setSelectedIds([]);
  };

  const handleBatchRead = () => {
    if (selectedIds.length === 0) {
      message.warning('请先选择要标记的消息');
      return;
    }
    selectedIds.forEach((id) => markAsRead(id));
    message.success(`已标记 ${selectedIds.length} 条为已读`);
    setSelectedIds([]);
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    clearAll();
    setSelectedIds([]);
    message.success('已清空全部消息');
  };

  return (
    <div className="notifications-page">
      {/* 顶部标题区 */}
      <div className="notifications-header">
        <Space size={12} align="center">
          <BellOutlined style={{ fontSize: 22, color: 'var(--color-primary)' }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('topbar.notifications')}
          </Title>
          {unread > 0 && (
            <Tag color="red" style={{ borderRadius: 10 }}>
              {unread} {t('notification.unreadCount')}
            </Tag>
          )}
        </Space>
        <Space size={8}>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'list' | 'compact')}
            options={[
              { value: 'list', icon: <UnorderedListOutlined /> },
              { value: 'compact', icon: <AppstoreOutlined /> },
            ]}
          />
          <Button
            icon={<CheckOutlined />}
            onClick={() => {
              markAllAsRead();
              message.success('全部已读');
            }}
            disabled={unread === 0}
          >
            {t('notification.markAllRead')}
          </Button>
          <Button
            danger
            type="text"
            icon={<DeleteOutlined />}
            onClick={handleClearAll}
            disabled={notifications.length === 0}
          >
            {t('notification.clearAll')}
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div className="notifications-stats">
        <Card size="small" className="stat-card">
          <Statistic
            title={
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                <BellOutlined style={{ marginRight: 4 }} />
                {'全部消息'}
              </span>
            }
            value={total}
            valueStyle={{ fontSize: 22, color: '#0F2B5B' }}
          />
        </Card>
        <Card size="small" className="stat-card">
          <Statistic
            title={
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                {'未读消息'}
              </span>
            }
            value={unread}
            valueStyle={{ fontSize: 22, color: '#F59E0B' }}
          />
        </Card>
        <Card size="small" className="stat-card">
          <Statistic
            title={
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                <FireOutlined style={{ marginRight: 4 }} />
                {'紧急未读'}
              </span>
            }
            value={urgentCount}
            valueStyle={{
              fontSize: 22,
              color: urgentCount > 0 ? '#D64045' : '#22A775',
            }}
          />
        </Card>
        <Card size="small" className="stat-card stat-card--action">
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {'批量操作'}
            </Text>
            <Space size={4} style={{ marginTop: 4 }}>
              <Button
                type="link"
                size="small"
                disabled={selectedIds.length === 0}
                onClick={handleBatchRead}
              >
                {`标记已读 (${selectedIds.length})`}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                disabled={selectedIds.length === 0}
                onClick={handleBatchDelete}
              >
                {`删除 (${selectedIds.length})`}
              </Button>
            </Space>
          </div>
        </Card>
      </div>

      <Card className="notifications-content" styles={{ body: { padding: 16 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />

        {filteredNotifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: 'var(--color-text-hint)' }}>
                {activeTab === 'unread' ? t('notification.noUnread') : t('common.noData')}
              </span>
            }
            style={{ padding: '60px 0' }}
          />
        ) : (
          <div className={`notification-list notification-list--${viewMode}`}>
            {/* 全选栏 */}
            <div className="notification-toolbar">
              <Checkbox
                checked={
                  filteredNotifications.length > 0 &&
                  filteredNotifications.every((n) => selectedIds.includes(n.id))
                }
                indeterminate={
                  filteredNotifications.some((n) => selectedIds.includes(n.id)) &&
                  !filteredNotifications.every((n) => selectedIds.includes(n.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(filteredNotifications.map((n) => n.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedIds.length > 0
                    ? `已选 ${selectedIds.length} / ${filteredNotifications.length}`
                    : `本页共 ${filteredNotifications.length} 条`}
                </Text>
              </Checkbox>
            </div>

            {filteredNotifications.map((item) => {
              const meta = typeMeta[item.type] ?? typeMeta.system;
              const isSelected = selectedIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={[
                    'notification-item',
                    !item.read && 'unread',
                    isSelected && 'selected',
                    'clickable',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    borderLeftColor: meta.barColor,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    // 标记已读
                    if (!item.read) markAsRead(item.id);
                    // 跳转到对应业务单据
                    if (item.type === 'todo' && item.businessRef?.id) {
                      navigate(
                        `/dashboard?highlightTodo=${encodeURIComponent(item.businessRef.id)}`
                      );
                      return;
                    }
                    const url = routeByBusinessRef(item.businessRef);
                    if (url) {
                      navigate(url);
                    } else {
                      message.info(`查看通知：${item.title}`);
                    }
                  }}
                >
                  {/* 左侧：复选框 + 图标 */}
                  <div className="notification-left">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {renderTypeIcon(item.type)}
                  </div>

                  {/* 中间：内容 */}
                  <div className="notification-main">
                    <div className="notification-title-line">
                      <Space size={8} wrap>
                        <Text
                          strong
                          style={{ fontSize: 14, color: item.read ? '#6B7280' : '#0F2B5B' }}
                        >
                          {item.title}
                        </Text>
                        {renderTypeTag(item.type)}
                        {!item.read && (
                          <span className="notification-dot" />
                        )}
                      </Space>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                      >
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {getTimeAgo(item.timestamp)}
                      </Text>
                    </div>
                    <Text
                      className="notification-content"
                      style={{
                        fontSize: 13,
                        color: item.read ? '#9CA3AF' : '#4E5969',
                      }}
                    >
                      {item.content}
                    </Text>

                    {/* 操作按钮 */}
                    <div className="notification-actions">
                      {(item.action ?? []).map((action) => (
                        <Button
                          key={action.key}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 标记已读（任何按钮点击都视为已读）
                            if (!item.read) markAsRead(item.id);

                            switch (action.key) {
                              case 'view': {
                                // 待办 → Dashboard 高亮；其他 → businessRef 对应页面
                                if (item.type === 'todo' && item.businessRef?.id) {
                                  // 演示模式：在 todoStore 里找到对应项并标记当前激活
                                  const matched = todoStore.items.find(
                                    (it) => it.id === item.businessRef?.id
                                  );
                                  if (matched) {
                                    todoStore.setActiveId?.(item.businessRef.id);
                                  }
                                  navigate(
                                    `/dashboard?highlightTodo=${encodeURIComponent(item.businessRef.id)}`
                                  );
                                } else {
                                  const url = routeByBusinessRef(item.businessRef);
                                  if (url) {
                                    navigate(url);
                                  } else {
                                    message.info(action.label);
                                  }
                                }
                                break;
                              }
                              case 'join': {
                                // 跳到对应会议室
                                const url = routeByBusinessRef(item.businessRef);
                                if (url) navigate(url);
                                else message.info(action.label);
                                break;
                              }
                              case 'accept': {
                                // 演示模式：写入会议邀请接受
                                message.success('已接受会议邀请');
                                // 真实对接：fetch(`/api/meetings/${id}/invitations/accept`, { method: 'POST' })
                                break;
                              }
                              case 'decline': {
                                message.warning('已婉拒会议邀请');
                                break;
                              }
                              case 'complete': {
                                // 一键完成：演示模式调用 todoStore.markDone
                                if (item.businessRef?.id) {
                                  const matched = todoStore.items.find(
                                    (it) => it.id === item.businessRef?.id
                                  );
                                  if (matched) {
                                    todoStore.markDone?.(item.businessRef.id);
                                    message.success('任务已完成');
                                    // 完成后把通知也删掉
                                    deleteNotification(item.id);
                                    break;
                                  }
                                }
                                message.info(action.label);
                                break;
                              }
                              case 'delay':
                              case 'submit':
                              case 'unfavorite':
                              case 'freeze':
                              default: {
                                message.info(action.label);
                                break;
                              }
                            }
                          }}
                          style={{
                            borderRadius: 6,
                            borderColor: '#0F2B5B',
                            color: '#0F2B5B',
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                      {!item.read && (
                        <Tooltip title={t('notification.markRead')}>
                          <Button
                            size="small"
                            type="text"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.id);
                            }}
                            style={{ color: '#86909C' }}
                            icon={<CheckOutlined />}
                          >
                            {t('notification.markRead')}
                          </Button>
                        </Tooltip>
                      )}
                      <Button
                        size="small"
                        type="text"
                        danger
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                          setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                        }}
                        icon={<DeleteOutlined />}
                      >
                        {t('notification.delete')}
                      </Button>

                      {/* 推送渠道状态（外部推送） */}
                      {item.pushResult && (
                        <PushStatusBadge
                          pushResult={item.pushResult}
                          notificationId={item.id}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Notifications;
