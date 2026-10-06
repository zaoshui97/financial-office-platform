/**
 * MeetingRehearsal — 会前预演
 *
 * 在会议开始前，4 Agent 模拟 4 位参会人预演一遍议题。
 * 用户可看到会议可能讨论到的关键问题、决策点、待办、风险信号，
 * 并能直接进入会议。
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Tag,
  Steps,
  Alert,
  Empty,
  Progress,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  BulbOutlined,
  RobotOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { AgentCard } from '@/components/Meeting/AgentCard';
import { Blackboard } from '@/components/Meeting/Blackboard';
import {
  useAllAgentRunStates,
  useBlackboard,
} from '@/services/useMultiAgent';
import { runRehearsal, resetMeeting } from '@/services/multiAgentOrchestrator';
import '@/components/Meeting/AgentPanel.css';

const { Title, Text, Paragraph } = Typography;

const MeetingRehearsal: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isZh] = useState(i18n.language === 'zh-CN');
  const [currentStep, setCurrentStep] = useState(0);

  const agents = useAllAgentRunStates();
  const bb = useBlackboard();

  useEffect(() => {
    if (id) {
      resetMeeting(id);
    }
  }, [id]);

  const steps = [
    { title: '预演前', desc: '加载议程 + 历史偏好' },
    { title: '预演中', desc: '4 Agent 模拟参会' },
    { title: '预演完成', desc: '提炼关键风险 + 建议' },
    { title: '进入会议', desc: '一键开始正式会议' },
  ];

  const handleStartRehearsal = async () => {
    setCurrentStep(1);
    await runRehearsal();
    setCurrentStep(2);
  };

  const handleEnterMeeting = () => {
    setCurrentStep(3);
    message.success('进入正式会议');
    setTimeout(() => {
      navigate(`/meeting-room/${id}`);
    }, 600);
  };

  // 计算预演"健康度"
  const rehearsalScore =
    bb.decisions.length * 5 +
    bb.actions.length * 3 +
    bb.risks.length * 8 +
    bb.topics.length * 4;
  const readiness = Math.min(100, 40 + rehearsalScore);

  return (
    <div className="rehearsal-page">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ExperimentOutlined style={{ marginRight: 12, color: '#0F2B5B' }} />
            {'会前智能预演'}
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 14 }}>
            {'4 个 AI Agent 将扮演所有参会人，预演本次会议的关键讨论、决策点与风险信号'}
          </Paragraph>
        </div>

        {/* Steps */}
        <Card style={{ marginBottom: 16 }}>
          <Steps current={currentStep} items={steps} />
        </Card>

        {currentStep === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
            <RobotOutlined style={{ fontSize: 64, color: '#0F2B5B', marginBottom: 16 }} />
            <Title level={4}>
              {'准备好开始预演了吗？'}
            </Title>
            <Paragraph type="secondary">
              {'预演将基于您最近的会议偏好 + 本次会议议程，模拟 4 位参会人的关键讨论'}
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleStartRehearsal}
              style={{
                background: '#0F2B5B',
                border: 'none',
                marginTop: 16,
              }}
            >
              {'开始预演'}
            </Button>
          </Card>
        )}

        {(currentStep === 1 || currentStep === 2) && (
          <Row gutter={16}>
            <Col span={14}>
              <Card title={<><TeamOutlined /> {'4 Agent 实时状态'}</>}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <AgentCard role="moderator" state={agents.moderator} isZh={isZh} />
                  <AgentCard role="notetaker" state={agents.notetaker} isZh={isZh} />
                  <AgentCard role="decision" state={agents.decision} isZh={isZh} />
                  <AgentCard role="action" state={agents.action} isZh={isZh} />
                </Space>
              </Card>
            </Col>

            <Col span={10}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">{'会议就绪度'}</Text>
                    <Progress
                      type="circle"
                      percent={readiness}
                      strokeColor={{
                        '0%': '#52c41a',
                        '100%': '#0F2B5B',
                      }}
                      style={{ marginTop: 8 }}
                    />
                    <div style={{ marginTop: 12 }}>
                      {readiness >= 80 ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                          {'就绪度高，可直接开始'}
                        </Tag>
                      ) : readiness >= 50 ? (
                        <Tag color="warning">
                          {'建议补充议程细节'}
                        </Tag>
                      ) : (
                        <Tag color="default">
                          {'预演中…'}
                        </Tag>
                      )}
                    </div>
                  </div>
                </Card>

                <Card title={<><BulbOutlined /> {'预演黑板'}</>}>
                  <Blackboard isZh={isZh} />
                </Card>
              </Space>
            </Col>
          </Row>
        )}

        {currentStep === 2 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Alert
              type="info"
              showIcon
              style={{ maxWidth: 720, margin: '0 auto 16px' }}
              message={'预演已识别出本次会议的关键讨论点'}
              description={
                `${bb.decisions.length} 个决策点、${bb.actions.length} 个待办事项、${bb.risks.length} 个风险信号。建议在正式会议开始前与相关干系人预先沟通。`
              }
            />
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={handleEnterMeeting}
              style={{
                background: '#52c41a',
                border: 'none',
              }}
            >
              {'进入正式会议'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRehearsal;
