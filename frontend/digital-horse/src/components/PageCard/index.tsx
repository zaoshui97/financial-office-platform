import React from 'react';
import { Card, Space, Typography, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface PageCardProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  subtitle?: string;
  extra?: React.ReactNode;
  onAction?: () => void;
  actionText?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const PageCard: React.FC<PageCardProps> = ({
  title,
  icon,
  subtitle,
  extra,
  onAction,
  actionText,
  children,
  style,
}) => {
  return (
    <Card
      title={
        <Space>
          {icon}
          <Title level={4} style={{ margin: 0 }}>{title}</Title>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
              {subtitle}
            </Typography.Text>
          )}
        </Space>
      }
      extra={
        <Space>
          {extra}
          {onAction && actionText && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
              {actionText}
            </Button>
          )}
        </Space>
      }
      styles={{ body: { padding: 0 } }}
      style={style}
    >
      {children}
    </Card>
  );
};

export default PageCard;
