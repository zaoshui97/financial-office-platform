import React, { useState } from 'react';
import { Card, Typography, Button, Space, Tag, Rate, Progress, Divider, message, Tooltip, Spin } from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { checkCompliance } from '@/api/ai';
import './index.css';

const { Title, Text, Paragraph } = Typography;

interface ComplianceCheckerProps {
  content: string;
  title?: string;
  onClose?: () => void;
}

interface ComplianceResult {
  score: number;
  issues: string[];
  suggestions: string[];
}

const ComplianceChecker: React.FC<ComplianceCheckerProps> = ({
  content,
  title = '合规检查',
}) => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);

  const handleCheck = async () => {
    if (!content.trim()) {
      message.warning('请输入需要检查的内容');
      return;
    }

    setChecking(true);
    try {
      const res = await checkCompliance(content);
      setResult(res);
      message.success(t('compliance.checkComplete') || '检查完成');
    } catch (error) {
      message.error('检查失败，请重试');
    } finally {
      setChecking(false);
    }
  };

  const getScoreConfig = (score: number) => {
    if (score >= 4) {
      return {
        color: '#22A775',
        icon: <CheckCircleOutlined />,
        text: t('compliance.passed'),
        status: 'success' as const,
      };
    } else if (score >= 3) {
      return {
        color: '#E69948',
        icon: <WarningOutlined />,
        text: t('compliance.warning'),
        status: 'exception' as const,
      };
    } else {
      return {
        color: '#D64045',
        icon: <CloseCircleOutlined />,
        text: t('compliance.failed'),
        status: 'exception' as const,
      };
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 5) return '优秀';
    if (score >= 4) return '良好';
    if (score >= 3) return '一般';
    if (score >= 2) return '较差';
    return '不合格';
  };

  return (
    <Card className="compliance-checker">
      <div className="compliance-header">
        <Space>
          <SafetyCertificateOutlined style={{ fontSize: 24, color: '#0F2B5B' }} />
          <Title level={4} style={{ margin: 0 }}>{t('compliance.title')}</Title>
        </Space>
        <Tag color="gold">{t('compliance.financial')}</Tag>
      </div>

      {!result ? (
        <div className="compliance-check-section">
          <Paragraph type="secondary">
            {t('compliance.description') || '系统将自动检测文档中的合规风险，包括敏感词、违规表述、法规引用等。'}
          </Paragraph>

          <div className="compliance-check-content">
            <div className="compliance-content-preview">
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('compliance.contentPreview') || '内容预览'}：
              </Text>
              <div className="compliance-content-text">
                {content.slice(0, 200)}
                {content.length > 200 && '...'}
              </div>
            </div>

            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleCheck}
              loading={checking}
              size="large"
              block
            >
              {checking ? t('compliance.checking') : t('compliance.startCheck')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="compliance-result-section">
          {/* 评分区域 */}
          <div className="compliance-score-card">
            <div className="score-header">
              <Text strong>{t('compliance.score')}</Text>
              <Tag color={getScoreConfig(result.score).color}>
                {getScoreConfig(result.score).icon} {getScoreConfig(result.score).text}
              </Tag>
            </div>
            <div className="score-display">
              <div className="score-number">
                <span className="score-value">{result.score}</span>
                <span className="score-max">/5</span>
              </div>
              <Rate disabled value={result.score} allowHalf />
              <Text type="secondary">{getScoreLabel(result.score)}</Text>
            </div>
            <Progress
              percent={(result.score / 5) * 100}
              status={getScoreConfig(result.score).status}
              strokeColor={{
                '0%': '#D64045',
                '50%': '#E69948',
                '100%': '#22A775',
              }}
              showInfo={false}
            />
          </div>

          {/* 问题列表 */}
          {result.issues.length > 0 && (
            <div className="compliance-issues">
              <div className="issues-header">
                <ExclamationCircleOutlined style={{ color: '#D64045' }} />
                <Text strong>{t('compliance.issues')} ({result.issues.length})</Text>
              </div>
              <div>
                {result.issues.map((issue, idx) => (
                  <div key={idx} className="issue-item">
                    <CloseCircleOutlined style={{ color: '#D64045', marginRight: 8 }} />
                    <Text>{issue}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 建议列表 */}
          <div className="compliance-suggestions">
            <div className="suggestions-header">
              <SafetyCertificateOutlined style={{ color: '#0F2B5B' }} />
              <Text strong>{t('compliance.suggestions')}</Text>
            </div>
            {result.suggestions.length > 0 ? (
              <div>
                {result.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="suggestion-item">
                    <CheckCircleOutlined style={{ color: '#22A775', marginRight: 8 }} />
                    <Text>{suggestion}</Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text type="secondary">{t('compliance.noIssues')}</Text>
            )}
          </div>

          <Divider />

          <div className="compliance-actions">
            <Button onClick={() => setResult(null)}>
              {t('compliance.recheck')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ComplianceChecker;
