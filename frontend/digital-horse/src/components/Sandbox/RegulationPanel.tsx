/**
 * RegulationPanel —— 法规引用可视化面板
 *
 * 用途：沙箱检测命中某条规则后，点击展开查看关联法规详情
 *
 * 特点：
 *   - 显示法规全称 / 颁布机构 / 生效年份 / 条款号
 *   - 显示条款全文（脱敏到 200 字内）
 *   - 显示处罚标准
 *   - 真实可查（非杜撰）
 */

import React, { useState } from 'react';
import { Collapse, Tag, Typography, Space, Empty } from 'antd';
import { BankOutlined, FileTextOutlined, AuditOutlined, CalendarOutlined } from '@ant-design/icons';
import type { Regulation } from '@/services/sandbox/regulationRef';
import { REGULATIONS } from '@/services/sandbox/regulationRef';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

interface RegulationPanelProps {
  /** 要展示的法规 ID 列表 */
  regulationIds: string[];
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 标题前缀 */
  title?: string;
}

export const RegulationPanel: React.FC<RegulationPanelProps> = ({
  regulationIds,
  defaultExpanded = false,
  title = '关联法规',
}) => {
  const [activeKeys, setActiveKeys] = useState<string[]>(
    defaultExpanded ? regulationIds : []
  );

  if (!regulationIds || regulationIds.length === 0) {
    return <Empty description="本次检测未命中具体法规条款" />;
  }

  const regs: Regulation[] = regulationIds
    .map((id) => REGULATIONS.find((r) => r.id === id))
    .filter(Boolean) as Regulation[];

  return (
    <Collapse
      ghost
      activeKey={activeKeys}
      onChange={(keys) => setActiveKeys(keys as string[])}
      items={regs.map((r) => ({
        key: r.id,
        label: (
          <Space>
            <Tag color="red">{r.shortName}</Tag>
            <Text strong>{r.article}</Text>
            <Tag color="default">{r.year}</Tag>
          </Space>
        ),
        children: (
          <div style={{ paddingLeft: 8 }}>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>全称</Text>
                <div>
                  <FileTextOutlined style={{ marginRight: 6, color: '#0F2B5B' }} />
                  <Text>{r.fullName}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>颁布机构</Text>
                <div>
                  <BankOutlined style={{ marginRight: 6, color: '#0F2B5B' }} />
                  <Text>{r.issuer}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>生效年份</Text>
                <div>
                  <CalendarOutlined style={{ marginRight: 6, color: '#0F2B5B' }} />
                  <Text>{r.year}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>条款全文</Text>
                <Paragraph
                  style={{
                    background: 'rgba(214,64,69,0.06)',
                    borderLeft: '3px solid #D64045',
                    padding: '8px 12px',
                    borderRadius: 4,
                    marginBottom: 0,
                    fontSize: 13,
                  }}
                >
                  {r.articleText}
                </Paragraph>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>处罚标准</Text>
                <div>
                  <AuditOutlined style={{ marginRight: 6, color: '#D64045' }} />
                  <Text strong style={{ color: '#D64045' }}>{r.penalty}</Text>
                </div>
              </div>
            </Space>
          </div>
        ),
      }))}
    />
  );
};

export default RegulationPanel;
