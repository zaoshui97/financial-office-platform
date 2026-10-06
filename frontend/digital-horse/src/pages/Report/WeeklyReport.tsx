/**
 * 周报日报生成页 —— 场景 6
 *
 * 路径: /report-weekly
 *
 * 完整链路：
 *   选择时间 → 填写摘要 → 生成周报 → 自动合规沙箱检查
 *   → 通过：通知推送（钉钉/邮件/系统）→ 完成
 *   → 阻断：提示修改 → 重新生成
 *
 * 亮点 2 沙箱集成：
 *   - 生成后自动过 sandboxEngine.check()
 *   - 阻断级违规 → 红色 Alert + 不允许提交
 *   - 通过 → 评分展示 + 一键通知推送
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Button,
  Steps,
  Form,
  Input,
  Select,
  DatePicker,
  Divider,
  Alert,
  List,
  Timeline,
  message,
  Statistic,
  Progress,
  Badge,
  Descriptions,
  Collapse,
  Result,
} from 'antd';
import {
  FileTextOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  BellOutlined,
  MailOutlined,
  MessageOutlined,
  SendOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  generateWeeklyReport,
  submitWeeklyReport,
  getMockReportHistory,
} from '@/services/weeklyReportService';
import type {
  ReportType,
  ReportStatus,
  WeeklyReportData,
  ComplianceCheckResult,
} from '@/services/weeklyReportService';
import { ScoreRing } from '@/components/Sandbox/ScoreRing';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

type Step = 'input' | 'generating' | 'preview' | 'submitting' | 'done';

interface NotificationResult {
  channel: string;
  icon: React.ReactNode;
  label: string;
  status: 'success' | 'failed';
  time: string;
}

const WeeklyReportPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('input');
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [period, setPeriod] = useState(dayjs());
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [compliance, setCompliance] = useState<ComplianceCheckResult | null>(null);
  const [notificationResults, setNotificationResults] = useState<NotificationResult[]>([]);
  const [history] = useState<WeeklyReportData[]>(getMockReportHistory());

  // 表单值
  const [form] = Form.useForm();

  const handleGenerate = useCallback(async () => {
    const values = form.getFieldsValue();
    setStep('generating');
    setProgress(0);

    // 模拟进度
    const prog = setInterval(() => setProgress((p) => Math.min(p + 12, 80)), 200);

    try {
      const result = await generateWeeklyReport({
        reportType,
        period: period.format('YYYY-MM-DD'),
        author: '张三',
        department: '技术部',
        summaryInput: {
          thisWeekDone: values.thisWeekDone || '',
          thisWeekBlockers: values.thisWeekBlockers || '',
          nextWeekPlan: values.nextWeekPlan || '',
          metrics: values.metrics || '',
          highlights: values.highlights || '',
        },
        skipCompliance: false,
      });

      clearInterval(prog);
      setProgress(100);
      setReport(result.report);
      setCompliance(result.compliance);
      setStep('preview');

      if (result.compliance.blocked) {
        message.error('检测到阻断级违规，请修改后再提交');
      } else if (!result.compliance.passed) {
        message.warning('发现合规风险，请检查后再提交');
      } else {
        message.success('合规检查通过，可提交');
      }
    } catch (e: any) {
      clearInterval(prog);
      setProgress(0);
      setStep('input');
      message.error(e?.message || '生成失败，请重试');
    }
  }, [reportType, period]);

  const handleSubmit = useCallback(async () => {
    if (!report) return;
    setStep('submitting');

    try {
      const result = await submitWeeklyReport(report);
      setReport({ ...report, status: result.success ? 'pending_review' : 'draft', submittedAt: result.success ? new Date().toISOString() : undefined });

      const results: NotificationResult[] = result.notifications.map((n) => ({
        channel: n.channel,
        icon: n.channel === 'dingtalk' ? <MessageOutlined /> : n.channel === 'email' ? <MailOutlined /> : <BellOutlined />,
        label: n.channel === 'dingtalk' ? '钉钉通知' : n.channel === 'email' ? '邮件' : '系统通知',
        status: n.status,
        time: new Date(n.sentAt).toLocaleString('zh-CN'),
      }));
      setNotificationResults(results);
      setStep('done');
      message.success('周报已提交，通知发送中');
    } catch (e: any) {
      setStep('preview');
      message.error(e?.message || '提交失败');
    }
  }, [report]);

  const handleReset = () => {
    setStep('input');
    setReport(null);
    setCompliance(null);
    setNotificationResults([]);
    form.resetFields();
  };

  const getStatusIcon = (status: ReportStatus) => {
    switch (status) {
      case 'approved': return <CheckCircleOutlined style={{ color: '#22A775' }} />;
      case 'pending_review': return <ClockCircleOutlined style={{ color: '#F59E0B' }} />;
      case 'rejected': return <CloseCircleOutlined style={{ color: '#DC2626' }} />;
      default: return <FileTextOutlined style={{ color: '#6B7280' }} />;
    }
  };

  const getStatusTag = (status: ReportStatus) => {
    const map: Record<ReportStatus, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      pending_review: { color: 'warning', text: '待审核' },
      approved: { color: 'success', text: '已通过' },
      rejected: { color: 'error', text: '已驳回' },
    };
    return <Tag color={map[status].color} icon={getStatusIcon(status)}>{map[status].text}</Tag>;
  };

  const channelIcon = (channel: string) => {
    if (channel === 'dingtalk') return <MessageOutlined />;
    if (channel === 'email') return <MailOutlined />;
    return <BellOutlined />;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* 顶部标题 */}
      <Card
        style={{
          marginBottom: 16,
          background: '#0F2B5B',
          border: 'none',
        }}
      >
        <Row gutter={24} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Space size={8}>
                <FileTextOutlined style={{ fontSize: 28, color: '#fff' }} />
                <Title level={3} style={{ margin: 0, color: '#fff' }}>
                  {'周报 / 日报生成'}
                </Title>
                <Tag color="gold" style={{ border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                  {'场景 6'}
                </Tag>
              </Space>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                {'生成 → 合规检查 → 通知推送，全流程自动化'}
              </Text>
            </Space>
          </Col>
          <Col>
            <Space size={12}>
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{'本周已提交'}</Text>}
                value={history.length}
                valueStyle={{ color: '#fff', fontSize: 22 }}
              />
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{'合规通过'}</Text>}
                value={history.filter((r) => r.compliancePassed).length}
                valueStyle={{ color: '#22A775', fontSize: 22 }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={24}>
        {/* ===== 左侧：主流程 ===== */}
        <Col xs={24} lg={16}>
          {/* Steps */}
          <Card style={{ marginBottom: 16 }}>
            <Steps
              current={
                step === 'input' ? 0
                  : step === 'generating' ? 1
                  : step === 'preview' ? 2
                  : step === 'submitting' ? 3
                  : 4
              }
              items={[
                { title: '填写摘要', icon: <FileTextOutlined /> },
                { title: '生成周报', icon: <RobotOutlined /> },
                { title: '合规检查', icon: <SafetyCertificateOutlined /> },
                { title: '通知推送', icon: <BellOutlined /> },
                { title: '完成', icon: <CheckCircleOutlined /> },
              ]}
            />
          </Card>

          {/* Step 1: 填写摘要 */}
          {step === 'input' && (
            <Card
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#0F2B5B' }} />
                  <span>{'填写周报摘要'}</span>
                </Space>
              }
            >
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label={'报告类型'}>
                      <Select
                        value={reportType}
                        onChange={setReportType}
                        options={[
                          { value: 'daily', label: '日报' },
                          { value: 'weekly', label: '周报' },
                          { value: 'monthly', label: '月报' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={'周期'}>
                      <DatePicker
                        value={period}
                        onChange={(d) => d && setPeriod(d)}
                        picker={reportType === 'daily' ? 'date' : reportType === 'weekly' ? 'week' : 'month'}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label={'本周完成'}
                  name="thisWeekDone"
                >
                  <TextArea rows={3} placeholder={'列出本周完成的主要任务…'} />
                </Form.Item>

                <Form.Item
                  label={'风险与阻塞'}
                  name="thisWeekBlockers"
                >
                  <TextArea rows={2} placeholder={'列出遇到的风险或阻塞问题…'} />
                </Form.Item>

                <Form.Item
                  label={'下周计划'}
                  name="nextWeekPlan"
                >
                  <TextArea rows={3} placeholder={'列出下周的主要计划…'} />
                </Form.Item>

                <Form.Item
                  label={'关键指标（可选）'}
                  name="metrics"
                >
                  <TextArea rows={2} placeholder={'填写关键指标数据，如：项目交付率 88%…'} />
                </Form.Item>

                <Form.Item
                  label={'亮点 / 特殊说明（可选）'}
                  name="highlights"
                >
                  <TextArea rows={2} placeholder={'如有特别亮点或需要说明的情况…'} />
                </Form.Item>

                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  size="large"
                  onClick={handleGenerate}
                  style={{ width: '100%', height: 48, fontSize: 16 }}
                >
                  {'生成周报（含自动合规检查）'}
                </Button>
              </Form>
            </Card>
          )}

          {/* Step 2: 生成中 */}
          {step === 'generating' && (
            <Card>
              <Result
                icon={<RocketOutlined style={{ fontSize: 64, color: '#0F2B5B' }} />}
                title={'AI 正在生成周报…'}
                subTitle={'正在整合信息并自动进行合规检查…'}
                extra={
                  <div style={{ maxWidth: 400, margin: '0 auto' }}>
                    <Progress
                      percent={progress}
                      status="active"
                      strokeColor="#0F2B5B"
                    />
                    <Text type="secondary" style={{ display: 'block', marginTop: 8, textAlign: 'center' }}>
                      {'包含：信息整合 → 内容生成 → 合规自动检查'}
                    </Text>
                  </div>
                }
              />
            </Card>
          )}

          {/* Step 3: 预览 + 合规结果 */}
          {step === 'preview' && report && compliance && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 合规告警 */}
              {compliance.blocked && (
                <Alert
                  type="error"
                  showIcon
                  icon={<CloseCircleOutlined />}
                  message={
                    <Space>
                      <Text strong style={{ color: '#991B1B' }}>
                        {'检测到阻断级违规，必须修改后才能提交'}
                      </Text>
                    </Space>
                  }
                  description={`命中 ${compliance.sandboxResult.issues.filter(i => i.severity === 'block').length} 条阻断规则`}
                  style={{ background: '#FEF2F2', borderColor: '#FCA5A5' }}
                />
              )}

              {compliance.passed && !compliance.blocked && (
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message={'合规检查通过'}
                  description={`评分 ${compliance.score.toFixed(1)}/5 · ${compliance.sandboxResult.issues.length} 项风险已识别`}
                  style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}
                />
              )}

              {compliance.issues && compliance.issues.length > 0 && !compliance.blocked && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  message={'发现合规风险，建议检查后再提交'}
                  description={compliance.summary}
                />
              )}

              {/* 评分 */}
              <Card size="small">
                <Row gutter={24} align="middle">
                  <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                    {compliance.sandboxResult.issues.length > 0 ? (
                      <ScoreRing score={compliance.score} size={100} />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <CheckCircleOutlined style={{ fontSize: 48, color: '#22A775' }} />
                        <div style={{ color: '#22A775', fontWeight: 600, marginTop: 8 }}>{'完全合规'}</div>
                      </div>
                    )}
                  </Col>
                  <Col xs={24} sm={18}>
                    <Row gutter={[8, 8]}>
                      <Col span={8}>
                        <Statistic
                          title={<Text style={{ fontSize: 11 }}>{'合规评分'}</Text>}
                          value={compliance.score.toFixed(1)}
                          suffix="/5"
                          valueStyle={{ color: compliance.passed ? '#22A775' : '#EF4444', fontSize: 20 }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title={<Text style={{ fontSize: 11 }}>{'风险项'}</Text>}
                          value={compliance.sandboxResult.issues.length}
                          valueStyle={{ color: '#EF4444', fontSize: 20 }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title={<Text style={{ fontSize: 11 }}>{'关联法规'}</Text>}
                          value={compliance.sandboxResult.regulations.length}
                          valueStyle={{ color: '#3B82F6', fontSize: 20 }}
                        />
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {compliance.summary}
                    </Text>
                  </Col>
                </Row>
              </Card>

              {/* 报告预览 */}
              <Card
                title={
                  <Space>
                    <FileTextOutlined />
                    <span>{'周报预览'}</span>
                    {getStatusTag(report.status)}
                  </Space>
                }
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={handleReset}>{'重新生成'}</Button>
                    {!compliance.blocked && (
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleSubmit}
                        style={{ background: '#22A775', borderColor: '#22A775' }}
                      >
                        {'提交并推送通知'}
                      </Button>
                    )}
                  </Space>
                }
              >
                <Title level={4}>{report.title}</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {'作者'}: {report.author} · {report.department}
                </Text>
                <Divider style={{ margin: '12px 0' }} />

                {report.sections.map((section) => (
                  <div key={section.id} style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                      {section.title}
                    </Text>
                    <div style={{
                      background: '#F9FAFB',
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.7,
                    }}>
                      {section.content}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Step 4: 提交中 */}
          {step === 'submitting' && (
            <Card>
              <Result
                icon={<SendOutlined style={{ fontSize: 64, color: '#22A775' }} />}
                title={'正在提交并推送通知…'}
                subTitle={'向钉钉 / 邮件 / 系统发送通知…'}
              />
            </Card>
          )}

          {/* Step 5: 完成 */}
          {step === 'done' && (
            <Card>
              <Result
                status="success"
                icon={<CheckCircleOutlined />}
                title={'周报已提交，通知已推送！'}
                subTitle={'所有通知渠道已成功送达'}
                extra={
                  <Space direction="vertical" size={12} style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
                    {notificationResults.map((n) => (
                      <Alert
                        key={n.channel}
                        type={n.status === 'success' ? 'success' : 'error'}
                        showIcon
                        icon={n.icon}
                        message={
                          <Space>
                            <Text>{n.label}</Text>
                            <Tag color={n.status === 'success' ? 'success' : 'error'}>
                              {n.status === 'success' ? '已送达' : '失败'}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>{n.time}</Text>
                          </Space>
                        }
                      />
                    ))}
                    <Button icon={<HistoryOutlined />} onClick={handleReset} block>
                      {'继续填写下周周报'}
                    </Button>
                  </Space>
                }
              />
            </Card>
          )}
        </Col>

        {/* ===== 右侧：历史记录 ===== */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <HistoryOutlined style={{ color: '#0F2B5B' }} />
                <span>{'历史周报'}</span>
              </Space>
            }
          >
            <List
              size="small"
              dataSource={history}
              renderItem={(item) => (
                <List.Item
                  style={{ padding: '8px 0' }}
                  extra={
                    getStatusTag(item.status)
                  }
                >
                  <List.Item.Meta
                    title={<Text strong style={{ fontSize: 13 }}>{item.title}</Text>}
                    description={
                      <Space size={4} wrap>
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.period}</Text>
                        {item.complianceScore !== undefined && (
                          <Tag
                            size="small"
                            color={item.complianceScore >= 4 ? 'success' : item.complianceScore >= 3 ? 'warning' : 'error'}
                          >
                            {item.complianceScore.toFixed(1)}/5
                          </Tag>
                        )}
                        {item.notifications.length > 0 && (
                          <Tag size="small" icon={<BellOutlined />} color="blue">
                            {item.notifications.length} 条通知
                          </Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* 流程说明 */}
          <Card
            size="small"
            title={'完整链路说明'}
            style={{ marginTop: 12 }}
          >
            <Collapse ghost>
              <Panel
                header={'场景 6 完整链路'}
                key="workflow"
              >
                <Timeline
                  size="small"
                  items={[
                    { color: 'blue', children: '填写周报摘要' },
                    { color: 'processing', children: 'AI 生成周报正文' },
                    { color: 'red', children: '自动触发合规沙箱检查' },
                    { color: 'orange', children: '阻断级违规 → 提示修改' },
                    { color: 'green', children: '通过 → 钉钉/邮件/系统通知推送' },
                    { color: 'green', children: '完成，记录运行日志' },
                  ]}
                />
              </Panel>
              <Panel
                header={'与亮点 2 沙箱的关系'}
                key="sandbox"
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {zh
                    ? '场景 6 是合规沙箱的典型集成入口。周报正文生成后自动进入沙箱检查，无需人工干预。阻断级违规会阻止提交，确保发出的每一份周报都合规。'
                    : 'Scene 6 is a key sandbox integration point. Report text is automatically checked by the compliance sandbox after generation. Blocking violations prevent submission, ensuring every sent report is compliant.'}
                </Text>
              </Panel>
            </Collapse>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default WeeklyReportPage;
