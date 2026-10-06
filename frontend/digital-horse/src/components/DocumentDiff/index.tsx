/**
 * 政策/文档版本对比组件
 *
 * 展示：AI 自动生成的变更摘要 + 完整条款 diff（逐行高亮）
 *
 * 使用场景：
 *   - Knowledge 页面：政策法规文档点击"对比历史"后弹出
 *   - 知识库文档：版本更新时展示变更内容
 */

import React, { useState } from 'react';
import {
  Modal,
  Typography,
  Tag,
  Tabs,
  Button,
  Space,
  Collapse,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { PolicyDocument, DiffLine } from '@/mock/policyDocuments';
import { computePolicyDiff } from '@/mock/policyDocuments';
import './index.css';

const { Text, Paragraph, Title } = Typography;

interface DocumentDiffProps {
  /** 对比弹窗是否显示 */
  open: boolean;
  /** 关闭弹窗 */
  onClose: () => void;
  /** 当前文档 */
  document: PolicyDocument | null;
  /** 对比的基准版本索引（默认最新 vs 上一版，即 versions[0] vs versions[1]） */
  compareIndex?: number;
}

const DocumentDiff: React.FC<DocumentDiffProps> = ({
  open,
  onClose,
  document,
  compareIndex = 1,
}) => {
  const [activeTab, setActiveTab] = useState('summary');

  if (!document || document.versions.length < 2) {
    return null;
  }

  const currentVersion = document.versions[0];
  const prevVersion = document.versions[compareIndex];
  const diffLines = computePolicyDiff(prevVersion.content, currentVersion.content);
  const { added, modified, removed } = document.diffSummary;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      style={{ width: 960, maxWidth: 'calc(100vw - 32px)' }}
      footer={null}
      title={
        <Space>
          <FileTextOutlined style={{ color: 'var(--color-primary)' }} />
          <Text strong>版本对比</Text>
          <Tag color="blue">{currentVersion.version}</Tag>
          <ArrowRightOutlined style={{ color: '#999' }} />
          <Tag color="default">{prevVersion.version}</Tag>
        </Space>
      }
      className="document-diff-modal"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'summary',
            label: (
              <Space>
                <ThunderboltOutlined />
                AI 变更摘要
                <Tag color="blue" style={{ fontSize: 11 }}>
                  {added.length + modified.length + removed.length} 项变更
                </Tag>
              </Space>
            ),
            children: (
              <div className="diff-summary">
                {/* 版本元信息 */}
                <div className="diff-version-meta">
                  <div className="diff-version-card diff-current">
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      当前版本
                    </Text>
                    <Text strong style={{ fontSize: 14 }}>
                      {currentVersion.version}
                    </Text>
                    <Space size={4}>
                      <CalendarOutlined style={{ fontSize: 11, color: '#999' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        发布：{currentVersion.issuedDate} | 生效：{currentVersion.effectiveDate}
                      </Text>
                    </Space>
                    <Paragraph
                      type="secondary"
                      style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}
                    >
                      {currentVersion.summary}
                    </Paragraph>
                  </div>
                  <div className="diff-version-arrow">
                    <ArrowRightOutlined style={{ fontSize: 20, color: '#999' }} />
                  </div>
                  <div className="diff-version-card diff-prev">
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      历史版本
                    </Text>
                    <Text strong style={{ fontSize: 14 }}>
                      {prevVersion.version}
                    </Text>
                    <Space size={4}>
                      <CalendarOutlined style={{ fontSize: 11, color: '#999' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        发布：{prevVersion.issuedDate} | 生效：{prevVersion.effectiveDate}
                      </Text>
                    </Space>
                    <Paragraph
                      type="secondary"
                      style={{ fontSize: 12, marginBottom: 0, marginTop: 8 }}
                    >
                      {prevVersion.summary}
                    </Paragraph>
                  </div>
                </div>

                {/* 变更统计 */}
                <div className="diff-stats">
                  {added.length > 0 && (
                    <Tag color="success" className="diff-stat-tag">
                      <PlusOutlined /> 新增 {added.length} 项
                    </Tag>
                  )}
                  {modified.length > 0 && (
                    <Tag color="warning" className="diff-stat-tag">
                      <EditOutlined /> 修订 {modified.length} 项
                    </Tag>
                  )}
                  {removed.length > 0 && (
                    <Tag color="error" className="diff-stat-tag">
                      <MinusOutlined /> 删除 {removed.length} 项
                    </Tag>
                  )}
                </div>

                {/* 变更详情折叠面板 */}
                <div className="diff-change-list">
                  {added.length > 0 && (
                    <Collapse
                      ghost
                      defaultActiveKey={['added']}
                      items={[
                        {
                          key: 'added',
                          label: (
                            <Space>
                              <PlusOutlined style={{ color: '#52c41a' }} />
                              <Text strong style={{ color: '#52c41a' }}>
                                新增条款
                              </Text>
                              <Tag color="success">{added.length}</Tag>
                            </Space>
                          ),
                          children: (
                            <ul className="diff-item-list">
                              {added.map((item, i) => (
                                <li key={i} className="diff-item diff-item-added">
                                  <PlusOutlined style={{ color: '#52c41a', fontSize: 12, flexShrink: 0, marginTop: 3 }} />
                                  <Text>{item}</Text>
                                </li>
                              ))}
                            </ul>
                          ),
                        },
                      ]}
                    />
                  )}
                  {modified.length > 0 && (
                    <Collapse
                      ghost
                      defaultActiveKey={['modified']}
                      items={[
                        {
                          key: 'modified',
                          label: (
                            <Space>
                              <EditOutlined style={{ color: '#faad14' }} />
                              <Text strong style={{ color: '#faad14' }}>
                                修订条款
                              </Text>
                              <Tag color="warning">{modified.length}</Tag>
                            </Space>
                          ),
                          children: (
                            <ul className="diff-item-list">
                              {modified.map((item, i) => (
                                <li key={i} className="diff-item diff-item-modified">
                                  <EditOutlined style={{ color: '#faad14', fontSize: 12, flexShrink: 0, marginTop: 3 }} />
                                  <Text>{item}</Text>
                                </li>
                              ))}
                            </ul>
                          ),
                        },
                      ]}
                    />
                  )}
                  {removed.length > 0 && (
                    <Collapse
                      ghost
                      defaultActiveKey={removed.length > 0 ? ['removed'] : []}
                      items={[
                        {
                          key: 'removed',
                          label: (
                            <Space>
                              <MinusOutlined style={{ color: '#f5222d' }} />
                              <Text strong style={{ color: '#f5222d' }}>
                                删除条款
                              </Text>
                              <Tag color="error">{removed.length}</Tag>
                            </Space>
                          ),
                          children: (
                            <ul className="diff-item-list">
                              {removed.map((item, i) => (
                                <li key={i} className="diff-item diff-item-removed">
                                  <MinusOutlined style={{ color: '#f5222d', fontSize: 12, flexShrink: 0, marginTop: 3 }} />
                                  <Text delete type="secondary">
                                    {item}
                                  </Text>
                                </li>
                              ))}
                            </ul>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'detail',
            label: (
              <Space>
                <FileTextOutlined />
                完整条款对比
              </Space>
            ),
            children: (
              <div className="diff-detail">
                <div className="diff-header">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {prevVersion.version}（旧版）← →
                    {currentVersion.version}（新版）
                  </Text>
                </div>
                <div className="diff-lines">
                  {diffLines.map((line, i) => (
                    <DiffLineRow key={i} line={line} />
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

/** 单独一行 diff */
const DiffLineRow: React.FC<{ line: DiffLine }> = ({ line }) => {
  const classMap: Record<string, string> = {
    added: 'diff-line diff-line-added',
    removed: 'diff-line diff-line-removed',
    unchanged: 'diff-line diff-line-unchanged',
  };

  const prefixMap: Record<string, React.ReactNode> = {
    added: <PlusOutlined style={{ color: '#52c41a', fontSize: 12 }} />,
    removed: <MinusOutlined style={{ color: '#f5222d', fontSize: 12 }} />,
    unchanged: null,
  };

  return (
    <div className={classMap[line.type]}>
      <span className="diff-line-prefix">{prefixMap[line.type]}</span>
      <span className="diff-line-content">{line.content || '\u00A0'}</span>
    </div>
  );
};

export default DocumentDiff;
