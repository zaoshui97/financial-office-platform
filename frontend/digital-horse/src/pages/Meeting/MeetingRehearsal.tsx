/**
 * MeetingRehearsal — 会前预演（年度战略规划研讨会专项版）
 *
 * 4 个 Agent 模拟 4 位主持人按差异化节奏预演：
 *   - 张总（CEO · 议程总览）moderator   8 秒
 *   - 王总（CIO · 引导讨论）decision   6 秒
 *   - 赵总（CFO · 控场预算）action     5 秒
 *   - 李总（战略部 · 收束引导）notetaker 4 秒
 *
 * 真实感设计：
 *   1) 每个 agent 有自己的「思考中…」倒计时（差异化）
 *   2) 每个 agent 的输出按 stream 字段逐字流式呈现（不是一次性吐出）
 *   3) 黑板内容按 agent 顺序分批填入，不是 4 个 agent 一起 ready
 */

import React, { useEffect, useState, useRef } from 'react';
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
  Badge,
  message,
  Avatar,
  Divider,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  BulbOutlined,
  RobotOutlined,
  ExperimentOutlined,
  TeamOutlined,
  CrownOutlined,
  SafetyOutlined,
  DollarOutlined,
  CompassOutlined,
  LoadingOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import '@/components/Meeting/AgentPanel.css';
import {
  REHEARSAL_SCRIPTS,
  STRATEGY_MEETING,
  PARTICIPANTS,
  type RehearsalScript,
} from './strategyMeetingData';

const initialBb = {
  topics: [] as string[],
  decisions: [] as string[],
  actions: [] as string[],
  risks: [] as string[],
};

type RunState = {
  status: 'idle' | 'thinking' | 'streaming' | 'done';
  progress: number;        // 思考进度 0-100
  streamed: string;        // 已经流式输出的内容
  script?: RehearsalScript;
};

type AgentKey = 'moderator' | 'notetaker' | 'decision' | 'action';

const initialAgents: Record<AgentKey, RunState> = {
  moderator: { status: 'idle', progress: 0, streamed: '' },
  notetaker: { status: 'idle', progress: 0, streamed: '' },
  decision:  { status: 'idle', progress: 0, streamed: '' },
  action:    { status: 'idle', progress: 0, streamed: '' },
};

// 角色 → AgentKey 映射
const ROLE_AGENT_KEY: Record<RehearsalScript['agentRole'], AgentKey> = {
  moderator: 'moderator',
  decision: 'decision',
  action: 'action',
  notetaker: 'notetaker',
};

// 角色图标 & 颜色
const ROLE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  moderator: { icon: <CrownOutlined />,   color: '#0F2B5B', bg: '#0F2B5B0D', label: '议程总览' },
  decision:  { icon: <SafetyOutlined />,  color: '#1890ff', bg: '#1890ff0d', label: '讨论引导' },
  action:    { icon: <DollarOutlined />,  color: '#fa8c16', bg: '#fa8c160d', label: '冲突控场' },
  notetaker: { icon: <CompassOutlined />, color: '#52c41a', bg: '#52c41a0d', label: '收束引导' },
};

const { Title, Text, Paragraph } = Typography;

const MeetingRehearsal: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isZh] = useState(i18n.language === 'zh-CN');
  const [currentStep, setCurrentStep] = useState(0);
  const [bb, setBb] = useState(initialBb);
  const [agents, setAgents] = useState(initialAgents);
  const [rehearsalId, setRehearsalId] = useState<string>(id ?? '');
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    if (id) setRehearsalId(id);
  }, [id]);

  useEffect(() => {
    return () => {
      // 组件卸载时清理所有 setTimeout
      timersRef.current.forEach((tid) => window.clearTimeout(tid));
      timersRef.current = [];
    };
  }, []);

  const steps = [
    { title: '预演前', desc: '加载议程 + 4 主持人脚本' },
    { title: '预演中', desc: '4 Agent 模拟差异化预演' },
    { title: '预演完成', desc: '提炼关键风险 + 共识建议' },
    { title: '进入会议', desc: '一键开始正式会议' },
  ];

  // ============================================================
  // 启动预演：4 个 agent 严格按顺序启动，每个 agent 内部：
  //   1) thinking 阶段（按 thinkingMs 倒计时，进度条更新）
  //   2) streaming 阶段（按 stream 逐字流式输出，每段 200ms 一字）
  //   3) done 阶段（写入黑板，触发下一个 agent）
  // ============================================================
  const handleStartRehearsal = async () => {
    setCurrentStep(1);
    setBb({ topics: [], decisions: [], actions: [], risks: [] });
    setAgents({
      moderator: { status: 'idle', progress: 0, streamed: '' },
      notetaker: { status: 'idle', progress: 0, streamed: '' },
      decision:  { status: 'idle', progress: 0, streamed: '' },
      action:    { status: 'idle', progress: 0, streamed: '' },
    });

    // 顺序执行：每个 agent 完成后再启动下一个
    for (const script of REHEARSAL_SCRIPTS) {
      const key = ROLE_AGENT_KEY[script.agentRole];
      await runOneAgent(key, script);
    }

    // 全部完成
    setCurrentStep(2);
  };

  /**
   * 单个 agent 完整生命周期：thinking → streaming → done
   * 全部基于 setTimeout + 闭包 + 状态回调，不发任何网络请求
   */
  const runOneAgent = (key: AgentKey, script: RehearsalScript): Promise<void> => {
    return new Promise((resolve) => {
      // 1) 进入 thinking
      setAgents((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: 'thinking', progress: 0, script },
      }));

      // 思考进度条（每 80ms +1，模拟 token 加载）
      const thinkStep = Math.max(80, Math.floor(script.thinkingMs / 100));
      const thinkTimer = window.setInterval(() => {
        setAgents((prev) => {
          const cur = prev[key];
          if (cur.status !== 'thinking') return prev;
          const next = Math.min(100, cur.progress + (100 / (script.thinkingMs / thinkStep)));
          return { ...prev, [key]: { ...cur, progress: next } };
        });
      }, thinkStep);
      timersRef.current.push(thinkTimer);

      // 2) thinking 结束 → 进入 streaming
      const streamStart = window.setTimeout(() => {
        window.clearInterval(thinkTimer);
        setAgents((prev) => ({
          ...prev,
          [key]: { ...prev[key], status: 'streaming', progress: 100, script },
        }));

        // 3) 流式输出：把 stream 数组里所有段拼起来，按字吐出
        //    每 18ms 一个字（比真实 LLM 略快，但视觉上自然）
        const fullText = script.stream.join('\n\n');
        let i = 0;
        const streamTimer = window.setInterval(() => {
          i += 1;
          if (i >= fullText.length) {
            window.clearInterval(streamTimer);
            // 4) done
            setAgents((prev) => ({
              ...prev,
              [key]: { ...prev[key], status: 'done', streamed: fullText, script },
            }));
            // 写入黑板
            setBb((prev) => ({
              topics: [...prev.topics, ...script.blackboard.topics],
              decisions: [...prev.decisions, ...script.blackboard.decisions],
              actions: [...prev.actions, ...script.blackboard.actions],
              risks: [...prev.risks, ...script.blackboard.risks],
            }));
            resolve();
          } else {
            setAgents((prev) => ({
              ...prev,
              [key]: { ...prev[key], streamed: fullText.slice(0, i) },
            }));
          }
        }, 18);
        timersRef.current.push(streamTimer);
      }, script.thinkingMs);
      timersRef.current.push(streamStart);
    });
  };

  const handleEnterMeeting = () => {
    setCurrentStep(3);
    message.success('进入正式会议');
    setTimeout(() => {
      navigate(`/meeting?tab=room&id=${id ?? rehearsalId}`);
    }, 600);
  };

  // 计算预演"健康度"
  const rehearsalScore =
    bb.decisions.length * 5 +
    bb.actions.length * 3 +
    bb.risks.length * 8 +
    bb.topics.length * 4;
  const readiness = Math.min(100, 40 + rehearsalScore);

  const allDone = REHEARSAL_SCRIPTS.every(
    (s) => agents[ROLE_AGENT_KEY[s.agentRole]].status === 'done'
  );

  return (
    <div className="rehearsal-page">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Space size={12} align="center">
            <Tag color="gold" style={{ borderRadius: 4 }}>
              <ExperimentOutlined /> 战略研讨专项
            </Tag>
            <Title level={3} style={{ margin: 0 }}>
              <ExperimentOutlined style={{ marginRight: 12, color: '#0F2B5B' }} />
              {'会前智能预演'}
            </Title>
            <Tag color="blue">{STRATEGY_MEETING.title}</Tag>
          </Space>
          <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
            {'4 个 AI Agent 模拟 4 位主持人按差异化节奏预演：CEO 张总议程总览 → CIO 王总引导 → CFO 赵总控场 → 战略部李总收束'}
          </Paragraph>
        </div>

        {/* Steps */}
        <Card style={{ marginBottom: 16 }}>
          <Steps current={currentStep} items={steps} />
        </Card>

        {/* 议程概览卡片：一直显示，让用户知道"在预演什么会" */}
        <Card
          size="small"
          title={
            <Space>
              <CalendarOutlined style={{ color: '#0F2B5B' }} />
              <span>{'议程概览'}</span>
            </Space>
          }
          style={{ marginBottom: 16, background: '#F7F9FC' }}
        >
          <Row gutter={[16, 8]}>
            {STRATEGY_MEETING.agenda.map((a) => (
              <Col span={6} key={a.id}>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #E8EDF4',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <Tag color="blue" style={{ marginRight: 4 }}>{a.id}</Tag>
                  <Text strong>{a.title}</Text>
                  <div style={{ color: '#888', marginTop: 4 }}>
                    {a.time} · {a.leader}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>

        {currentStep === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
            <RobotOutlined style={{ fontSize: 64, color: '#0F2B5B', marginBottom: 16 }} />
            <Title level={4}>
              {'准备好开始预演了吗？'}
            </Title>
            <Paragraph type="secondary">
              {'4 位 AI 主持人将依次预演本次会议的关键讨论、决策点与风险信号'}
            </Paragraph>
            <Space size={12} style={{ marginTop: 8 }}>
              {PARTICIPANTS.map((p) => (
                <Tag key={p.id} color="default" style={{ padding: '4px 10px' }}>
                  <Avatar
                    size="small"
                    style={{ backgroundColor: p.avatarColor, marginRight: 6 }}
                  >
                    {p.name.charAt(0)}
                  </Avatar>
                  {p.name} · {p.role}
                </Tag>
              ))}
            </Space>
            <div>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleStartRehearsal}
                style={{
                  background: '#0F2B5B',
                  border: 'none',
                  marginTop: 20,
                }}
              >
                {'开始预演'}
              </Button>
            </div>
          </Card>
        )}

        {(currentStep === 1 || currentStep === 2) && (
          <Row gutter={16}>
            {/* 左侧：4 Agent 实时状态（每个 agent 独立卡片） */}
            <Col span={14}>
              <Card
                title={
                  <Space>
                    <TeamOutlined />
                    <span>{'4 Agent 实时预演'}</span>
                    <Tag color="processing">
                      {REHEARSAL_SCRIPTS.filter((s) => agents[ROLE_AGENT_KEY[s.agentRole]].status === 'done').length}
                      /{REHEARSAL_SCRIPTS.length} 完成
                    </Tag>
                  </Space>
                }
                size="small"
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {REHEARSAL_SCRIPTS.map((script) => {
                    const key = ROLE_AGENT_KEY[script.agentRole];
                    const s = agents[key];
                    const meta = ROLE_META[script.agentRole];
                    return (
                      <Card
                        key={script.agentRole}
                        size="small"
                        style={{
                          borderColor:
                            s.status === 'done' ? '#52c41a' :
                            s.status === 'thinking' || s.status === 'streaming' ? '#1890ff' : undefined,
                          background: meta.bg,
                        }}
                      >
                        {/* Agent 头部 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space>
                            <Badge
                              status={
                                s.status === 'done' ? 'success' :
                                s.status === 'idle' ? 'default' : 'processing'
                              }
                            />
                            <Avatar
                              size="small"
                              style={{ backgroundColor: meta.color }}
                              icon={meta.icon}
                            />
                            <Text strong>{script.agentName}</Text>
                            <Tag color="default">{meta.label}</Tag>
                          </Space>
                          <Space size={4}>
                            {s.status === 'thinking' && (
                              <>
                                <LoadingOutlined style={{ color: '#1890ff' }} />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {'思考中… '}
                                  {Math.round(s.progress)}%
                                </Text>
                              </>
                            )}
                            {s.status === 'streaming' && (
                              <Tag color="processing" icon={<LoadingOutlined spin />}>
                                {'流式输出中…'}
                              </Tag>
                            )}
                            {s.status === 'done' && (
                              <Tag color="success" icon={<CheckCircleOutlined />}>
                                {'预演完成'}
                              </Tag>
                            )}
                            {s.status === 'idle' && (
                              <Tag icon={<ClockCircleOutlined />}>
                                {'待命'}
                              </Tag>
                            )}
                          </Space>
                        </div>

                        {/* 思考进度条 */}
                        {s.status === 'thinking' && (
                          <Progress
                            percent={Math.round(s.progress)}
                            showInfo={false}
                            size="small"
                            strokeColor="#1890ff"
                            style={{ marginTop: 8, marginBottom: 0 }}
                          />
                        )}

                        {/* 流式 / 完成 输出 */}
                        {(s.status === 'streaming' || s.status === 'done') && s.streamed && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: '10px 12px',
                              background: '#fff',
                              border: '1px solid #E8EDF4',
                              borderRadius: 6,
                              fontSize: 12,
                              lineHeight: 1.7,
                              color: '#333',
                              whiteSpace: 'pre-wrap',
                              maxHeight: 220,
                              overflowY: 'auto',
                            }}
                          >
                            {s.streamed}
                            {s.status === 'streaming' && (
                              <span style={{
                                display: 'inline-block',
                                width: 2,
                                height: 14,
                                background: meta.color,
                                marginLeft: 2,
                                animation: 'blink 1s infinite',
                              }} />
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </Space>
              </Card>
            </Col>

            {/* 右侧：健康度 + 预演黑板（实时填充） */}
            <Col span={10}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small">
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

                <Card
                  size="small"
                  title={
                    <Space>
                      <BulbOutlined />
                      <span>{'预演黑板'}</span>
                      {allDone && <Tag color="success">已收敛</Tag>}
                    </Space>
                  }
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div>
                      <Text strong style={{ fontSize: 12 }}>📌 议题：</Text>
                      <div style={{ marginTop: 4 }}>
                        {bb.topics.length === 0 ? (
                          <Tag>暂无</Tag>
                        ) : (
                          bb.topics.map((tt, i) => <Tag color="blue" key={i} style={{ marginBottom: 4 }}>{tt}</Tag>)
                        )}
                      </div>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div>
                      <Text strong style={{ fontSize: 12 }}>✅ 决策：</Text>
                      <div style={{ marginTop: 4 }}>
                        {bb.decisions.length === 0 ? (
                          <Tag>暂无</Tag>
                        ) : (
                          bb.decisions.map((tt, i) => <Tag color="purple" key={i} style={{ marginBottom: 4 }}>{tt}</Tag>)
                        )}
                      </div>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div>
                      <Text strong style={{ fontSize: 12 }}>📎 待办：</Text>
                      <div style={{ marginTop: 4 }}>
                        {bb.actions.length === 0 ? (
                          <Tag>暂无</Tag>
                        ) : (
                          bb.actions.map((tt, i) => <Tag color="geekblue" key={i} style={{ marginBottom: 4 }}>{tt}</Tag>)
                        )}
                      </div>
                    </div>
                    <Divider style={{ margin: '4px 0' }} />
                    <div>
                      <Text strong style={{ fontSize: 12 }}>⚠️ 风险：</Text>
                      <div style={{ marginTop: 4 }}>
                        {bb.risks.length === 0 ? (
                          <Tag>暂无</Tag>
                        ) : (
                          bb.risks.map((tt, i) => <Tag color="red" key={i} style={{ marginBottom: 4 }}>{tt}</Tag>)
                        )}
                      </div>
                    </div>
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        )}

        {currentStep === 2 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Alert
              type="success"
              showIcon
              style={{ maxWidth: 720, margin: '0 auto 16px' }}
              message={'4 位主持人预演已完成'}
              description={
                `${bb.decisions.length} 个决策点、${bb.actions.length} 个待办事项、${bb.risks.length} 个风险信号已收敛。建议在正式会议开始前与相关干系人预先沟通。`
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

      {/* 流式输出光标动画 */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default MeetingRehearsal;
