import React, { useState } from 'react';
import { Avatar, Space, Input, Badge, Tag, Typography, Tooltip } from 'antd';
import {
  UserOutlined,
  SearchOutlined,
  BellOutlined,
  RobotOutlined,
  GlobalOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/i18n';
import { useUserStore } from '@/store';
import Logo from './Logo';
import ProfileDrawer from './ProfileDrawer';

const { Text } = Typography;

interface TopbarProps {
  onAgentPanelClick?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onAgentPanelClick }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useUserStore();
  const currentLang = getCurrentLanguage();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLanguageChange = (lang: 'zh-CN' | 'en-US') => {
    changeLanguage(lang);
  };

  const quickTags = [
    { key: 'regulation', label: t('topbar.tagRegulation'), icon: <FileTextOutlined /> },
    { key: 'document', label: t('topbar.tagDocument'), icon: <FileTextOutlined /> },
    { key: 'history', label: t('topbar.tagHistory'), icon: <HistoryOutlined /> },
  ];

  return (
    <div
      style={{
        height: 56,
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E8EDF4',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* 左侧 Logo 区域：白底 Logo + 品牌文字 */}
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 280 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Logo size={36} />
        </div>
        <div>
          <Text strong style={{ fontSize: 16, color: '#0F2B5B', whiteSpace: 'nowrap' }}>
            {currentLang === 'en-US' ? 'Apexis' : '睿枢'}
          </Text>
        </div>
      </div>

      {/* 中间搜索区域 */}
      <div style={{ flex: 1, maxWidth: 560, margin: '0 40px' }}>
        <div style={{ position: 'relative' }}>
          <Input
            placeholder={t('topbar.searchPlaceholder')}
            prefix={<SearchOutlined style={{ color: '#8A94A6' }} />}
            suffix={
              <Tooltip title={t('topbar.aiSearchTip')}>
                <RobotOutlined style={{ color: '#0F2B5B', cursor: 'pointer', fontSize: 16 }} />
              </Tooltip>
            }
            style={{ borderRadius: 6, background: '#F7F9FC' }}
          />
        </div>
        {/* 快捷标签 */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
          {quickTags.map((tag) => (
            <div
              key={tag.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: '#fff',
                cursor: 'pointer',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(15, 43, 91, 0.6)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(15, 43, 91, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(15, 43, 91, 0.6)';
              }}
            >
              {tag.icon}
              <span>{tag.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧功能区 */}
      <Space size={20}>
        {/* 消息通知 */}
        <Tooltip title={t('topbar.notifications')}>
          <Badge count={3} size="small">
            <div
              onClick={() => navigate('/notifications')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate('/notifications');
                }
              }}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                background: '#F7F9FC',
                cursor: 'pointer',
              }}
            >
              <BellOutlined style={{ fontSize: 18, color: '#4E5969' }} />
            </div>
          </Badge>
        </Tooltip>

        {/* 系统状态 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <Tag color="success" style={{ fontSize: 11, margin: 0, lineHeight: 1.2 }}>
            {t('topbar.dingtalkConnected')}
          </Tag>
          <Tag color="processing" style={{ fontSize: 11, margin: 0, lineHeight: 1.2 }}>
            {t('topbar.modelOnline')}
          </Tag>
        </div>

        {/* 国际化 */}
        <Tooltip title={t('topbar.switchLanguage')}>
          <GlobalOutlined
            style={{ fontSize: 18, cursor: 'pointer', color: '#4E5969' }}
            onClick={() => handleLanguageChange(currentLang === 'zh-CN' ? 'en-US' : 'zh-CN')}
          />
        </Tooltip>

        {/* 用户头像 - 点击打开个人中心 Drawer */}
        <div
          onClick={() => setProfileOpen(true)}
          style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
        >
          <Space>
            <Avatar style={{ backgroundColor: '#0F2B5B' }} size={32}>
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
            <div style={{ textAlign: 'left' }}>
              <Text style={{ fontSize: 13, display: 'block', color: '#1D2129' }}>
                {user?.name || t('header.profile')}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {user?.department || t('topbar.department')}
              </Text>
            </div>
          </Space>
        </div>
      </Space>

      {/* 个人中心浮窗 */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default Topbar;
