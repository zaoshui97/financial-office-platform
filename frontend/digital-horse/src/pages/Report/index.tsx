import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Space,
  Typography,
  Tag,
  Button,
  Steps,
  Select,
  Input,
  DatePicker,
  App,
  Progress,
  Divider,
  Empty,
  Tooltip,
  Upload,
  message,
  Modal,
  Alert,
} from 'antd';
import {
  FileTextOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  PrinterOutlined,
  CopyOutlined,
  ReloadOutlined,
  UploadOutlined,
  RobotOutlined,
  BarChartOutlined,
  RiseOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  LeftOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { checkCompliance } from '@/services/sandbox/sandboxApiContract';
import {
  ANNOUNCEMENT_DEMO_INPUTS,
  draftAnnouncement,
} from '@/mock/announcementDemo';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface ReportTemplate {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  fields: string[];
  defaultFields: Record<string, string>;
}

interface GenerationStep {
  title: string;
  status: 'wait' | 'process' | 'finish' | 'error';
  duration?: string;
}

interface GeneratedReport {
  title: string;
  sections: Array<{
    title: string;
    content: string;
    type: 'text' | 'table' | 'chart';
  }>;
  generatedAt: string;
  wordCount: number;
}

const ReportGenerator: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: msg } = App.useApp();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0); // 0=选择模板, 1=填写参数, 2=生成中, 3=完成
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  // 研报违规 → 沙箱改写：阻断弹窗状态
  const [reportBlock, setReportBlock] = useState<null | { score: number; issues: number; rule: string }>(null);
  const [exporting, setExporting] = useState(false);

  const templates: ReportTemplate[] = [
    {
      key: 'industry',
      name: '行业分析报告',
      description: '深度分析特定行业的市场格局、竞争态势与发展趋势',
      icon: <BankOutlined style={{ fontSize: 28, color: '#1a56db' }} />,
      color: '#1a56db',
      fields: ['industry', 'region', 'scope', 'targetDate', 'focusAreas', 'dataSources'],
      defaultFields: {},
    },
    {
      key: 'market',
      name: '市场周报/月报',
      description: '快速生成市场动态、数据统计与下周展望',
      icon: <BarChartOutlined style={{ fontSize: 28, color: '#22A775' }} />,
      color: '#22A775',
      fields: ['reportType', 'period', 'dataSources', 'keyMetrics'],
      defaultFields: {},
    },
    {
      key: 'investment',
      name: '投资分析框架',
      description: '系统化评估投资标的，构建逻辑严谨的分析模板',
      icon: <RiseOutlined style={{ fontSize: 28, color: '#C9A459' }} />,
      color: '#C9A459',
      fields: ['target', 'assetType', 'scope', 'riskLevel', 'focusAreas'],
      defaultFields: {},
    },
    {
      key: 'regulatory',
      name: '合规审查报告',
      description: '基于监管政策对企业行为进行全面合规评估',
      icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#D64045' }} />,
      color: '#D64045',
      fields: ['department', 'scope', 'regulationRef', 'riskAreas'],
      defaultFields: {},
    },
    {
      key: 'meeting',
      name: '会议纪要整理',
      description: '根据会议记录自动生成结构化会议纪要与待办',
      icon: <FileTextOutlined style={{ fontSize: 28, color: '#722ED1' }} />,
      color: '#722ED1',
      fields: ['meetingTopic', 'meetingDate', 'attendees', 'transcript', 'keyDecisions'],
      defaultFields: {},
    },
    {
      key: 'announcement',
      name: '公告',
      description: '把会议结论或口播整理为公司公告文（演示：一键看到 AI 润色前后差异）',
      icon: <NotificationOutlined style={{ fontSize: 28, color: '#0F766E' }} />,
      color: '#0F766E',
      fields: ['rawInput', 'audience', 'channel', 'issuer'],
      defaultFields: {},
    },
  ];

  const fieldLabels: Record<string, string> = {
    industry: '目标行业',
    region: '目标地区',
    scope: '分析范围',
    targetDate: '截止日期',
    focusAreas: '重点关注领域',
    dataSources: '数据来源',
    reportType: '报告类型',
    period: '统计周期',
    keyMetrics: '关键指标',
    target: '投资标的',
    assetType: '资产类型',
    riskLevel: '风险等级',
    department: '部门',
    regulationRef: '参考法规',
    riskAreas: '风险领域',
    meetingTopic: '会议主题',
    meetingDate: '会议日期',
    attendees: '参会人员',
    transcript: '会议记录',
    keyDecisions: '关键决策',
    rawInput: '原始输入（口播 / 会议结论）',
    audience: '接收对象',
    channel: '发布渠道',
    issuer: '发文部门',
  };

  const handleSelectTemplate = (key: string) => {
    const template = templates.find((t) => t.key === key);
    if (!template) return;
    setSelectedTemplate(key);
    const defaults: Record<string, string> = {};
    template.fields.forEach((f) => {
      defaults[f] = '';
    });
    setFormValues(defaults);
  };

  const handleGenerate = () => {
    setStep(2);
    const template = templates.find((t) => t.key === selectedTemplate);
    const steps: GenerationStep[] = [
      { title: '数据收集', status: 'wait' },
      { title: '内容撰写', status: 'wait' },
      { title: '图表生成', status: 'wait' },
      { title: '格式排版', status: 'wait' },
    ];
    setGenerationSteps(steps);
    setProgress(0);

    let currentStep = 0;
    const stepDurations = [2500, 3000, 2000, 1500];

    const runStep = (idx: number) => {
      if (idx >= steps.length) {
        // 完成
        setTimeout(() => {
          setGenerationSteps((prev) =>
            prev.map((s, i) => ({
              ...s,
              status: 'finish' as const,
              duration: `${(stepDurations[i] / 1000).toFixed(1)}s`,
            }))
          );
          setProgress(100);
          setGeneratedReport(generateMockReport(template!));
          setStep(3);
        }, 500);
        return;
      }

      setGenerationSteps((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, status: 'process' as const } : i < idx ? { ...s, status: 'finish' as const } : s
        )
      );

      const interval = setInterval(() => {
        setProgress((prev) => {
          const targetProgress = Math.round(((idx + 1) / steps.length) * 100);
          if (prev < targetProgress) return prev + 2;
          clearInterval(interval);
          return targetProgress;
        });
      }, 50);

      setTimeout(() => {
        clearInterval(interval);
        setProgress(Math.round(((idx + 1) / steps.length) * 100));
        runStep(idx + 1);
      }, stepDurations[idx]);
    };

    runStep(0);
  };

  // 导出前先做合规沙箱检测，命中阻断级违规时弹窗 + 提供"跳转沙箱改写"入口
  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!generatedReport) return;
    setExporting(true);
    const hide = msg.loading(`正在为「${generatedReport.title}」执行合规沙箱检测…`, 0);
    try {
      // 把报告拼成纯文本送沙箱
      const reportText =
        `${generatedReport.title}\n\n` +
        generatedReport.sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
      const result = await checkCompliance({ text: reportText, source: 'report' });

      hide();

      if (result.blocked) {
        const blockIssues = result.issues.filter((i) => i.severity === 'block');
        const topRule = blockIssues[0]?.ruleName || '阻断级违规';
        setReportBlock({
          score: result.score,
          issues: blockIssues.length,
          rule: topRule,
        });
        return;
      }

      // 通过则模拟导出
      msg.loading(`正在导出为 ${format.toUpperCase()}...`, 1.5);
      setTimeout(() => {
        msg.success(`报告已导出为 ${format.toUpperCase()} 格式`);
      }, 1500);
    } catch (e: any) {
      hide();
      msg.error(`沙箱检测失败：${e?.message || '未知错误'}`);
    } finally {
      setExporting(false);
    }
  };

  // 跳转沙箱改写，把违规报告文本传过去
  const handleGotoSandboxRewrite = () => {
    if (!generatedReport) return;
    const reportText =
      `${generatedReport.title}\n\n` +
      generatedReport.sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
    navigate('/sandbox', {
      state: {
        initialText: reportText,
        source: 'meeting_report', // 复用 SandboxRunner 已有 source 类型
        approvalTitle: generatedReport.title,
      },
    });
    setReportBlock(null);
  };

  const handleCopyContent = () => {
    if (generatedReport) {
      const text = generatedReport.sections.map((s) => `${s.title}\n${s.content}`).join('\n\n');
      navigator.clipboard.writeText(text).then(
        () => msg.success('已复制到剪贴板'),
        () => msg.error('复制失败')
      );
    }
  };

  const handleRegenerate = () => {
    setStep(2);
    setGeneratedReport(null);
    setProgress(0);
    setTimeout(() => handleGenerate(), 500);
  };

  const renderTemplateSelection = () => (
    <div>
      <Title level={4} style={{ marginBottom: 8 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        选择报告模板
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        选择您需要生成的报告类型，AI 将自动收集数据并生成结构化报告
      </Text>
          <Row gutter={[20, 20]} wrap={false} style={{ marginLeft: -10, marginRight: -10 }}>
            {templates.map((template) => (
              <Col flex="1 1 0" key={template.key} style={{ paddingLeft: 10, paddingRight: 10 }}>
                <Card
                  hoverable
                  onClick={() => handleSelectTemplate(template.key)}
                  style={{
                    height: '100%',
                    borderColor: selectedTemplate === template.key ? template.color : undefined,
                    borderWidth: selectedTemplate === template.key ? 2 : 1,
                    borderRadius: 12,
                    transition: 'all 0.2s',
                  }}
                  styles={{
                    body: { padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' },
                  }}
                >
                  <div style={{ marginBottom: 12 }}>{template.icon}</div>
                  <Title level={5} style={{ margin: '0 0 4px', textAlign: 'center' }}>{template.name}</Title>
                  <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', flex: 1 }}>
                    {template.description}
                  </Text>
                  {template.key === 'announcement' && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '3px 10px',
                        background: '#ECFDF5',
                        color: '#047857',
                        fontSize: 12,
                        borderRadius: 999,
                      }}
                    >
                      演示：可见输入 → AI 输出对比
                    </div>
                  )}
                  <Tag
                    color={selectedTemplate === template.key ? template.color : 'default'}
                    style={{ marginTop: 'auto', paddingTop: 4, paddingBottom: 4 }}
                  >
                    {selectedTemplate === template.key ? '已选择' : '点击选择'}
                  </Tag>
                </Card>
              </Col>
            ))}
          </Row>
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="large"
          icon={<ThunderboltOutlined />}
          disabled={!selectedTemplate}
          onClick={() => setStep(1)}
          style={{ minWidth: 160 }}
        >
          开始生成
        </Button>
      </div>
    </div>
  );

  const renderParameterForm = () => {
    const template = templates.find((t) => t.key === selectedTemplate);
    if (!template) return null;

    return (
      <div>
        <Title level={4} style={{ marginBottom: 8 }}>
          <EditOutlined style={{ marginRight: 8 }} />
          填写报告参数
        </Title>
        <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
          提供报告生成所需的关键信息，AI 将基于这些信息生成个性化报告
        </Text>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[24, 16]}>
            {template.fields.map((field) => (
              <Col span={field === 'transcript' || field === 'keyDecisions' || field === 'focusAreas' ? 24 : 12} key={field}>
                {field === 'transcript' || field === 'keyDecisions' || field === 'focusAreas' ? (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <TextArea
                      rows={4}
                      placeholder={
                        field === 'transcript'
                          ? '请粘贴会议记录内容...'
                          : field === 'focusAreas'
                          ? '例如：市场竞争格局、核心技术壁垒、政策环境影响...'
                          : '请输入关键决策内容...'
                      }
                      value={formValues[field] || ''}
                      onChange={(e) => setFormValues({ ...formValues, [field]: e.target.value })}
                    />
                  </div>
                ) : field === 'period' || field === 'targetDate' || field === 'meetingDate' ? (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <DatePicker style={{ width: '100%' }} />
                  </div>
                ) : field === 'scope' ? (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择分析范围"
                      options={[
                        { label: '全球', value: 'global' },
                        { label: '全国', value: 'national' },
                        { label: '地区（华东/华南/华北等）', value: 'regional' },
                        { label: '细分市场', value: 'niche' },
                      ]}
                    />
                  </div>
                ) : field === 'riskLevel' ? (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择风险等级"
                      options={[
                        { label: '保守型（低风险）', value: 'low' },
                        { label: '稳健型（中等风险）', value: 'medium' },
                        { label: '进取型（高风险）', value: 'high' },
                      ]}
                    />
                  </div>
                ) : field === 'reportType' ? (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择报告类型"
                      options={[
                        { label: '周报（本周汇总）', value: 'weekly' },
                        { label: '月报（本月汇总）', value: 'monthly' },
                        { label: '季报（季度分析）', value: 'quarterly' },
                      ]}
                    />
                  </div>
                ) : field === 'assetType' ? (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <Select
                      style={{ width: '100%' }}
                      placeholder="选择资产类型"
                      options={[
                        { label: '股票', value: 'stock' },
                        { label: '债券', value: 'bond' },
                        { label: '基金', value: 'fund' },
                        { label: '期货', value: 'futures' },
                        { label: '另类投资', value: 'alternative' },
                      ]}
                    />
                  </div>
                ) : (
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      {fieldLabels[field] || field}
                    </Text>
                    <Input
                      placeholder={
                        field === 'industry'
                          ? '例如：公募基金、证券、期货'
                          : field === 'target'
                          ? '例如：某某基金、某某上市公司'
                          : field === 'department'
                          ? '例如：风控部、合规部'
                          : `请输入${fieldLabels[field] || field}`
                      }
                      value={formValues[field] || ''}
                      onChange={(e) => setFormValues({ ...formValues, [field]: e.target.value })}
                    />
                  </div>
                )}
              </Col>
            ))}
          </Row>
        </Card>

        {/* 数据来源上传 */}
        <Card
          title="补充材料（可选）"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>支持 PDF/Word/Excel 格式</Text>}
          style={{ marginBottom: 24 }}
        >
          <Upload.Dragger
            name="files"
            multiple
            beforeUpload={() => {
              msg.success('文件已添加');
              return false;
            }}
          >
            <p style={{ margin: 0 }}>
              <UploadOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
            </p>
            <Text>点击或拖拽上传参考文件</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              AI 将结合上传文件内容生成报告
            </Text>
          </Upload.Dragger>
        </Card>

        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button size="large" onClick={() => setStep(0)}>
            返回
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={handleGenerate}
            style={{ minWidth: 160 }}
          >
            开始生成
          </Button>
        </Space>
      </div>
    );
  };

  const renderGenerating = () => (
    <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
      <div style={{ marginBottom: 32 }}>
        <RobotOutlined style={{ fontSize: 64, color: '#1a56db', marginBottom: 16 }} />
        <Title level={3}>AI 正在生成报告</Title>
        <Text type="secondary" style={{ fontSize: 15 }}>
          系统正在自动收集数据、分析内容并撰写报告，请稍候...
        </Text>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Steps
          current={generationSteps.findIndex((s) => s.status === 'process')}
          items={generationSteps.map((s) => ({
            title: s.title,
            status: s.status,
            description:
              s.status === 'finish' && s.duration ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  完成 · {s.duration}
                </Text>
              ) : s.status === 'process' ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  进行中...
                </Text>
              ) : undefined,
          }))}
        />
      </Card>

      <Card>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <Text strong>生成进度</Text>
          <Text type="secondary">{progress}%</Text>
        </div>
        <Progress percent={progress} status="active" strokeColor="#1a56db" size="small" />
        <Text type="secondary" style={{ fontSize: 12 }}>
          预计剩余时间：约 {Math.max(1, Math.round((100 - progress) * 0.3))} 秒
        </Text>
      </Card>
    </div>
  );

  const renderResult = () => {
    if (!generatedReport) return null;
    const template = templates.find((t) => t.key === selectedTemplate);

    return (
      <div>
        {/* 操作栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            padding: '12px 16px',
            background: '#f9fbfd',
            borderRadius: 8,
            border: '1px solid #e8edf4',
          }}
        >
          <Space>
            <CheckCircleOutlined style={{ color: '#22A775', fontSize: 18 }} />
            <div>
              <Text strong style={{ display: 'block' }}>{generatedReport.title}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {generatedReport.generatedAt} · {generatedReport.wordCount} 字
              </Text>
            </div>
          </Space>
          <Space>
            <Button
              icon={<LeftOutlined />}
              onClick={() => {
                setStep(0);
                setSelectedTemplate(null);
                setFormValues({});
                setGeneratedReport(null);
                setProgress(0);
                setPreviewMode(false);
              }}
            >
              {'返回初始页'}
            </Button>
            <Tooltip title="重新生成">
              <Button icon={<ReloadOutlined />} onClick={handleRegenerate}>
                重新生成
              </Button>
            </Tooltip>
            <Button icon={<CopyOutlined />} onClick={handleCopyContent}>
              复制
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => msg.info('打印功能开发中')}>
              打印
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExport('docx')} loading={exporting}>
              导出 Word
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => handleExport('pdf')} loading={exporting}>
              导出 PDF
            </Button>
          </Space>
        </div>

        {/* 报告内容 */}
        <Row gutter={24}>
          <Col span={previewMode ? 24 : 18}>
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>报告内容</span>
                  <Tag color="blue">{template?.name}</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button
                    size="small"
                    type={previewMode ? 'primary' : 'default'}
                    onClick={() => setPreviewMode(true)}
                  >
                    阅读视图
                  </Button>
                  <Button
                    size="small"
                    type={!previewMode ? 'primary' : 'default'}
                    onClick={() => setPreviewMode(false)}
                  >
                    编辑视图
                  </Button>
                </Space>
              }
            >
              {generatedReport.sections.map((section, idx) => (
                <div key={idx} style={{ marginBottom: 32 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: '2px solid #1a56db',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 4, height: 16, background: '#1a56db', borderRadius: 2 }} />
                    {section.title}
                  </div>
                  <Paragraph
                    style={{
                      fontSize: 14,
                      lineHeight: 1.8,
                      color: '#374151',
                      whiteSpace: 'pre-wrap',
                      background: previewMode ? '#f9fafb' : undefined,
                      padding: previewMode ? 16 : undefined,
                      borderRadius: previewMode ? 8 : undefined,
                    }}
                  >
                    {section.content}
                  </Paragraph>
                </div>
              ))}
            </Card>
          </Col>

          {!previewMode && (
            <Col span={6}>
              <Card title="报告概览" size="small" style={{ position: 'sticky', top: 24 }}>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>报告类型</Text>
                  <div>
                    <Tag color={template?.color}>{template?.name}</Tag>
                  </div>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>字数统计</Text>
                  <div>
                    <Text strong>{generatedReport.wordCount}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}> 字</Text>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>章节数量</Text>
                  <div>
                    <Text strong>{generatedReport.sections.length}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}> 个</Text>
                  </div>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>生成时间</Text>
                <div>
                  <Text>{generatedReport.generatedAt}</Text>
                </div>
              </Card>
            </Col>
          )}
        </Row>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      {/* 顶部进度指示 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps
          current={step}
          items={[
            { title: '选择模板', icon: <FileTextOutlined /> },
            { title: '填写参数', icon: <EditOutlined /> },
            { title: 'AI 生成', icon: <RobotOutlined /> },
            { title: '查看结果', icon: <CheckCircleOutlined /> },
          ]}
        />
      </Card>

      {/* 主内容 */}
      <Card>
        {step === 0 && renderTemplateSelection()}
        {step === 1 && renderParameterForm()}
        {step === 2 && renderGenerating()}
        {step === 3 && renderResult()}
      </Card>

      {/* 研报违规 → 沙箱改写 联动弹窗 */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#DC2626' }} />
            <span>{'研报命中阻断级违规，已拦截导出'}</span>
          </Space>
        }
        open={!!reportBlock}
        onCancel={() => setReportBlock(null)}
        footer={null}
        style={{ width: 520, maxWidth: 'calc(100vw - 32px)' }}
        destroyOnHidden
      >
        {reportBlock && (
          <>
            <Alert
              type="error"
              showIcon
              message={
                <Space size={6} wrap>
                  <Text strong>{`命中 ${reportBlock.issues} 条阻断规则`}</Text>
                  <Tag color="red">{`评分 ${reportBlock.score.toFixed(1)}/5`}</Tag>
                </Space>
              }
              description={`主要规则：${reportBlock.rule}。请先在沙箱中改写后再导出。`}
              style={{ marginBottom: 16 }}
            />
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setReportBlock(null)}>{'暂不导出'}</Button>
              <Button type="primary" danger icon={<EditOutlined />} onClick={handleGotoSandboxRewrite}>
                {'跳转沙箱改写'}
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 11, marginTop: 12, display: 'block' }}>
              {'跳转后报告全文将自动填入沙箱输入框，AI 提供改写建议，修改完成后可返回原页面继续导出。'}
            </Text>
          </>
        )}
      </Modal>
    </div>
  );
};

function generateMockReport(template: ReportTemplate): GeneratedReport {
  const now = new Date().toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (template.key === 'announcement') {
    // 取第一个演示输入，调用 draftAnnouncement 生成正文
    const demo = ANNOUNCEMENT_DEMO_INPUTS[0];
    const { text, rationale } = draftAnnouncement({
      input: demo.input,
      audience: demo.audience,
      channel: demo.channel,
      issuer: demo.issuer,
    });
    return {
      title: '关于落实银保监会合规整改要求的通知',
      generatedAt: now,
      wordCount: text.length,
      sections: [
        {
          title: '一、原始输入（会议结论 / 口播稿）',
          content: demo.input,
          type: 'text',
        },
        {
          title: '二、AI 润色后的公告文',
          content: text,
          type: 'text',
        },
        {
          title: '三、AI 做了什么',
          content: rationale,
          type: 'text',
        },
      ],
    };
  }

  if (template.key === 'industry') {
    return {
      title: '公募基金行业 2026 年第三季度分析报告',
      generatedAt: now,
      wordCount: 4820,
      sections: [
        {
          title: '一、行业概述',
          content: `2026 年第三季度，公募基金行业继续保持稳健发展态势。截至报告期末，全市场公募基金资产管理规模达到 28.6 万亿元，较上季度末增长 5.3%，创历史新高。

从产品结构来看，权益类基金规模占比回升至 32.4%，较二季度提升 2.1 个百分点；固定收益类产品占比稳定在 48.7%；指数基金与 ETF 延续快速增长趋势，规模突破 2.1 万亿元。

从竞争格局来看，头部效应持续强化。前十大基金管理公司管理规模合计占比达到 68.5%，行业集中度进一步提升。中小基金公司积极探索差异化发展路径，部分公司在细分领域取得突破。`,
          type: 'text',
        },
        {
          title: '二、市场竞争格局',
          content: `头部基金公司凭借渠道优势和品牌效应，持续扩大市场份额。易方达、华夏、广发等头部机构通过丰富产品矩阵和强化投研实力，巩固领先优势。

值得关注的是，部分中型基金公司通过特色化经营实现规模增长。如专注量化策略的天弘基金、聚焦 ESG 投资的南方基金等，在细分领域建立了差异化竞争优势。

从竞争策略看，各基金公司普遍加大科技投入，智能投顾、基金投顾等创新业务成为重要发展方向。线上渠道占比持续提升，部分公司线上直销规模已超过代销渠道。`,
          type: 'text',
        },
        {
          title: '三、监管政策动态',
          content: `本季度监管政策延续"扶优限劣"导向，对行业发展产生深远影响：

1. **基金销售管理办法修订**：进一步规范基金销售行为，强化投资者适当性管理，要求销售机构完善客户风险评估体系。

2. **基金投顾业务规范**：明确了基金投顾服务的收费标准、服务内容、信息披露等要求，推动基金投顾业务健康发展。

3. **基金行业ESG投资指引**：鼓励基金管理人将 ESG 因素纳入投资决策流程，引导行业践行可持续发展理念。

总体来看，监管政策有利于行业长期健康发展，推动基金管理机构提升专业能力和服务水平。`,
          type: 'text',
        },
        {
          title: '四、发展趋势与展望',
          content: `展望下一季度，公募基金行业呈现以下发展趋势：

**1. 产品创新持续深化**
ETF 产品线持续丰富，涵盖行业主题、策略因子、跨境资产等多个维度。养老目标基金发行提速，个人养老金账户投资基金产品货架进一步完善。

**2. 数字化转型加速**
AI 技术在投研、客服、风控等领域的应用不断深化。部分公司已实现 AI 辅助投资决策、智能化客户服务、自动化合规检查等场景落地。

**3. 国际化步伐加快**
QDII 基金和港股通基金规模稳步增长，头部基金公司积极布局海外市场，跨境业务成为新的增长点。

**4. 差异化竞争加剧**
中小基金公司聚焦特定客户群体或投资策略，通过专业化、特色化发展构建竞争壁垒。`,
          type: 'text',
        },
        {
          title: '五、风险提示',
          content: `1. 市场风险：全球宏观经济不确定性上升，资本市场波动可能加大，对基金投资收益产生影响。

2. 流动性风险：部分债券基金和封闭式基金面临流动性管理压力。

3. 合规风险：监管政策持续收紧，合规成本上升。

4. 技术风险：数字化转型过程中面临系统安全和数据保护挑战。

投资者应根据自身风险承受能力合理配置基金产品，理性看待投资收益与风险。`,
          type: 'text',
        },
      ],
    };
  }

  return {
    title: `${template.name} - AI 生成报告`,
    generatedAt: now,
    wordCount: 3200,
    sections: [
      {
        title: '一、执行摘要',
        content: `本报告由 AI 智能生成，基于您提供的信息和公开数据。报告涵盖关键发现、分析结论及建议，可作为决策参考。

AI 在生成过程中综合分析了相关数据源，并结合行业最佳实践进行了结构化输出。建议结合实际情况对报告内容进行审阅和调整。`,
        type: 'text',
      },
      {
        title: '二、主要内容',
        content: `根据您选择的"${template.name}"模板，AI 已完成内容生成。主要包括：

• 关键数据收集与整理
• 行业/市场分析
• 风险评估
• 建议与结论

具体内容可根据模板类型进一步细化。建议点击"导出 Word"获取完整报告，或点击"重新生成"调整参数后重新生成。`,
        type: 'text',
      },
    ],
  };
}

export default ReportGenerator;
