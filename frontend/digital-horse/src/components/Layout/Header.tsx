import React from 'react';
import { Layout, Avatar, Space, Button, Breadcrumb, Tag, Modal, Select, message, Tooltip, Badge, Flex } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n';
import { useUserStore, useNotificationStore } from '@/store';
import { ROLE_LABELS, type Role } from '@/types/permission';
import ProfileDrawer from './ProfileDrawer';

const { Header } = Layout;

const HeaderComponent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout, setRole } = useUserStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const [roleModalVisible, setRoleModalVisible] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<Role>(user?.role || 'USER');

  const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
    changeLanguage(lang);
  };

  const handleLogout = () => {
    Modal.confirm({
      title: t('header.logoutConfirm'),
      content: t('header.logoutMessage'),
      okText: t('header.logout'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        logout();
        navigate('/login');
      },
    });
  };

  const handleRoleSwitch = () => {
    setSelectedRole(user?.role || 'USER');
    setRoleModalVisible(true);
  };

  const confirmRoleSwitch = () => {
    if (user && selectedRole !== user.role) {
      setRole(selectedRole);
      message.success(`${t('settings.roleSwitched')}${ROLE_LABELS[selectedRole]}`);
      window.location.reload();
    }
    setRoleModalVisible(false);
  };

  const getPageName = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return t('header.home');

    // 完整路径（如 /report/weekly）优先用 nav 里已有的中文 key
    const fullPath = segments.join('/');
    const navKey = `nav.${segments[0]}`;
    const navTranslated = t(navKey);
    if (navTranslated !== navKey) {
      // 有中文翻译，再附加子路径标识
      const subNavKey = `nav.${segments[0]}.${segments[1] ?? ''}`;
      const subTranslated = segments[1] ? t(subNavKey) : '';
      if (subTranslated && subTranslated !== subNavKey) {
        return `${navTranslated} / ${subTranslated}`;
      }
      return navTranslated;
    }
    // fallback：取路径最后一段小写作为展示
    return segments[segments.length - 1].toUpperCase();
  };

  const currentPageName = getPageName();

  const getRoleColor = (role: Role | undefined) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'red';
      case 'DEPT_ADMIN': return 'orange';
      default: return 'blue';
    }
  };

  return (
    <>
      <Header
        style={{
          padding: '0 24px',
          background: 'var(--color-bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          borderBottom: '1px solid var(--color-border)',
          height: 64,
          lineHeight: '64px',
        }}
      >
        <Breadcrumb
          items={[
            { title: <a onClick={() => navigate('/dashboard')}>{t('header.home')}</a> },
            { title: currentPageName },
          ]}
        />

        <Flex align="center" gap="large" style={{ flexShrink: 0 }}>
          {user?.role && (
            <Tag color={getRoleColor(user.role)} icon={<SafetyCertificateOutlined />} style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}>
              {ROLE_LABELS[user.role]}
            </Tag>
          )}

          {/* 语言切换：中文锁定阶段先隐藏，后续打磨英文版再启用 */}
          {/* <Button
            type="text"
            icon={<GlobalOutlined />}
            onClick={() => handleLanguageChange(i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN')}
          >
            {i18n.language === 'zh-CN' ? t('common.chinese') : t('common.english')}
          </Button> */}

          <Tooltip title={t('topbar.notifications')}>
            <Badge count={unreadCount} size="small" overflowCount={99}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate('/notifications')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/notifications');
                  }
                }}
                style={{ cursor: 'pointer', padding: 4, borderRadius: 6, lineHeight: 1 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E5969" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
            </Badge>
          </Tooltip>

          {/* 用户头像 - 点击打开个人中心浮窗 */}
          <div
            onClick={() => setProfileOpen(true)}
            style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
          >
            <Space size={10}>
              <Avatar icon={<UserOutlined />} src={user?.avatar} size={40} style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.3 }}>
                <span style={{ color: '#1D2129', fontSize: 14, fontWeight: 500 }}>
                  {user?.name || user?.username || t('common.defaultUser')}
                </span>
                {user?.department && (
                  <span style={{ color: '#8A94A6', fontSize: 12 }}>
                    {user.department}
                  </span>
                )}
              </div>
            </Space>
          </div>
        </Flex>
      </Header>

      {/* 个人中心浮窗 */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* 角色切换模态框 */}
      <Modal
        title={t('settings.switchRole')}
        open={roleModalVisible}
        onOk={confirmRoleSwitch}
        onCancel={() => setRoleModalVisible(false)}
        okText={t('settings.confirmSwitch')}
        cancelText={t('common.cancel')}
      >
        <div style={{ padding: '16px 0' }}>
          <p style={{ marginBottom: 16 }}>
            {t('settings.currentRole')}
            <Tag color={getRoleColor(user?.role)}>{ROLE_LABELS[user?.role]}</Tag>
          </p>
          <p style={{ marginBottom: 8 }}>{t('settings.switchTo')}</p>
          <Select
            value={selectedRole}
            onChange={setSelectedRole}
            style={{ width: '100%' }}
          >
            <Select.Option value="USER">
              <Tag color="blue">{t('settings.roleUser')}</Tag> {t('settings.roleUserDesc')}
            </Select.Option>
            <Select.Option value="DEPT_ADMIN">
              <Tag color="orange">{t('settings.roleDeptAdmin')}</Tag> {t('settings.roleDeptAdminDesc')}
            </Select.Option>
            <Select.Option value="SUPER_ADMIN">
              <Tag color="red">{t('settings.roleSuperAdmin')}</Tag> {t('settings.roleSuperAdminDesc')}
            </Select.Option>
          </Select>
          <p style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
            {t('settings.switchRoleTip')}
          </p>
        </div>
      </Modal>
    </>
  );
};

export default HeaderComponent;
