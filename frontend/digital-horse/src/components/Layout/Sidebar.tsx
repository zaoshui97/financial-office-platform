/**
 * 侧边导航栏组件
 * 支持角色权限控制和菜单分组
 */

import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  VideoCameraOutlined,
  RobotOutlined,
  BookOutlined,
  RiseOutlined,
  AppstoreOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  SettingOutlined,
  ClusterOutlined,
  AuditOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAppStore } from '@/store';
import { usePermission } from '@/hooks/usePermission';
import { MenuItem, GROUP_LABELS, type MenuGroup } from '@/types/permission';
import Logo from './Logo';

const { Sider } = Layout;

const getPlatformName = () => {
  return i18n.language === 'en-US' ? 'Apexis' : '睿枢';
};

interface SidebarProps {
  width: number;
}

/** 菜单图标映射 */
const iconMap: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  meeting: <VideoCameraOutlined />,
  qa: <RobotOutlined />,
  knowledge: <BookOutlined />,
  industryNews: <RiseOutlined />,
  agent: <ClusterOutlined />,
  agentHub: <ClusterOutlined />,
  plugins: <AppstoreOutlined />,
  memory: <TeamOutlined />,
  security: <SafetyCertificateOutlined />,
  logs: <FileSearchOutlined />,
  settings: <SettingOutlined />,
  approval: <AuditOutlined />,
  sandbox: <SafetyCertificateOutlined />,
  reportWeekly: <FileTextOutlined />,
  report: <FileTextOutlined />,
  contacts: <TeamOutlined />,
};

/** 菜单配置 - 整合后精简版（19 → 12 项 + AI 智能中心 2 项 = 14 项） */
const menuConfig: MenuItem[] = [
  // 核心办公 - 所有人可见
  { key: '/dashboard', path: '/dashboard', labelKey: 'nav.workspace', icon: 'dashboard', group: 'core', roles: ['*'] },
  { key: '/meeting', path: '/meeting', labelKey: 'nav.meeting', icon: 'meeting', group: 'core', roles: ['*'] },
  { key: '/approval', path: '/approval', labelKey: 'nav.approval', icon: 'approval', group: 'core', roles: ['*'] },

  // 合规中心 - 所有人可见（合规检测 + 报告）
  { key: '/sandbox', path: '/sandbox', labelKey: 'nav.sandbox', icon: 'sandbox', group: 'compliance', roles: ['*'] },
  { key: '/report', path: '/report', labelKey: 'nav.report', icon: 'report', group: 'compliance', roles: ['*'] },

  // 知识管理 - 所有人可见
  { key: '/knowledge', path: '/knowledge', labelKey: 'nav.knowledge', icon: 'knowledge', group: 'knowledge', roles: ['*'] },
  { key: '/industry-news', path: '/industry-news', labelKey: 'nav.industryNews', icon: 'industryNews', group: 'knowledge', roles: ['*'] },

  // AI 智能中心 - 问答 + 多 Agent（2025-Q4 恢复）
  { key: '/qa', path: '/qa', labelKey: 'nav.qa', icon: 'qa', group: 'ai', roles: ['*'] },
  { key: '/agent', path: '/agent', labelKey: 'nav.agentHub', icon: 'agentHub', group: 'ai', roles: ['*'] },

  // 辅助工具 - 通讯录为系统内部辅助沟通工具（不作为核心业务流程）
  { key: '/contacts', path: '/contacts', labelKey: 'nav.contacts', icon: 'contacts', group: 'communication', roles: ['*'] },

  // 系统管理 - 仅超级管理员
  { key: '/security', path: '/security', labelKey: 'nav.securityCenter', icon: 'security', group: 'system', roles: ['SUPER_ADMIN'] },
  { key: '/settings', path: '/settings', labelKey: 'nav.systemSettings', icon: 'settings', group: 'system', roles: ['SUPER_ADMIN'] },
];

const Sidebar: React.FC<SidebarProps> = ({ width }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, setCollapsed } = useAppStore();
  const { t } = useTranslation();
  const { filterAccessibleMenus } = usePermission();

  /** 根据权限过滤菜单 */
  const accessibleMenus = useMemo(() => {
    return filterAccessibleMenus(menuConfig);
  }, [filterAccessibleMenus]);

  /** 按分组组织菜单 */
  const groupedMenus = useMemo(() => {
    const groups: Record<MenuGroup, MenuItem[]> = {
      core: [],
      compliance: [],
      knowledge: [],
      ai: [],
      system: [],
      communication: [],
    };

    accessibleMenus.forEach(menu => {
      if (groups[menu.group]) {
        groups[menu.group].push(menu);
      }
    });

    return groups;
  }, [accessibleMenus]);
  /** 获取分组标题 */
  const getGroupLabel = (group: MenuGroup): string => {
    return t(`nav.group.${group}`) || GROUP_LABELS[group];
  };

  /** 菜单项点击处理 */
  const handleMenuClick = (e: { key: string }) => {
    navigate(e.key);
  };

  /** 生成 Ant Design Menu 的 items */
  const getMenuItems = (): any[] => {
    const items: any[] = [];

    // 核心办公分组
    if (groupedMenus.core.length > 0) {
      groupedMenus.core.forEach(menu => {
        items.push({
          key: menu.key,
          icon: iconMap[menu.icon],
          label: t(menu.labelKey),
        });
      });
    }

    // 合规中心分组
    if (groupedMenus.compliance.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      groupedMenus.compliance.forEach(menu => {
        items.push({
          key: menu.key,
          icon: iconMap[menu.icon],
          label: t(menu.labelKey),
        });
      });
    }

    // 知识管理分组
    if (groupedMenus.knowledge.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      groupedMenus.knowledge.forEach(menu => {
        items.push({
          key: menu.key,
          icon: iconMap[menu.icon],
          label: t(menu.labelKey),
        });
      });
    }

    // AI 智能中心分组（问答 + 多 Agent）
    if (groupedMenus.ai.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      groupedMenus.ai.forEach(menu => {
        items.push({
          key: menu.key,
          icon: iconMap[menu.icon],
          label: t(menu.labelKey),
        });
      });
    }

    // 系统管理分组
    if (groupedMenus.system.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      groupedMenus.system.forEach(menu => {
        items.push({
          key: menu.key,
          icon: iconMap[menu.icon],
          label: t(menu.labelKey),
        });
      });
    }

    // 辅助工具分组（通讯录等系统内部辅助工具，不作为核心业务流程）
    if (groupedMenus.communication.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      groupedMenus.communication.forEach(menu => {
        items.push({
          key: menu.key,
          icon: iconMap[menu.icon],
          label: t(menu.labelKey),
        });
      });
    }

    return items;
  };

  const appName = collapsed ? (
    <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>R</span>
  ) : (
    <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{getPlatformName()}</span>
  );

  const collapseText = collapsed ? t('sidebar.expand') : t('sidebar.collapse');

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      width={200}
      collapsedWidth={64}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        background: '#0F2B5B',
        zIndex: 100,
      }}
    >
      {/* Logo 区域：矢量图 Logo + 「睿枢」/「Apexis」文字，整体高度与 Topbar 铃铛 + 头像 (32-36px) 对齐 */}
      <div
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: collapsed ? '0' : '0 14px',
          flexShrink: 0,
        }}
      >
        {/* 平台 Logo：使用 logo2.0.png，白底圆角容器，深色 sidebar 上清晰可辨 */}
        <Logo size={40} />

        {!collapsed && (
          <span
            style={{
              color: '#fff',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: 1.5,
              lineHeight: '32px',
              whiteSpace: 'nowrap',
            }}
          >
            {getPlatformName()}
          </span>
        )}
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={getMenuItems()}
        onClick={handleMenuClick}
        style={{
          background: 'transparent',
          borderRight: 0,
          marginTop: 8,
        }}
      />

      {/* 收起/展开按钮 */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.65)',
          transition: 'color 0.3s',
          fontSize: 13,
          padding: '8px 0',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
      >
        <span style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
          ▶
        </span>
        {!collapsed && <span style={{ marginLeft: 8 }}>{collapseText}</span>}
      </div>
    </Sider>
  );
};

export default Sidebar;
