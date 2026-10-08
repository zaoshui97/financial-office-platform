/**
 * 会议中心（统一入口）
 *
 * 把原本 5 个会议类页面整合到一个路由：
 *   /meeting                          - 会议列表
 *   /meeting?tab=detail&id=xxx        - 会议详情（默认）
 *   /meeting?tab=room&id=xxx          - 实时会议室
 *   /meeting?tab=rehearsal&id=xxx     - 彩排模式
 *   /meeting?tab=report&id=xxx        - 会议报告
 *
 * 设计原则同 AgentHub：
 *   1. 不重写原页面，lazy 加载复用
 *   2. 通过 query string 切 Tab + 选会议
 *   3. 旧路由 /meeting-room/:id 等自动重定向到此页
 */

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Tabs, Spin, Alert, Typography, Space, Tag, Modal, Input, Button, message } from 'antd';
import {
  UnorderedListOutlined,
  ProfileOutlined,
  VideoCameraOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  CalendarOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { meetingInviteApi, JoinResult } from '@/api/meetingInvite';

const { Title, Text, Paragraph } = Typography;

// 5 个原页面（懒加载）
const MeetingList = React.lazy(() => import('@/pages/Meeting/MeetingList'));
const MeetingDetail = React.lazy(() => import('@/pages/Meeting/MeetingDetail'));
const MeetingRoom = React.lazy(() => import('@/pages/Meeting/MeetingRoom'));
const MeetingRehearsal = React.lazy(() => import('@/pages/Meeting/MeetingRehearsal'));
const PostMeetingReport = React.lazy(() => import('@/pages/Meeting/PostMeetingReport'));

type TabKey = 'list' | 'detail' | 'room' | 'rehearsal' | 'report';

const MeetingHub: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // 解析 tab + id
  const rawTab = searchParams.get('tab') as TabKey | null;
  const meetingId = searchParams.get('id') || '1';

  const isValidTab = (k: string | null): k is TabKey =>
    !!k && ['list', 'detail', 'room', 'rehearsal', 'report'].includes(k);

  const [activeTab, setActiveTab] = useState<TabKey>(
    isValidTab(rawTab) ? rawTab : 'list'
  );
  const syncedRef = React.useRef(false);
  const navigate = useNavigate();

  // 顶部栏"用邀请码加入"弹窗
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const handleJoinByCode = async () => {
    const code = joinCode.trim();
    if (!code) {
      message.warning('请输入邀请码');
      return;
    }
    setJoinLoading(true);
    try {
      const res: JoinResult = await meetingInviteApi.join(code);
      if (res.joined) {
        message.success(res.message || '加入成功');
        setJoinOpen(false);
        setJoinCode('');
        navigate(`/meeting?tab=detail&id=${res.meeting_id}`);
      } else {
        message.warning(res.message || '未加入会议');
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? e?.message ?? '加入失败');
    } finally {
      setJoinLoading(false);
    }
  };

  // 同步 query: 仅在初次挂载或外部 query 真正变化时同步一次，避免 setSearchParams 反向触发自身形成循环
  useEffect(() => {
    if (syncedRef.current) return;
    const tab = searchParams.get('tab');
    if (isValidTab(tab)) {
      // URL 有效 tab 已存在 → 同步完成
      syncedRef.current = true;
    } else {
      // URL 没有 tab → 写入当前 activeTab，之后不再管
      syncedRef.current = true;
      setSearchParams({ tab: activeTab }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听外部 query 变化（如用户手动改地址栏），实时同步
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isValidTab(tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    const params: Record<string, string> = { tab: key };
    if (key !== 'list') params.id = meetingId;
    setSearchParams(params);
  };

  // Tab 配置
  const tabs: Array<{
    key: TabKey;
    label: React.ReactNode;
    render: () => React.ReactNode;
    show: boolean;
  }> = [
    {
      key: 'list',
      label: (
        <Space size={6}>
          <UnorderedListOutlined />
          <span>{'会议列表'}</span>
        </Space>
      ),
      show: true,
      render: () => <MeetingList />,
    },
    {
      key: 'detail',
      label: (
        <Space size={6}>
          <ProfileOutlined />
          <span>{'会议详情'}</span>
        </Space>
      ),
      show: !!meetingId,
      render: () => <MeetingDetail />,
    },
    {
      key: 'room',
      label: (
        <Space size={6}>
          <VideoCameraOutlined />
          <span>{'实时会议室'}</span>
          <Tag color="red" style={{ marginLeft: 4 }}>LIVE</Tag>
        </Space>
      ),
      show: !!meetingId,
      render: () => <MeetingRoom meetingId={meetingId} />,
    },
    {
      key: 'rehearsal',
      label: (
        <Space size={6}>
          <PlayCircleOutlined />
          <span>{'彩排'}</span>
        </Space>
      ),
      show: !!meetingId,
      render: () => <MeetingRehearsal />,
    },
    {
      key: 'report',
      label: (
        <Space size={6}>
          <FileTextOutlined />
          <span>{'会议报告'}</span>
        </Space>
      ),
      show: !!meetingId,
      render: () => <PostMeetingReport />,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show);
  const currentTab = tabs.find((t) => t.key === activeTab);

  return (
    <div style={{ padding: 20, background: '#F7F9FC', minHeight: '100%' }}>
      {/* Header */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: '#0F2B5B',
          border: 'none',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Space size={16} align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={0}>
            <Space size={8}>
              <CalendarOutlined style={{ fontSize: 24, color: '#fff' }} />
              <Title level={4} style={{ margin: 0, color: '#fff' }}>
                {'会议中心'}
              </Title>
              <Tag color="gold" style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                {'5 大场景合一'}
              </Tag>
            </Space>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
              会议从预约、详情、实时会议、彩排到报告生成，全在一个页面
            </Text>
          </Space>
          <Button
            type="primary"
            ghost
            icon={<KeyOutlined />}
            onClick={() => setJoinOpen(true)}
            style={{ borderColor: 'rgba(255,255,255,0.6)', color: '#fff' }}
          >
            用邀请码加入
          </Button>
        </Space>
      </Card>

      {/* Tabs */}
      <Card styles={{ body: { padding: '0 0 12px 0' } }} style={{ background: '#fff' }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={visibleTabs.map((t) => ({ key: t.key, label: t.label }))}
          size="large"
          tabBarStyle={{
            margin: 0,
            paddingLeft: 20,
            borderBottom: '1px solid #F0F0F0',
          }}
        />

        <div style={{ padding: '0 16px' }}>
          <Suspense
            fallback={
              <div style={{ padding: 60, textAlign: 'center' }}>
                <Spin size="large" tip={'加载中…'} />
              </div>
            }
          >
            {currentTab?.render()}
          </Suspense>
        </div>
      </Card>

      {/* 用邀请码加入弹窗 —— Header 快捷入口 */}
      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#1890ff' }} />
            <span>用邀请码加入会议</span>
          </Space>
        }
        open={joinOpen}
        onCancel={() => { setJoinOpen(false); setJoinCode(''); }}
        onOk={handleJoinByCode}
        confirmLoading={joinLoading}
        okText="加入"
        cancelText="取消"
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">
            请向会议组织者获取 6 位字符串邀请码：
          </Text>
          <Input
            size="large"
            placeholder="例如：a8K2pZ"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onPressEnter={handleJoinByCode}
            maxLength={32}
            style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 18 }}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default MeetingHub;
