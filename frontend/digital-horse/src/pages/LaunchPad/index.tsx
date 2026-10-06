import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Typography, Space, Badge } from 'antd';
import {
  CalendarOutlined,
  MessageOutlined,
  FileTextOutlined,
  BulbOutlined,
  TeamOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  SettingOutlined,
  BellOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

interface LaunchItem {
  key: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  description: string;
}

const LaunchPad: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const launchItems: LaunchItem[] = [
    {
      key: 'dashboard',
      title: t('nav.workspace'),
      icon: <DashboardOutlined />,
      color: '#1890ff',
      path: '/dashboard',
      description: t('menu.dashboardDesc') || '工作台概览',
    },
    {
      key: 'meeting',
      title: t('nav.meeting'),
      icon: <CalendarOutlined />,
      color: '#52c41a',
      path: '/meeting',
      description: t('menu.meetingDesc') || '会议日程管理',
    },
    {
      key: 'knowledge',
      title: t('nav.knowledge'),
      icon: <FileTextOutlined />,
      color: '#fa8c16',
      path: '/knowledge',
      description: t('menu.knowledgeDesc') || '知识文档中心',
    },
    {
      key: 'industry-news',
      title: t('nav.industryNews'),
      icon: <BulbOutlined />,
      color: '#eb2f96',
      path: '/industry-news',
      description: '行业资讯中心',
    },
    {
      key: 'profile',
      title: t('common.profile'),
      icon: <SettingOutlined />,
      color: '#8c8c8c',
      path: '/profile',
      description: t('menu.profileDesc') || '个人设置',
    },
  ];

  const handleItemClick = (path: string) => {
    navigate(path);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#667eea',
        padding: 48,
        zIndex: 9999,
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>
            {t('common.appName')}
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            {t('menu.launchpad')}
          </Text>
        </div>

        <Row gutter={[24, 24]}>
          {launchItems.map((item) => (
            <Col key={item.key} xs={12} sm={8} md={6}>
              <Card
                hoverable
                onClick={() => handleItemClick(item.path)}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
                styles={{
                  body: {
                    padding: '32px 24px',
                  }
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: `${item.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <span style={{ fontSize: 32, color: item.color }}>
                    {item.icon}
                  </span>
                </div>
                <Title level={5} style={{ marginBottom: 8 }}>
                  {item.title}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.description}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)' }}>
            {t('app.shortcutTip')}
          </Text>
        </div>
      </div>
    </div>
  );
};

export default LaunchPad;
