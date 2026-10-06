import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Space, Avatar, Modal, App, Button, Tag, Empty } from 'antd';
import {
  CalendarOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ActionItem } from '@/types/api';
import { useUserStore, useTodoStore } from '@/store';
import { useDispatchLogStore } from '@/store/dispatchLogStore';
import { eventBus } from '@/services/eventBus';
import DashboardCharts from './components/DashboardCharts';
import { DEMO_WORKITEMS } from '@/mock/meetingDemo';
import { useMeetingWorkItemStore } from '@/store';
import './index.css';

const { Text } = Typography;

// ───── 演示会议日程（用于工作台左侧"会议协同"卡片） ─────
interface DemoMeeting {
  id: string;
  title: string;
  startAt: string;   // HH:mm
  durationMin: number;
  host: string;
  participants: number;
  status: 'live' | 'upcoming' | 'today';
}

const DEMO_TODAY_MEETINGS: DemoMeeting[] = [
  { id: 'm-1', title: '2024年Q4预算审批与合规整改专题会', startAt: '15:00', durationMin: 90,  host: '王总（财务总监）', participants: 8, status: 'live' },
  { id: 'm-2', title: '风控委周度复盘',                   startAt: '16:30', durationMin: 45,  host: '李娜（合规经理）', participants: 6, status: 'upcoming' },
  { id: 'm-3', title: '新人入职培训 · 9 月批次',          startAt: '10:00', durationMin: 120, host: '陈强（产品总监）', participants: 12, status: 'today' },
];

const Dashboard: React.FC = () => {
  const { user } = useUserStore();
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();
  const { message } = App.useApp();

  // ───── 仿真联动指示器 ─────
  const [syncBadge, setSyncBadge] = useState<string | null>(null);
  const dispatchLogCount = useDispatchLogStore((s) => s.logs.length);

  useEffect(() => {
    const showBadge = (text: string) => {
      setSyncBadge(text);
      setTimeout(() => setSyncBadge(null), 2500);
    };
    const off1 = eventBus.on('meeting.workitem.created', () => showBadge('会议工单已派发 · 卡片已更新'));
    const off2 = eventBus.on('approval.changed', () => showBadge('审批状态已变更 · 卡片已更新'));
    const off3 = eventBus.on('sandbox.blocked', () => showBadge('检测到合规阻断 · 风险卡片 +1'));
    const off4 = eventBus.on('news.risk.flagged', () => showBadge('监管风险已识别 · 卡片已更新'));
    const off5 = eventBus.on('contacts.dingtalkSynced', () => showBadge('钉钉通讯录已同步'));
    const off6 = eventBus.on('dingtalk.connected', () => showBadge('钉钉已连接'));
    return () => { off1(); off2(); off3(); off4(); off5(); off6(); };
  }, []);

  // 待办
  const bootstrapTodo = useTodoStore((s) => s.bootstrap);
  const todoItems = useTodoStore((s) => s.items);
  const todoMarkDone = useTodoStore((s) => s.markDone);
  useEffect(() => { bootstrapTodo(); }, [bootstrapTodo]);

  // 会议工单
  const meetingWorkItems = useMeetingWorkItemStore((s) => s.items);
  const bulkCreate = useMeetingWorkItemStore((s) => s.bulkCreate);
  useEffect(() => {
    if (meetingWorkItems.length === 0) {
      bulkCreate(
        DEMO_WORKITEMS.map((w) => ({
          meetingId: w.meetingId,
          meetingTitle: w.meetingTitle,
          title: w.title,
          text: w.text,
          assignee: w.assignee,
          assigneeDept: w.assigneeDept,
          dueDate: w.dueDate,
          priority: w.priority,
          meetingSegmentId: w.meetingSegmentId,
          meetingSegmentSnippet: w.meetingSegmentSnippet,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actionItems: ActionItem[] = todoItems;

  // 我的待办 Top3：优先级 P0/P1 优先
  const priorityRank = (a: ActionItem) => {
    const desc = a.description || '';
    if (/P0|紧急|今天截止|今日/.test(desc)) return 0;
    if (/P1|重要/.test(desc)) return 1;
    if (/P2/.test(desc)) return 2;
    return 3;
  };
  const pendingItems = actionItems.filter((i) => i.status !== 'done');
  const top3 = [...pendingItems]
    .sort((a, b) => priorityRank(a) - priorityRank(b) || (a.dueDate || '').localeCompare(b.dueDate || ''))
    .slice(0, 3);
  const total = actionItems.length;
  const todoCount = actionItems.filter((i) => i.status === 'todo').length;
  const doingCount = actionItems.filter((i) => i.status === 'in_progress').length;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 18) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  };

  const handleMarkDone = (record: ActionItem) => {
    Modal.confirm({
      title: t('dashboard.markAsDoneTitle'),
      content: t('dashboard.markAsDoneContent', { description: record.description }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: () => {
        todoMarkDone(record.id);
        message.success(t('dashboard.markedAsDone'));
      },
    });
  };

  // 通知最近 3 条（按时间倒序）
  return (
    <div style={{ padding: 16, background: '#F7F9FC', minHeight: '100%' }}>

      {/* ─── 顶部：问候 + 一句话摘要 ─── */}
      <Card size="small" styles={{ body: { padding: '14px 18px' } }} style={{ marginBottom: 12 }}>
        <Row align="middle">
          <Col span={16}>
            <Space align="center">
              <Avatar style={{ background: '#0F2B5B' }} size={40}>
                {user?.name?.charAt(0) || 'U'}
              </Avatar>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {getGreeting()}，{user?.name || t('common.defaultUser')}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
                  {currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}
                  {currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </div>
            </Space>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <span style={{ color: '#22A775' }}>●</span> 仿真联动 · {dispatchLogCount} 条推送
              </Text>
              {syncBadge && (
                <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>↻ {syncBadge}</Tag>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ─── 主体：左「会议协同」+ 右「我的待办」左右结构 ─── */}
      <Row gutter={12} align="stretch" style={{ marginBottom: 12 }}>
        {/* ─── 左：会议协同 ─── */}
        <Col xs={24} md={12}>
          <Card
            size="small"
            styles={{ body: { padding: 0 } }}
            style={{ height: '100%' }}
            title={
              <Space>
                <CalendarOutlined style={{ color: '#3B82F6' }} />
                <span style={{ fontSize: 14 }}>会议协同</span>
                <Tag color="processing" style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px' }}>
                  {DEMO_TODAY_MEETINGS.length} 场今日
                </Tag>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/meeting')} style={{ color: '#0F2B5B' }}>
                进入会议 <ArrowRightOutlined />
              </Button>
            }
          >
            {DEMO_TODAY_MEETINGS.map((m, idx) => {
              const live = m.status === 'live';
              const upcoming = m.status === 'upcoming';
              const accent = live ? '#EF4444' : upcoming ? '#3B82F6' : '#22A775';
              return (
                <div
                  key={m.id}
                  onClick={() => navigate('/meeting')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderTop: idx === 0 ? 'none' : '1px solid #F5F7FA',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFBFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: `${accent}14`, color: accent,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <ClockCircleOutlined style={{ fontSize: 12 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, marginTop: 2 }}>{m.startAt}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Text strong ellipsis style={{ fontSize: 13, color: '#0F2B5B' }}>{m.title}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      主持人 {m.host} · {m.durationMin} 分钟 · {m.participants} 人参会
                    </Text>
                  </div>
                  {live ? (
                    <Tag color="error" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                      ● 进行中
                    </Tag>
                  ) : upcoming ? (
                    <Button
                      size="small" type="primary"
                      icon={<VideoCameraOutlined />}
                      onClick={(e) => { e.stopPropagation(); navigate('/meeting'); }}
                      style={{ background: '#3B82F6', borderColor: '#3B82F6', fontSize: 11, height: 24 }}
                    >
                      加入
                    </Button>
                  ) : (
                    <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                      已安排
                    </Tag>
                  )}
                </div>
              );
            })}
          </Card>
        </Col>

        {/* ─── 右：我的待办 ─── */}
        <Col xs={24} md={12}>
          <Card
            size="small"
            styles={{ body: { padding: top3.length === 0 ? 16 : 0 } }}
            style={{ height: '100%' }}
            title={
              <Space>
                <WarningOutlined style={{ color: '#E69948' }} />
                <span style={{ fontSize: 14 }}>我的待办</span>
                <Tag color="warning" style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px' }}>待办 {todoCount}</Tag>
                <Tag color="processing" style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px' }}>进行中 {doingCount}</Tag>
              </Space>
            }
            extra={
              <Button type="link" size="small" onClick={() => navigate('/meeting?tab=list')} style={{ color: '#0F2B5B' }}>
                全部 {total} <ArrowRightOutlined />
              </Button>
            }
          >
            {top3.length === 0 ? (
              <Empty description={<Text type="secondary" style={{ fontSize: 12 }}>今天没有待办，享受片刻清闲</Text>} imageStyle={{ height: 32 }} />
            ) : (
              top3.map((item, idx) => {
                const isDone = item.status === 'done';
                const color = item.status === 'todo' ? '#E69948' : item.status === 'in_progress' ? '#3B82F6' : '#22A775';
                return (
                  <div
                    key={item.id}
                    onClick={() => !isDone && handleMarkDone(item)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 16px',
                      borderTop: idx === 0 ? 'none' : '1px solid #F5F7FA',
                      cursor: !isDone ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => !isDone && (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <Text
                      style={{ flex: 1, fontSize: 13, color: isDone ? '#8A94A6' : '#1a1a2e', textDecoration: isDone ? 'line-through' : 'none' }}
                      ellipsis
                    >
                      {item.description}
                    </Text>
                    <Space size={6} style={{ flexShrink: 0 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.assigneeName}</Text>
                      <Tag
                        color={item.status === 'todo' ? 'warning' : item.status === 'in_progress' ? 'processing' : 'success'}
                        style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                        {item.status === 'todo' ? '待办' : item.status === 'in_progress' ? '进行中' : '已完成'}
                      </Tag>
                      {!isDone && (
                        <Button type="text" size="small" icon={<CheckCircleOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleMarkDone(item); }}
                          style={{ color: '#22A775' }} />
                      )}
                    </Space>
                  </div>
                );
              })
            )}
          </Card>
        </Col>
      </Row>

      {/* ─── 主入口矩阵 + 效率趋势 ─── */}
      <DashboardCharts />
    </div>
  );
};

export default Dashboard;
