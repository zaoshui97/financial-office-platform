/**
 * 简洁布局：无侧边栏，有顶栏，视觉与主站一致
 * 用于全屏独立页面（如个人中心）
 */
import React from 'react';
import { Layout, Button, Space, Dropdown, Avatar, Tag, Tooltip, Modal, Select, message } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n';
import { useUserStore } from '@/store';
import { ROLE_LABELS, type Role } from '@/types/permission';

const { Header, Content } = Layout;

interface SimpleLayoutProps {
  /** 页面标题（显示在左侧返回按钮旁） */
  title: string;
  children: React.ReactNode;
}

const SimpleLayout: React.FC<SimpleLayoutProps> = ({ title, children }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, logout, setUser, setRole } = useUserStore();
  const [roleModalVisible, setRoleModalVisible] = React.useState(false);
  const [selectedRole, setSelectedRole] = React.useState<Role>(user?.role || 'USER');

  const isZh = i18n.language === 'zh-CN';

  const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
    changeLanguage(lang);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('header.profile'),
      onClick: () => navigate('/profile'),
    },
    {
      key: 'role-switch',
      icon: <SwapOutlined />,
      label: t('settings.switchRole'),
      onClick: handleRoleSwitch,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('header.logout'),
      danger: true,
      onClick: handleLogout,
    },
  ];

  const languageMenuItems = [
    { key: 'zh-CN', label: t('common.chinese'), onClick: () => handleLanguageChange('zh-CN') },
    { key: 'en-US', label: t('common.english'), onClick: () => handleLanguageChange('en-US') },
  ];

  const getRoleColor = (role: Role | undefined) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'red';
      case 'DEPT_ADMIN': return 'orange';
      default: return 'blue';
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#F7F9FC' }}>
      {/* 顶栏：返回 + 标题 + 右侧用户操作 */}
      <Header
        style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {/* 左侧：返回 + 页面标题 */}
        <Space size="middle">
          <Tooltip title={t('meeting.goBack')}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              style={{ color: '#666' }}
            />
          </Tooltip>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>
            {title}
          </span>
        </Space>

        {/* 右侧操作区 */}
        <Space size="middle" style={{ flexShrink: 0 }}>
          {user?.role && (
            <Tag color={getRoleColor(user.role)} icon={<SafetyCertificateOutlined />}>
              {ROLE_LABELS[user.role]}
            </Tag>
          )}

          <Dropdown menu={{ items: languageMenuItems }} placement="bottomRight">
            <Button type="text" icon={<GlobalOutlined />}>
              {isZh ? t('common.chinese') : t('common.english')}
            </Button>
          </Dropdown>

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer', padding: '4px 8px' }}>
              <Avatar icon={<UserOutlined />} src={user?.avatar} size="small" />
              <span style={{ color: '#333' }}>
                {user?.name || user?.username || t('common.defaultUser')}
              </span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      {/* 内容区 */}
      <Content
        style={{
          margin: 12,
          padding: 0,
          background: '#F7F9FC',
        }}
      >
        {children}
      </Content>

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
    </Layout>
  );
};

export default SimpleLayout;
