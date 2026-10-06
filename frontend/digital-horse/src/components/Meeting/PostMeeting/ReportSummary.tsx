/**
 * ReportSummary — 5 段结构化报告渲染
 * 纯展示组件，所有数据从 props 传入
 *
 * 演示打磨：
 *   - 每个 section 加渐变色块顶边，一眼区分决策/待办/风险/议题
 *   - 决策 = 绿色、待办 = 蓝色、风险 = 红色、议题 = 紫色、摘要 = 灰色
 */

import React from 'react';
import { Card, Empty, Tag, Space, Typography, Divider, Badge } from 'antd';
import {
  BulbOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ProfileOutlined,
  TagsOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { GetReportResponse } from '@/services/meetingApiContract';
import { EmptyStateHint } from './EmptyStateHint';

const { Text, Title } = Typography;

// 色块配置
const SECTION_COLORS = {
  summary: { color: '#0F2B5B', bg: '#0F2B5B', light: '#EFF6FF' },
  decisions: { color: '#10B981', bg: '#059669', light: '#ECFDF5' },
  actions: { color: '#3B82F6', bg: '#2563EB', light: '#EFF6FF' },
  risks: { color: '#EF4444', bg: '#DC2626', light: '#FEF2F2' },
  topics: { color: '#6366F1', bg: '#4F46E5', light: '#EEF2FF' },
} as const;

// 优先级颜色映射
const PRIORITY_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: '高优',
  medium: '中优',
  low: '低优',
};

export interface ReportSummaryProps {
  report: GetReportResponse['data'];
}

export const ReportSummary: React.FC<ReportSummaryProps> = ({ report }) => {
  const { t } = useTranslation();

  // Section 顶边色块
  const SectionHeader: React.FC<{
    icon: React.ReactNode;
    label: string;
    count: number;
    type: keyof typeof SECTION_COLORS;
  }> = ({ icon, label, count, type }) => {
    const cfg = SECTION_COLORS[type];
    return (
      <div
        style={{
          background: cfg.bg,
          color: '#fff',
          padding: '6px 12px',
          borderRadius: '6px 6px 0 0',
          marginBottom: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {icon}
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {label}
          {count > 0 && ` (${count})`}
        </span>
      </div>
    );
  };

  return (
    <div className="report-summary">
      {/* 摘要 */}
      <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        <SectionHeader
          icon={<ProfileOutlined />}
          label={'会议摘要'}
          count={0}
          type="summary"
        />
        <Card size="small" style={{ borderRadius: '0 0 6px 6px' }}>
          {report.summary ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: 13, color: 'var(--color-text-body)' }}>
              {report.summary}
            </pre>
          ) : (
            <EmptyStateHint type="no-data" />
          )}
        </Card>
      </div>

      {/* 关键决策 */}
      <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
        <SectionHeader
          icon={<CheckCircleOutlined />}
          label={'关键决策'}
          count={report.sections.decisions.length}
          type="decisions"
        />
        <Card size="small" style={{ borderRadius: '0 0 6px 6px' }}>
          {report.sections.decisions.length === 0 ? (
            <EmptyStateHint type="no-decisions" />
          ) : (
            report.sections.decisions.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 0',
                  borderBottom: i < report.sections.decisions.length - 1 ? '1px dashed #E5E7EB' : 'none',
                }}
              >
                <Space size={6} wrap>
                  <Tag color="green" style={{ borderRadius: 4, fontWeight: 600 }}>
                    {i + 1}.
                  </Tag>
                  <Text strong>{d.topic}</Text>
                  <Tag color="blue" style={{ borderRadius: 4 }}>
                    {(d.confidence * 100).toFixed(0)}%
                  </Tag>
                </Space>
                <div style={{ marginLeft: 32, marginTop: 4, color: '#374151', fontSize: 13 }}>
                  {d.decision}
                </div>
                <div style={{ marginLeft: 32, marginTop: 2, fontSize: 12, color: '#9CA3AF' }}>
                  {'负责人'}: {d.owner || '—'}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* 风险信号 */}
      {report.sections.risks.length > 0 && (
        <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          <SectionHeader
            icon={<WarningOutlined />}
            label={'风险信号'}
            count={report.sections.risks.length}
            type="risks"
          />
          <Card size="small" style={{ borderRadius: '0 0 6px 6px', background: '#FEF2F2' }}>
            {report.sections.risks.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 0',
                  color: '#B91C1C',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <WarningOutlined style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{r}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* 议题 */}
      {report.sections.topics.length > 0 && (
        <div style={{ borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
          <SectionHeader
            icon={<TagsOutlined />}
            label={'议题'}
            count={report.sections.topics.length}
            type="topics"
          />
          <Card size="small" style={{ borderRadius: '0 0 6px 6px' }}>
            <Space size={6} wrap>
              {report.sections.topics.map((topic, i) => (
                <Tag
                  key={i}
                  color="blue"
                  style={{ borderRadius: 4, fontSize: 12 }}
                >
                {topic}
                </Tag>
              ))}
            </Space>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportSummary;
