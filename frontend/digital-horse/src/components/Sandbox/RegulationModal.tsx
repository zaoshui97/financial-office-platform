/**
 * RegulationModal —— 法规详情弹窗
 *
 * 展示：法规全文 + 处罚标准 + 关联违规场景
 * 评委可点击"查看法规全文"看到完整的法规条款
 */

import React from 'react';
import { Modal, Typography, Tag, Space, Divider, Alert } from 'antd';
import { BookOutlined, WarningOutlined, DollarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { Regulation } from '@/services/sandbox/regulationRef';

const { Title, Text, Paragraph } = Typography;

interface RegulationModalProps {
  regulation: Regulation | null;
  open: boolean;
  onClose: () => void;
}

export const RegulationModal: React.FC<RegulationModalProps> = ({
  regulation,
  open,
  onClose,
}) => {
  if (!regulation) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <BookOutlined style={{ color: '#0F2B5B' }} />
          <span>{regulation.shortName}</span>
          <Tag color="blue">{regulation.year}年</Tag>
        </Space>
      }
      style={{ width: 680, maxWidth: 'calc(100vw - 32px)' }}
      footer={null}
    >
      {/* 法规基本信息 */}
      <div
        style={{
          background: '#0F2B5B',
          color: '#fff',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
          {regulation.fullName}
        </Text>
        <div style={{ marginTop: 8 }}>
          <Space size={12} wrap>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              条款：{regulation.article}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
              发布：{regulation.issuer}
            </Text>
          </Space>
        </div>
      </div>

      {/* 条款全文 */}
      <Title level={5}>
        <InfoCircleOutlined style={{ color: '#0F2B5B', marginRight: 8 }} />
        {'条款全文'}
      </Title>
      <Paragraph
        style={{
          background: '#F9FAFB',
          padding: 12,
          borderRadius: 6,
          border: '1px solid #E5E7EB',
          fontSize: 13,
          lineHeight: 1.8,
        }}
      >
        {regulation.articleText}
      </Paragraph>

      {/* 处罚标准 */}
      <Divider style={{ margin: '16px 0' }} />
      <Title level={5}>
        <DollarOutlined style={{ color: '#D64045', marginRight: 8 }} />
        {'处罚标准'}
      </Title>
      <Alert
        type="error"
        showIcon
        icon={<WarningOutlined />}
        message={
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {'违规后果'}
            </Text>
            <Text style={{ fontSize: 13 }}>{regulation.penalty}</Text>
          </div>
        }
        style={{ background: '#FEF2F2', borderColor: '#FCA5A5' }}
      />

      {/* 合规提示 */}
      <Alert
        type="info"
        showIcon
        message={
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>
              {'合规建议'}
            </Text>
            <Text style={{ fontSize: 13 }}>
              {'在涉及该法规的文档发布前，请务必通过合规沙箱检查。'}
            </Text>
          </div>
        }
        style={{ marginTop: 12 }}
      />
    </Modal>
  );
};

export default RegulationModal;
