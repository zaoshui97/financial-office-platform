/**
 * SandboxRunner —— 合规沙箱主运行器
 *
 * 双栏布局：
 *   左侧：输入区（文本框 + 演示数据切换 + 运行按钮）
 *   右侧：实时检测结果（评分圆环 + 问题列表 + 高亮文本 + 法规引用）
 *
 * 集成点：
 *   - Approval 页调用（传入 text + 审批单标题）
 *   - Report 导出前调用
 *   - 独立 Sandbox 页直接使用
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Divider,
  Alert,
  Spin,
  List,
  message,
  Tabs,
  Progress,
  Modal,
  Form,
  Select,
} from 'antd';
import {
  RocketOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CopyOutlined,
  ReloadOutlined,
  FileTextOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { checkCompliance } from '@/services/sandbox/sandboxApiContract';
import type { SandboxResult } from '@/services/sandbox/sandboxEngine';
import { CATEGORY_META } from '@/services/sandbox/complianceRules';
import { DEMO_SANDBOX_TEXTS, getDemoById } from '@/mock/sandboxDemo';
import { ScoreRing } from './ScoreRing';
import { RuleHighlight } from './RuleHighlight';
import { RegulationModal } from './RegulationModal';
import type { Regulation } from '@/services/sandbox/regulationRef';
import { useApprovalDraftStore } from '@/store/approvalDraftStore';
import { useUserStore } from '@/store/userStore';
import { generateReceipt, type ComplianceReceipt } from '@/services/sandbox/complianceReceipt';
import { ComplianceReceiptCard } from './ComplianceReceiptCard';
import { RegulationPanel } from './RegulationPanel';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface SandboxRunnerProps {
  /** 外部传入的初始文本（如从 Approval 跳转） */
  initialText?: string;
  /** 来源标识 */
  source?: 'approval' | 'report' | 'qa' | 'sandbox_page' | 'demo';
  /** 审批单标题（可选，用于显示） */
  approvalTitle?: string;
  /** 是否隐藏演示数据切换（嵌入场景） */
  hideDemoSwitcher?: boolean;
}

type RunState = 'idle' | 'running' | 'done' | 'error';

export const SandboxRunner: React.FC<SandboxRunnerProps> = ({
  initialText = '',
  source = 'sandbox_page',
  approvalTitle,
  hideDemoSwitcher = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createDraft } = useApprovalDraftStore();
  const user = useUserStore((s) => s.user);

  const [text, setText] = useState(initialText);
  const [runState, setRunState] = useState<RunState>('idle');
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [activeTab, setActiveTab] = useState('result');
  const [selectedRegulation, setSelectedRegulation] = useState<Regulation | null>(null);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ComplianceReceipt | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // 运行沙箱
  const handleRun = useCallback(async () => {
    if (!text.trim()) {
      message.warning('请输入需要检查的文本内容');
      return;
    }

    setRunState('running');
    setResult(null);
    setProgress(0);

    // 模拟进度条
    const prog = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 150);

    try {
      const res = await checkCompliance({ text, source });
      clearInterval(prog);
      setProgress(100);
      setResult(res);
      setRunState('done');
      setActiveTab('result');
      if (res.blocked) {
        message.error({ content: '检测到阻断级违规，请修改后重试', duration: 4 });
      } else if (!res.passed) {
        message.warning({ content: '发现合规风险，请查看下方详情', duration: 3 });
      } else {
        message.success({ content: '检查通过，合规性良好', duration: 2 });
      }
    } catch (e: any) {
      clearInterval(prog);
      setProgress(0);
      setRunState('error');
      message.error(e?.message || '沙箱服务异常，请重试');
    }
  }, [text, source]);

  // 切换演示数据
  const handleDemoSelect = (demoId: string) => {
    const demo = getDemoById(demoId);
    if (demo) {
      setText(demo.text);
      setResult(null);
      setRunState('idle');
    }
  };

  // 复制改写建议
  const handleCopyRewrite = () => {
    if (!result?.rewritten) return;
    navigator.clipboard.writeText(result.rewritten).then(() => {
      message.success('已复制到剪贴板');
    });
  };

  // 提交审批：打开表单弹窗
  const handleOpenSubmitModal = () => {
    if (!result) return;
    submitForm.setFieldsValue({ title: approvalTitle || `合规检测报告 - ${new Date().toLocaleDateString('zh-CN')}` });
    setSubmitModalOpen(true);
  };

  // 确认提交审批
  const handleConfirmSubmit = async () => {
    if (!result) return;
    try {
      const values = await submitForm.validateFields();
      setSubmitting(true);
      createDraft({
        title: values.title,
        text,
        result,
        approvalType: values.approvalType,
      });
      setSubmitModalOpen(false);
      message.success('已生成审批草稿，正在跳转…');
      navigate('/approval');
    } catch {
      // 表单校验失败
    } finally {
      setSubmitting(false);
    }
  };

  const severityColor: Record<string, string> = {
    block: '#DC2626',
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#3B82F6',
  };

  const severityLabel: Record<string, string> = {
    block: '阻断',
    high: '高危',
    medium: '中危',
    low: '低危',
  };

  return (
    <div className="sandbox-runner">
      <Row gutter={24} style={{ alignItems: 'stretch' }}>
        {/* ===== 左侧：输入区 ===== */}
        <Col xs={24} lg={10} style={{ display: 'flex' }}>
          {/* 审批单标题 */}
          {approvalTitle && (
            <Alert
              type="info"
              showIcon
              icon={<FileTextOutlined />}
              message={
                <span>
                  {'检查审批单：'}
                  <strong>{approvalTitle}</strong>
                </span>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          <Card
            title={
              <Space>
                <ExperimentOutlined style={{ color: '#0F2B5B' }} />
                <span>{'待检测文本'}</span>
              </Space>
            }
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: 16, display: 'flex', flexDirection: 'column', flex: 1 } }}
          >
            {/* 演示数据切换 */}
            {!hideDemoSwitcher && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {'快速体验（点击切换）：'}
                  </Text>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DEMO_SANDBOX_TEXTS.map((demo) => (
                      <Button
                        key={demo.id}
                        size="small"
                        type={text === demo.text ? 'primary' : 'default'}
                        onClick={() => handleDemoSelect(demo.id)}
                      >
                        {demo.title.slice(0, 8)}
                      </Button>
                    ))}
                  </div>
                </div>
                <Divider style={{ margin: '12px 0' }} />
              </>
            )}

            <TextArea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setRunState('idle');
              }}
              placeholder={'在此粘贴合同条款、邮件内容、报告正文、通知发文…\n字数不限，支持多段落。'}
              style={{ fontSize: 13, fontFamily: 'monospace', flex: 1, minHeight: 240 }}
              autoSize={false}
            />

            {/* 运行按钮 */}
            <div style={{ marginTop: 12 }}>
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={handleRun}
                loading={runState === 'running'}
                size="large"
                block
                disabled={!text.trim()}
                style={{
                  height: 48,
                  fontSize: 16,
                  background: '#0F2B5B',
                  borderColor: '#0F2B5B',
                }}
              >
                {runState === 'running'
                  ? 'AI 正在检测…'
                  : '启动合规沙箱'}
              </Button>
              {runState === 'running' && (
                <Progress
                  percent={progress}
                  size="small"
                  status="active"
                  strokeColor="#0F2B5B"
                  style={{ marginTop: 8 }}
                  format={(p) => `${p}%`}
                />
              )}
              {/* 提交审批按钮：检测完成后显示（人工复审必走） */}
              {runState === 'done' && result && (
                <Button
                  icon={<SendOutlined />}
                  onClick={handleOpenSubmitModal}
                  block
                  style={{
                    marginTop: 8,
                    height: 40,
                    borderColor: '#0F2B5B',
                    color: '#0F2B5B',
                  }}
                >
                  {'提交人工复审'}
                </Button>
              )}
            </div>

            {/* 字数提示 */}
            {text.length > 0 && (
              <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                {text.length} 字符
              </Text>
            )}
          </Card>
        </Col>

        {/* ===== 右侧：结果区 ===== */}
        <Col xs={24} lg={14} style={{ display: 'flex' }}>
          {runState === 'idle' && !result && (
            <Card
              style={{
                flex: 1,
                minHeight: 480,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <SafetyCertificateOutlined style={{ fontSize: 64, color: '#D1D5DB' }} />
              <Text type="secondary" style={{ fontSize: 16 }}>
                {'在左侧输入文本，点击"启动合规沙箱"开始检测'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {'检测耗时约 1-2 秒，覆盖 9 大类 47 条金融合规规则'}
              </Text>
            </Card>
          )}

          {(runState === 'running') && (
            <Card style={{ flex: 1, minHeight: 480 }}>
              <div style={{ textAlign: 'center', padding: '120px 0' }}>
                <Spin size="large" tip={'AI 沙箱正在分析文本…'} />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">{'正在匹配 47 条合规规则…'}</Text>
                </div>
              </div>
            </Card>
          )}

          {runState === 'done' && result && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                minHeight: 480,
              }}
            >
              {/* 阻断告警 */}
              {result.blocked && (
                <Alert
                  type="error"
                  showIcon
                  icon={<CloseCircleOutlined />}
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ color: '#991B1B' }}>
                        {'检测到阻断级违规'}
                      </Text>
                      <Tag color="red" style={{ margin: 0 }}>{'阻断'}</Tag>
                    </div>
                  }
                  description={
                    <span style={{ paddingLeft: 0 }}>
                      {`命中 ${result.issues.filter(i => i.severity === 'block').length} 条阻断规则，内容必须修改后才能通过审核`}
                    </span>
                  }
                  style={{ background: '#FEF2F2', borderColor: '#FCA5A5', padding: '8px 12px' }}
                />
              )}

              {/* 通过提示 */}
              {result.passed && !result.blocked && (
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong>{'合规检查通过'}</Text>
                      <Tag color="green" style={{ margin: 0 }}>{'AI 预审通过'}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{'提交后仍需人工复审'}</Text>
                    </div>
                  }
                  description={`评分 ${result.score.toFixed(1)}/5 · 命中 0 条阻断规则 · 耗时 ${result.durationMs}ms`}
                  style={{ background: '#ECFDF5', borderColor: '#A7F3D0', padding: '8px 12px' }}
                />
              )}

              {/* 评分 + 统计 */}
              <Card size="small" styles={{ body: { padding: 16 } }}>
                <Row gutter={16} align="middle">
                  <Col xs={24} sm={7} style={{ textAlign: 'center' }}>
                    <ScoreRing score={result.score} size={100} />
                    <div style={{ marginTop: 4 }}>
                      <Tag
                        color={result.blocked ? 'error' : result.passed ? 'success' : 'warning'}
                        icon={result.blocked ? <CloseCircleOutlined /> : result.passed ? <CheckCircleOutlined /> : <WarningOutlined />}
                        style={{ fontSize: 12, margin: 0 }}
                      >
                        {result.blocked
                          ? '阻断'
                          : result.passed
                          ? '通过'
                          : '警告'}
                      </Tag>
                    </div>
                  </Col>
                  <Col xs={24} sm={17}>
                    <Row gutter={[8, 8]}>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <Title level={3} style={{ margin: 0, color: '#DC2626' }}>{result.issues.length}</Title>
                          <Text type="secondary" style={{ fontSize: 12 }}>{'风险项'}</Text>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <Title level={3} style={{ margin: 0, color: '#EF4444' }}>{result.totalHits}</Title>
                          <Text type="secondary" style={{ fontSize: 12 }}>{'命中次数'}</Text>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div style={{ textAlign: 'center' }}>
                          <Title level={3} style={{ margin: 0, color: '#0F2B5B' }}>{result.regulations.length}</Title>
                          <Text type="secondary" style={{ fontSize: 12 }}>{'关联法规'}</Text>
                        </div>
                      </Col>
                      <Col span={24}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {'检测耗时'}: {result.durationMs}ms · {'规则库版本'}: v2024.10
                        </Text>
                      </Col>
                    </Row>
                  </Col>
                  <Col xs={24} sm={5}>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <Button
                        type="primary"
                        block
                        icon={<FileProtectOutlined />}
                        onClick={async () => {
                          const r = await generateReceipt({
                            text,
                            result,
                            source,
                            operator: user?.name || 'anonymous',
                            operatorDept: user?.department,
                            operatorRole: user?.role,
                          });
                          setReceipt(r);
                          setReceiptModalOpen(true);
                        }}
                      >
                        {'导出合规回执'}
                      </Button>
                      <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
                        {'带防伪码，可作为审计凭证'}
                      </Text>
                    </Space>
                  </Col>
                </Row>
              </Card>

              {/* Tab 区域 — 占满剩余高度，内容内部滚动 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                tabBarStyle={{ marginBottom: 8 }}
                items={[
                  {
                    key: 'result',
                    label: (
                      <span>
                        <WarningOutlined />
                        {'风险详情'} ({result.issues.length})
                      </span>
                    ),
                    children: (
                      <Card size="small" style={{ height: 460, overflow: 'auto' }}>
                        {result.issues.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: 24 }}>
                            <CheckCircleOutlined style={{ fontSize: 32, color: '#22A775' }} />
                            <div style={{ marginTop: 8 }}>{'未发现合规风险'}</div>
                          </div>
                        ) : (
                          <List
                            size="small"
                            dataSource={result.issues}
                            renderItem={(issue) => {
                              const meta = CATEGORY_META[issue.category];
                              return (
                                <List.Item
                                  style={{
                                    borderLeft: `4px solid ${severityColor[issue.severity]}`,
                                    paddingLeft: 12,
                                    marginBottom: 8,
                                  }}
                                >
                                  <div style={{ width: '100%' }}>
                                    <Space size={6} wrap>
                                      <Tag color={severityColor[issue.severity]}>
                                        {severityLabel[issue.severity]}
                                      </Tag>
                                      <Tag style={{ background: `${meta.color}22`, borderColor: meta.color, color: meta.color }}>
                                        {meta.icon} {meta.name}
                                      </Tag>
                                      <Text strong style={{ fontSize: 13 }}>{issue.ruleName}</Text>
                                    </Space>
                                    {issue.snippets.length > 0 && (
                                      <div style={{ marginTop: 4, marginLeft: 4, fontSize: 12, color: '#6B7280' }}>
                                        {issue.snippets[0]}
                                      </div>
                                    )}
                                    <div style={{ marginTop: 4, fontSize: 12, color: '#059669' }}>
                                      {issue.suggestion}
                                    </div>
                                    {issue.regulations.length > 0 && (
                                      <div style={{ marginTop: 4 }}>
                                        {issue.regulations.slice(0, 2).map((reg) => (
                                          <Tag
                                            key={reg.id}
                                            size="small"
                                            icon={<BookOutlined />}
                                            style={{ cursor: 'pointer', marginBottom: 4 }}
                                            onClick={() => {
                                              setSelectedRegulation(reg);
                                              setRegModalOpen(true);
                                            }}
                                          >
                                            {reg.shortName} {reg.article}
                                          </Tag>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </List.Item>
                              );
                            }}
                          />
                        )}
                      </Card>
                    ),
                  },
                  {
                    key: 'highlight',
                    label: (
                      <span>
                        <FileTextOutlined />
                        {'高亮文本'}
                      </span>
                    ),
                    children: (
                      <Card size="small" style={{ height: 460, overflow: 'auto' }}>
                        <RuleHighlight text={text} hitSpans={result.hitSpans} />
                      </Card>
                    ),
                  },
                  {
                    key: 'rewrite',
                    label: (
                      <span>
                        <ReloadOutlined />
                        {'改写建议'}
                      </span>
                    ),
                    children: (
                      <Card size="small" style={{ height: 460, overflow: 'auto' }}>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>
                          {result.rewritten}
                        </div>
                        <Divider style={{ margin: '12px 0' }} />
                        <Button
                          icon={<CopyOutlined />}
                          onClick={handleCopyRewrite}
                          disabled={!result.rewritten}
                        >
                          {'复制全部'}
                        </Button>
                      </Card>
                    ),
                  },
                  {
                    key: 'regulations',
                    label: (
                      <span>
                        <BookOutlined />
                        {'关联法规'} ({result.regulations.length})
                      </span>
                    ),
                    children: (
                      <Card size="small" style={{ height: 460, overflow: 'auto' }}>
                        <RegulationPanel
                          regulationIds={result.regulations.map((r) => r.id)}
                          defaultExpanded={result.regulations.length <= 3}
                          title="本次命中法规（点击展开条款全文 + 处罚标准）"
                        />
                      </Card>
                    ),
                  },
                ]}
              />
              </div>
            </div>
          )}
        </Col>
      </Row>

      {/* 法规详情弹窗 */}
      <RegulationModal
        regulation={selectedRegulation}
        open={regModalOpen}
        onClose={() => setRegModalOpen(false)}
      />

      {/* 提交审批弹窗 */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: '#0F2B5B' }} />
            <span>{'提交人工复审'}</span>
          </Space>
        }
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        onOk={handleConfirmSubmit}
        okText={'提交人工复审'}
        cancelText={'取消'}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !!result?.blocked }}
        style={{ width: 520, maxWidth: 'calc(100vw - 32px)' }}
      >
        {/* 复审流程提示 */}
        <Alert
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message={
            <Space size={6} wrap>
              <Tag color="blue" style={{ margin: 0 }}>{'① AI 预审已通过'}</Tag>
              <Text type="secondary">→</Text>
              <Tag color="gold" style={{ margin: 0 }}>{'② 待人工复审'}</Tag>
              <Text type="secondary">→</Text>
              <Tag color="green" style={{ margin: 0 }}>{'③ 进入审批流'}</Tag>
            </Space>
          }
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {'提交后将自动进入"人工复审"环节，由合规岗 / 部门负责人二次审核，AI 预审报告作为参考。'}
            </Text>
          }
          style={{ marginBottom: 16 }}
        />

        {/* 阻断级无法提交 */}
        {result?.blocked && (
          <Alert
            type="error"
            showIcon
            message={'阻断级违规无法提交，请修改文本后重新检测'}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={submitForm} layout="vertical">
          <Form.Item
            name="title"
            label={'审批标题'}
            rules={[{ required: true, message: '请输入审批标题' }]}
          >
            <Input placeholder={'例如：销售合同合规审查'} />
          </Form.Item>
          <Form.Item
            name="approvalType"
            label={'审批类型'}
            initialValue="contract"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'contract', label: t('approval.type.contract') },
                { value: 'document', label: t('approval.type.document') },
                { value: 'reimbursement', label: t('approval.type.reimbursement') },
                { value: 'procurement', label: t('approval.type.procurement') },
                { value: 'travel', label: t('approval.type.travel') },
                { value: 'budget', label: t('approval.type.budget') },
                { value: 'seal', label: t('approval.type.seal') },
              ]}
            />
          </Form.Item>
        </Form>

        {/* 检测结果摘要 */}
        {result && (
          <div style={{ background: '#F7F8FA', borderRadius: 6, padding: 12, fontSize: 12 }}>
            <Text type="secondary">{'检测摘要：'}</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={result.blocked ? 'error' : result.passed ? 'success' : 'warning'}>
                {'评分'} {result.score.toFixed(1)}/5
              </Tag>
              <Tag>{result.issues.length} {'项风险'}</Tag>
              {result.blocked && <Tag color="error">{'含阻断规则'}</Tag>}
            </div>
          </div>
        )}
      </Modal>

      {/* 合规回执弹窗（深化） */}
      <Modal
        title={
          <Space>
            <FileProtectOutlined style={{ color: '#0F2B5B' }} />
            <span>{'合规检查回执'}</span>
          </Space>
        }
        open={receiptModalOpen}
        onCancel={() => setReceiptModalOpen(false)}
        footer={null}
        style={{ width: 880, maxWidth: 'calc(100vw - 32px)' }}
      >
        {receipt && <ComplianceReceiptCard receipt={receipt} />}
      </Modal>
    </div>
  );
};

export default SandboxRunner;
