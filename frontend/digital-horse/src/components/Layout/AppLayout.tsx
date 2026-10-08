import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Layout as AntLayout } from 'antd';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatDrawer from './ChatDrawer';
import RoleSwitchModal from '@/components/RoleSwitchModal';
import PageLoader from '@/components/PageLoader';
import { useAppStore, useUserStore, useContactsStore } from '@/store';
import { useWorkitemDueReminder } from '@/hooks/useWorkitemDueReminder';
import type { ContactEmployee } from '@/types/contacts';

const { Content } = AntLayout;

const AppLayout: React.FC = () => {
  const { collapsed } = useAppStore();
  const { user, isAuthenticated } = useUserStore();
  const bootstrap = useContactsStore((s) => s.bootstrap);
  const navigate = useNavigate();
  const siderWidth = collapsed ? 64 : 200;
  const [chatPeer, setChatPeer] = useState<ContactEmployee | null>(null);

  // 工单到期催办定时器
  useWorkitemDueReminder();

  // 未登录用户重定向到登录页
  useEffect(() => {
    if (!isAuthenticated && !user) {
      // 短暂延迟以确保 store 已加载
      const timer = setTimeout(() => {
        if (!useUserStore.getState().isAuthenticated) {
          navigate('/login', { replace: true });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, navigate]);

  // 注入通讯录 mock 数据
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // 监听"打开聊天"事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ContactEmployee>).detail;
      if (detail && detail.id) {
        setChatPeer(detail);
      }
    };
    document.addEventListener('open-chat', handler as EventListener);
    return () => {
      document.removeEventListener('open-chat', handler as EventListener);
    };
  }, []);

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#F7F9FC' }}>
      <Sidebar width={siderWidth} />
      <AntLayout
        style={{
          marginLeft: siderWidth,
          transition: 'margin-left 0.2s',
          background: '#F7F9FC',
        }}
      >
        <Header />
        <Content
          style={{
            margin: 12,
            padding: 0,
            background: '#F7F9FC',
          }}
        >
          {/*
            路由级 Suspense：lazy() 页面 chunk 未到达时显示 PageLoader，
            避免从 MeetingListPage → MeetingHub 等切换时整片白屏。
          */}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </Content>
      </AntLayout>

      {/* 全局聊天抽屉 */}
      <ChatDrawer
        open={chatPeer !== null}
        peer={chatPeer}
        onClose={() => setChatPeer(null)}
      />

      {/* 角色切换 Modal */}
      <RoleSwitchModal />
    </AntLayout>
  );
};

export default AppLayout;
