/**
 * AI 辅助审批报告卡
 * - 4 维度评分（合规 / 要素 / 异常 / 制度）
 * - 总体评分 + AI 建议
 * - 红色 flag 一目了然
 */
import React from 'react';
import { Card, Row, Col, Tag, Tooltip, Progress, Space, Typography, Divider } from 'antd';
import { RobotOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined,
  FileSearchOutlined, FileProtectOutlined } from '@ant-design/icons';
import {
  type AIReviewReport, SUGGESTION_META, RISK_COLOR,
  DIMENSION_META, type Suggestion, type RiskLevel,
} from '@/api/aiReview';

const { Text, Paragraph } = Typography;

interface Props {
  report: AIReviewReport | null | undefined;
  loading?: boolean;
}

const riskIcon = (level?: RiskLevel) => {
  if (level === 'high') return <CloseCircleOutlined style={{ color: RISK_COLOR.high }} />;
  if (level === 'medium') return <ExclamationCircleOutlined style={{ color: RISK_COLOR.medium }} />;
  return <CheckCircleOutlined style={{ color: RISK_COLOR.low }} />;
};

const scoreColor = (score: number) => {
  if (score >= 85) return '#22A775';
  if (score >= 60) return '#fa8c16';
  return '#f5222d';
};

const DimensionCard: React.FC<{
  name: keyof AIReviewReport['dimensions'];
  dim: any;
}> = ({ name, dim }) => {
  const meta = DIMENSION_META[name];
  const score = dim?.score ?? 0;
  const color = scoreColor(score);
  return (
    <div style={{
      border: '1px solid #E8EDF4',
      borderRadius: 8,
      padding: 12,
      background: '#FAFBFD',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Space size={4}>
          <Text strong style={{ fontSize: 13 }}>{meta.label}</Text>
          {dim?.risk_level && riskIcon(dim.risk_level)}
        </Space>
        <Text style={{ color, fontWeight: 600, fontSize: 16 }}>{score}</Text>
      </div>
      <Progress
        percent={score} showInfo={false} strokeColor={color} size="small"
        style={{ margin: '4px 0 6px 0' }}
      />
      <Text type="secondary" style={{ fontSize: 11 }}>{meta.desc}</Text>
      <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
        {dim?.summary || '—'}
      </div>

      {/* 命中 hits（合规） */}
      {dim?.hits && dim.hits.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {dim.hits.slice(0, 2).map((h: any, i: number) => (
            <Tag color="red" key={i} style={{ marginBottom: 2 }}>
              {h.reason?.slice(0, 24) || h.category}
            </Tag>
          ))}
        </div>
      )}
      {/* 缺失要素 */}
      {dim?.missing_fields && dim.missing_fields.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {dim.missing_fields.slice(0, 2).map((f: string, i: number) => (
            <Tag color="orange" key={i} style={{ marginBottom: 2 }}>{f}</Tag>
          ))}
        </div>
      )}
      {/* 异常 flags */}
      {dim?.flags && dim.flags.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {dim.flags.slice(0, 3).map((f: any, i: number) => (
            <div key={i} style={{
              fontSize: 11, color: f.level === 'red' ? '#f5222d' : '#fa8c16',
              background: f.level === 'red' ? '#fff1f0' : '#fff7e6',
              padding: '2px 6px', borderRadius: 4, marginBottom: 2,
            }}>
              {f.level === 'red' ? '🚫' : '⚠️'} {f.message}
            </div>
          ))}
        </div>
      )}
      {/* 制度匹配 */}
      {dim?.matches && dim.matches.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {dim.matches.slice(0, 2).map((m: any, i: number) => (
            <div key={i} style={{ fontSize: 11, color: '#0F2B5B' }}>
              📋 {m.doc_title} {m.clause}
              <span style={{ color: '#999', marginLeft: 4 }}>
                sim={m.similarity} {m.verdict === 'support' ? '✓' : '·'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AIReviewCard: React.FC<Props> = ({ report }) => {
  if (!report) {
    return (
      <Card size="small" style={{ background: '#F7F9FC' }}>
        <Space>
          <RobotOutlined style={{ color: '#999' }} />
          <Text type="secondary">该工单尚未生成 AI 审查报告</Text>
        </Space>
      </Card>
    );
  }
  const o = report.overall;
  const sug = o.suggestion as Suggestion;
  const meta = SUGGESTION_META[sug];
  return (
    <Card
      size="small"
      title={
        <Space>
          <RobotOutlined style={{ color: '#0F2B5B' }} />
          <span>AI 辅助审查报告</span>
          <Tag color={meta.color}>{meta.icon} {meta.text}</Tag>
          {o.auto_pass_eligible && (
            <Tooltip title="同时满足低风险类型 + 小额 + 无异常 + 制度高匹配度">
              <Tag color="purple">可自动通过候选</Tag>
            </Tooltip>
          )}
        </Space>
      }
      extra={
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 11 }}>v{report.model_version}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{report.latency_ms}ms</Text>
        </Space>
      }
      style={{ borderColor: meta.color, borderWidth: 1.5 }}
    >
      {/* 总览 */}
      <div style={{
        background: `linear-gradient(90deg, ${meta.color}15 0%, transparent 100%)`,
        padding: 12, borderRadius: 6, marginBottom: 12,
      }}>
        <Row gutter={16} align="middle">
          <Col>
            <div style={{
              fontSize: 36, fontWeight: 700, color: meta.color, lineHeight: 1,
            }}>{o.score.toFixed(0)}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>综合评分</Text>
          </Col>
          <Col flex="auto">
            <Paragraph style={{ margin: 0, fontSize: 13 }}>
              {o.summary}
            </Paragraph>
            <Space size={4} style={{ marginTop: 4 }}>
              <Tag color={RISK_COLOR[o.risk_level]}>风险：{o.risk_level}</Tag>
              <Tag>置信度 {(o.confidence * 100).toFixed(0)}%</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {new Date(report.reviewed_at).toLocaleString('zh-CN')}
              </Text>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 4 维度 */}
      <Row gutter={[8, 8]}>
        <Col xs={12} sm={12} md={6}>
          <DimensionCard name="compliance" dim={report.dimensions.compliance} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <DimensionCard name="completeness" dim={report.dimensions.completeness} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <DimensionCard name="anomaly" dim={report.dimensions.anomaly} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <DimensionCard name="policy" dim={report.dimensions.policy} />
        </Col>
      </Row>

      <Divider style={{ margin: '12px 0 8px' }} />
      <Text type="secondary" style={{ fontSize: 11 }}>
        💡 {report.explainability} ·
        AI 仅提供参考，<Text strong>最终决策由审批人做出</Text>。
        覆盖 AI 建议时请填写原因，便于合规审计。
      </Text>
    </Card>
  );
};

export default AIReviewCard;
