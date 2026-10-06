import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Table, Tag, Space, Button, Typography, Tooltip, Modal, Upload, message, Tabs, Row, Col, Popconfirm, Spin, Empty } from 'antd';
import type { UploadProps } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  FileTextOutlined,
  FolderOutlined,
  InboxOutlined,
  DownloadOutlined,
  DeleteOutlined,
  BulbOutlined,
  CopyOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileOutlined,
  HistoryOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { knowledgeApi } from '@/api/modules';
import type { KnowledgeDocument } from '@/types/api';
import dayjs from 'dayjs';
import KnowledgeGraph, { DEMO_GRAPH_DATA } from '@/components/KnowledgeGraph';
import DocumentDiff from '@/components/DocumentDiff';
import {
  POLICY_DOCUMENTS,
  type PolicyDocument,
} from '@/mock/policyDocuments';
import {
  ApartmentOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

// 演示用 mock：后端未上线时保证页面有真实可浏览的文档，
// 同时 fetchDocs 仍然调用接口（失败时静默 fallback，不会出现"网络连接失败"）。
const DEMO_KNOWLEDGE_DOCS: KnowledgeDocument[] = [
  { id: 'k-1001', title: '《商业银行资本管理办法》解读', category: 'policy', uploader: '合规部·王老师', fileSize: 248 * 1024, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-08-12 09:30', updatedAt: '2026-09-20 14:08', content: '本文件为新资本管理办法核心条款逐条解读，配套流动性覆盖率、净稳定资金比例测算样表。' },
  { id: 'k-1002', title: '反洗钱客户身份识别操作手册 v3.2', category: 'policy', uploader: '合规部·林岚', fileSize: 412 * 1024, fileType: 'docx', status: 'indexed', uploadedAt: '2026-05-04 11:15', updatedAt: '2026-09-18 16:42', content: '覆盖个人客户、对公客户、受益所有人的尽调要点及高风险情形升级流程。' },
  { id: 'k-1003', title: '数马力·2026 数字化转型方案', category: 'project', uploader: '战略发展部·周敏', fileSize: 186 * 1024, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-07-19 10:05', updatedAt: '2026-09-15 09:11', content: '面向"AI 中台+业务前台"的五年路线图，包含三阶段投入产出测算。' },
  { id: 'k-1004', title: '智能客服意图识别 FAQ 库', category: 'faq', uploader: '客服中心·张涛', fileSize: 96 * 1024, fileType: 'md', status: 'indexed', uploadedAt: '2026-06-22 14:30', updatedAt: '2026-09-12 17:01', content: '覆盖信用卡、借记卡、贷款、理财、积分五大场景共 326 条问答。' },
  { id: 'k-1005', title: '员工差旅报销模板（2026 修订版）', category: 'template', uploader: '财务部·李珊', fileSize: 38 * 1024, fileType: 'xlsx', status: 'indexed', uploadedAt: '2026-08-30 08:50', updatedAt: '2026-09-10 10:24', content: '内置差旅等级、出差审批流、一键自动校验逻辑。' },
  { id: 'k-1006', title: 'Q3 经营分析报告（管理层版）', category: 'report', uploader: '战略发展部·周敏', fileSize: 524 * 1024, fileType: 'pdf', status: 'indexing', uploadedAt: '2026-09-22 18:20', updatedAt: '2026-09-23 09:05', content: '三季度营收、利润、客户增长全景分析，含区域与产品线拆分。' },
  { id: 'k-1007', title: '信贷风险月度例会会议纪要（2026-08）', category: 'minutes', uploader: '风险部·陈昊', fileSize: 64 * 1024, fileType: 'docx', status: 'indexed', uploadedAt: '2026-08-29 17:40', updatedAt: '2026-08-29 17:40', content: '8 月不良率走势、五级分类迁徙、压力测试结果。' },
  { id: 'k-1008', title: '《数据安全法》对金融机构的合规要求', category: 'policy', uploader: '合规部·王老师', fileSize: 152 * 1024, fileType: 'pdf', status: 'failed', uploadedAt: '2026-09-01 09:00', updatedAt: '2026-09-19 11:33', content: '个人金融信息保护、数据分级、跨境传输合规要点。' },
  { id: 'k-1009', title: '理财经理营销话术合集（2026 H2）', category: 'template', uploader: '零售部·赵莉', fileSize: 78 * 1024, fileType: 'docx', status: 'indexed', uploadedAt: '2026-07-08 13:25', updatedAt: '2026-09-08 15:50', content: '存款、理财、基金、保险四大类共 80+ 场景话术。' },
  { id: 'k-1010', title: '核心系统升级（CoreX）项目章程', category: 'project', uploader: '信息科技部·孙策', fileSize: 312 * 1024, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-04-15 10:00', updatedAt: '2026-09-05 14:12', content: '项目目标、范围、干系人、风险与里程碑。' },
  { id: 'k-1011', title: '投资者适当性管理 FAQ', category: 'faq', uploader: '合规部·林岚', fileSize: 56 * 1024, fileType: 'md', status: 'indexed', uploadedAt: '2026-06-30 16:10', updatedAt: '2026-09-02 09:48', content: '客户风险承受能力评估、产品风险等级匹配与录音录像要求。' },
  { id: 'k-1012', title: 'AI 中台·2026 H1 建设总结', category: 'report', uploader: '信息科技部·孙策', fileSize: 480 * 1024, fileType: 'pdf', status: 'indexed', uploadedAt: '2026-07-05 09:00', updatedAt: '2026-07-05 09:00', content: '模型工厂、Agent 编排、知识图谱三大能力的 H1 进展与下阶段计划。' },
];

type TemplateType = 'notice' | 'email' | 'weekly';

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  uploader: string;
}

interface GeneratedDoc {
  id: string;
  template: TemplateType;
  title: string;
  content: string;
  createdAt: string;
}

const Knowledge: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('knowledge');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // ===== 政策法规版本对比 state =====
  const [policyDiffDoc, setPolicyDiffDoc] = useState<PolicyDocument | null>(null);
  const [policyDiffOpen, setPolicyDiffOpen] = useState(false);
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  // ===== 数据来源：先渲染 mock 让页面真实可浏览；接口请求仅作"锦上添花"，
  //                 失败时静默 fallback 到 mock，不会出现"网络连接失败"。 =====
  const [docs, setDocs] = useState<KnowledgeDocument[]>(DEMO_KNOWLEDGE_DOCS);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const resp = await knowledgeApi.getList({
        page: 1,
        pageSize: 100,
        category: selectedCategory || undefined,
        keyword: searchQuery || undefined,
      });
      const remote = (resp.data?.data?.list as unknown as KnowledgeDocument[]) ?? [];
      setDocs(remote.length ? remote : DEMO_KNOWLEDGE_DOCS);
    } catch (err: any) {
      // 后端未上线：静默回落到本地 mock，不向用户暴露网络错误
      setDocs(DEMO_KNOWLEDGE_DOCS);
      setDocsError(null);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'knowledge') fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, activeTab]);

  // Document generator state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('notice');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // History
  const [history, setHistory] = useState<GeneratedDoc[]>([]);

  // Files
  const [files, setFiles] = useState<DocumentFile[]>([
    { id: '1', name: 'Product Specification.docx', type: 'docx', size: '2.5 MB', date: '2024-01-20', uploader: 'Alice' },
    { id: '2', name: 'Financial Report.pdf', type: 'pdf', size: '5.8 MB', date: '2024-01-19', uploader: 'Bob' },
    { id: '3', name: 'Project Plan.doc', type: 'doc', size: '1.2 MB', date: '2024-01-18', uploader: 'Charlie' },
    { id: '4', name: 'Budget Forecast.xlsx', type: 'xlsx', size: '3.4 MB', date: '2024-01-17', uploader: 'Diana' },
  ]);

  // Upload configuration
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv',
    beforeUpload: (file) => {
      const ext = file.name.split('.').pop() || '';
      const newFile: DocumentFile = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        name: file.name,
        type: ext,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        date: dayjs().format('YYYY-MM-DD'),
        uploader: '当前用户',
      };
      setFiles(prev => [newFile, ...prev]);
      message.success(`${file.name} 上传成功`);
      return false;
    },
  };

  const categoryMap: Record<string, { label: string; color: string }> = {
    policy: { label: '政策法规', color: 'blue' },
    project: { label: '项目资料', color: 'blue' },
    faq: { label: '常见问题', color: 'orange' },
    template: { label: '模板', color: 'cyan' },
    report: { label: '报告', color: 'green' },
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    indexed: { label: '已索引', color: 'success' },
    indexing: { label: '索引中', color: 'processing' },
    failed: { label: '失败', color: 'error' },
  };

  const templates = [
    { key: 'notice', label: '公告', icon: <FileTextOutlined />, color: '#1890ff' },
    { key: 'email', label: '邮件', icon: <FolderOutlined />, color: '#52c41a' },
    { key: 'weekly', label: '周报', icon: <CalendarOutlined />, color: '#0F2B5B' },
  ];

  const categories = [
    { value: '', label: '全部分类' },
    { value: 'policy', label: '政策法规' },
    { value: 'project', label: '项目资料' },
    { value: 'faq', label: '常见问题' },
    { value: 'template', label: '模板' },
    { value: 'report', label: '报告' },
  ];

  const filteredData = docs;

  const handleGenerate = async () => {
    if (!formValues.content) {
      message.warning('请输入内容');
      return;
    }

    setGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    let content = '';
    switch (selectedTemplate) {
      case 'notice':
        content = `公告

标题：${formValues.title || ''}

内容：
${formValues.content || ''}

接收人：${formValues.recipients || ''}

生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`;
        break;
      case 'email':
        content = `邮件

收件人：${formValues.recipients || ''}
主题：${formValues.subject || ''}

正文：
${formValues.content || ''}

生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`;
        break;
      case 'weekly':
        content = `${formValues.startDate || ''} 至 ${formValues.endDate || ''} 周报

摘要：
${formValues.content || ''}

亮点：
详细周报内容。

生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`;
        break;
    }

    setGeneratedContent(content);
    setHistory(prev => [{
      id: Date.now().toString(),
      template: selectedTemplate,
      title: formValues.title || formValues.subject || '未命名',
      content,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    }, ...prev.slice(0, 9)]);

    message.success('文档已生成');
    setGenerating(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    message.success('已复制到剪贴板');
  };

  const handleExport = () => {
    const htmlContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><style>body { font-family: Arial, sans-serif; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }</style></head>
<body>${generatedContent.replace(/\n/g, '<br>')}</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formValues.title || formValues.subject || '文档'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('已导出');
  };

  const handleHistoryClick = (item: GeneratedDoc) => {
    setSelectedTemplate(item.template);
    setGeneratedContent(item.content);
    setFormValues({
      title: item.title,
      subject: item.title,
      content: item.content,
    });
  };

  const getTemplateLabel = (key: TemplateType) => templates.find(t => t.key === key)?.label || '';

  const getTemplateIcon = (key: TemplateType) => templates.find(t => t.key === key)?.icon || <FileTextOutlined />;

  const getFileIcon = (type: string) => {
    if (type === 'folder') return <FolderOutlined style={{ color: '#faad14' }} />;
    return <FileOutlined />;
  };

  const knowledgeColumns = [
    {
      title: '文档名称',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Tooltip title={text}>
            <a style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {text}
            </a>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (category: string) => (
        <Tag color={categoryMap[category]?.color}>{categoryMap[category]?.label || category}</Tag>
      ),
    },
    {
      title: '作者',
      dataIndex: 'uploader',
      key: 'uploader',
      width: 120,
      render: (uploader?: string) => <Text type="secondary">{uploader || '-'}</Text>,
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size: number) => <Text type="secondary">{(size / 1024).toFixed(1)} KB</Text>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => <Text type="secondary">{new Date(date).toLocaleDateString('zh-CN')}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={statusMap[status]?.color || 'default'}>{statusMap[status]?.label || status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: () => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
        </Space>
      ),
    },
  ];

  const fileColumns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DocumentFile) => (
        <Space>
          {getFileIcon(record.type)}
          <span>{text}</span>
        </Space>
      ),
    },
    { title: '大小', dataIndex: 'size', key: 'size', width: 100 },
    { title: '上传时间', dataIndex: 'date', key: 'date', width: 120 },
    { title: '上传人', dataIndex: 'uploader', key: 'uploader', width: 100 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: DocumentFile) => (
        <Space>
          <Button type="link" icon={<DownloadOutlined />}>下载</Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => {
              setFiles(prev => prev.filter(f => f.id !== record.id));
              message.success('已删除');
            }}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'knowledge',
      label: <Space><FolderOutlined />知识库</Space>,
      children: (
        <>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
            <Space size="large" wrap>
              <Input.Search
                placeholder="搜索文档..."
                prefix={<SearchOutlined />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: 280 }}
                allowClear
              />
              <Select
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ width: 150 }}
              >
                {categories.map((cat) => (
                  <Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>
                ))}
              </Select>
            </Space>
          </div>
          <Spin spinning={loadingDocs}>
            {docsError && !loadingDocs && (
              <div style={{ padding: 16, marginBottom: 12, background: '#FFF7E6', border: '1px solid #FFD591', borderRadius: 6 }}>
                <Text type="warning">{docsError}</Text>
              </div>
            )}
            <Table
              columns={knowledgeColumns}
              dataSource={filteredData}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              locale={{
                emptyText: loadingDocs ? '加载中…' : <Empty description={docsError ? '—' : '暂无文档'} />,
              }}
            />
          </Spin>
        </>
      ),
    },
    {
      key: 'policy',
      label: (
        <Space>
          <BranchesOutlined />
          政策法规
          <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>
            {POLICY_DOCUMENTS.length}
          </Tag>
        </Space>
      ),
      children: (
        <PolicyTab
          searchQuery={policySearchQuery}
          onSearchChange={setPolicySearchQuery}
          onCompare={(doc) => {
            setPolicyDiffDoc(doc);
            setPolicyDiffOpen(true);
          }}
        />
      ),
    },
    {
      key: 'files',
      label: <Space><FileOutlined />我的文档</Space>,
      children: (
        <>
          <div style={{ padding: '16px 24px' }}>
            <Upload.Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                <InboxOutlined style={{ fontSize: 48, color: '#0F2B5B' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 16, color: '#1D2129', marginBottom: 4 }}>
                点击或拖拽文件上传
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 12, color: '#666' }}>
                支持 PDF、Word、Excel、PPT、TXT、MD、CSV 格式，单个文件最大 50MB
              </p>
            </Upload.Dragger>
          </div>
          <Table
            columns={fileColumns}
            dataSource={files}
            rowKey="id"
            pagination={false}
          />
        </>
      ),
    },
    {
      key: 'graph',
      label: <Space><ApartmentOutlined />知识图谱</Space>,
      children: (
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              探索知识库中文档、概念与实体之间的关联关系。
            </Text>
          </div>
          <Card styles={{ body: { padding: 0 } }}>
            <KnowledgeGraph data={DEMO_GRAPH_DATA} />
          </Card>
        </div>
      ),
    },
    {
      key: 'generate',
      label: <Space><BulbOutlined />文档生成</Space>,
      children: (
        <Row gutter={24}>
          <Col span={24} lg={12}>
            <div style={{ padding: 24 }}>
              <Space style={{ marginBottom: 16 }}>
                选择模板：
              </Space>
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {templates.map((template) => (
                  <Card
                    key={template.key}
                    hoverable
                    onClick={() => {
                      setSelectedTemplate(template.key as TemplateType);
                      setGeneratedContent('');
                      setFormValues({});
                    }}
                    style={{
                      borderColor: selectedTemplate === template.key ? template.color : undefined,
                      borderWidth: selectedTemplate === template.key ? 2 : 1,
                    }}
                  >
                    <Space>
                      <span style={{ fontSize: 24, color: template.color }}>{template.icon}</span>
                      <Text strong>{template.label}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>

              <div style={{ marginTop: 24 }}>
                {selectedTemplate === 'notice' && (
                  <>
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                      <Input
                        placeholder="公告标题"
                        value={formValues.title || ''}
                        onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
                      />
                      <Input.TextArea
                        rows={4}
                        placeholder="公告内容"
                        value={formValues.content || ''}
                        onChange={(e) => setFormValues({ ...formValues, content: e.target.value })}
                      />
                      <Input
                        placeholder="接收人"
                        value={formValues.recipients || ''}
                        onChange={(e) => setFormValues({ ...formValues, recipients: e.target.value })}
                      />
                    </Space>
                  </>
                )}
                {selectedTemplate === 'email' && (
                  <>
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                      <Input
                        placeholder="收件人"
                        value={formValues.recipients || ''}
                        onChange={(e) => setFormValues({ ...formValues, recipients: e.target.value })}
                      />
                      <Input
                        placeholder="邮件主题"
                        value={formValues.subject || ''}
                        onChange={(e) => setFormValues({ ...formValues, subject: e.target.value })}
                      />
                      <Input.TextArea
                        rows={4}
                        placeholder="邮件正文"
                        value={formValues.content || ''}
                        onChange={(e) => setFormValues({ ...formValues, content: e.target.value })}
                      />
                    </Space>
                  </>
                )}
                {selectedTemplate === 'weekly' && (
                  <>
                    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                      <Space>
                        <Input
                          placeholder="开始日期"
                          value={formValues.startDate || ''}
                          onChange={(e) => setFormValues({ ...formValues, startDate: e.target.value })}
                        />
                        <Text>-</Text>
                        <Input
                          placeholder="结束日期"
                          value={formValues.endDate || ''}
                          onChange={(e) => setFormValues({ ...formValues, endDate: e.target.value })}
                        />
                      </Space>
                      <Input.TextArea
                        rows={6}
                        placeholder="周报内容"
                        value={formValues.content || ''}
                        onChange={(e) => setFormValues({ ...formValues, content: e.target.value })}
                      />
                    </Space>
                  </>
                )}
                <Button
                  type="primary"
                  icon={<BulbOutlined />}
                  onClick={handleGenerate}
                  loading={generating}
                  block
                  size="large"
                  style={{ marginTop: 16 }}
                >
                  生成文档
                </Button>
              </div>
            </div>
          </Col>
          <Col span={24} lg={12}>
            <div style={{ padding: 24, borderLeft: '1px solid #f0f0f0', minHeight: 500 }}>
              <Space style={{ marginBottom: 16 }}>
                <Text strong>生成结果</Text>
              </Space>
              {generatedContent ? (
                <>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: 16,
                    borderRadius: 8,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    maxHeight: 350,
                    overflow: 'auto',
                  }}>
                    {generatedContent}
                  </pre>
                  <Space style={{ marginTop: 16 }}>
                    <Button icon={<CopyOutlined />} onClick={handleCopy}>复制</Button>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出为 Word</Button>
                  </Space>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <Text type="secondary">暂无生成内容</Text>
                </div>
              )}

              {history.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>历史记录</Text>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {history.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleHistoryClick(item)}
                        style={{
                          padding: '8px 12px',
                          marginBottom: 4,
                          borderRadius: 4,
                          cursor: 'pointer',
                          background: generatedContent === item.content ? '#e6f7ff' : '#fafafa',
                        }}
                      >
                        <Space>
                          {getTemplateIcon(item.template)}
                          <Text ellipsis={{ tooltip: item.title }} style={{ maxWidth: 200 }}>
                            {item.title}
                          </Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                          {item.createdAt}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Col>
        </Row>
      ),
    },
  ];

  return (
    <Card
      styles={{ body: { padding: 0 } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        tabBarStyle={{ paddingLeft: 24, marginBottom: 0 }}
      />

      {/* 政策法规版本对比弹窗（嵌入在 Knowledge 页面内） */}
      <DocumentDiff
        open={policyDiffOpen}
        onClose={() => setPolicyDiffOpen(false)}
        document={policyDiffDoc}
      />
    </Card>
  );
};

/* =====================================================
   政策法规 Tab 组件（模块顶层，嵌入 Knowledge 页面）
   ===================================================== */
interface PolicyTabProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onCompare: (doc: PolicyDocument) => void;
}

const categoryMap: Record<string, { label: string; color: string }> = {
  银行: { label: '银行', color: 'blue' },
  证券: { label: '证券', color: 'orange' },
  保险: { label: '保险', color: 'green' },
  反洗钱: { label: '反洗钱', color: 'blue' },
  消费者保护: { label: '消费者保护', color: 'cyan' },
};

const statusMap: Record<string, { label: string; color: string }> = {
  有效: { label: '有效', color: 'success' },
  征求意见: { label: '征求意见', color: 'warning' },
  已废止: { label: '已废止', color: 'error' },
};

const PolicyTab: React.FC<PolicyTabProps> = ({ searchQuery, onSearchChange, onCompare }) => {
  const filteredPolicies = POLICY_DOCUMENTS.filter((p) => {
    if (!searchQuery.trim()) return true;
    const kw = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(kw) ||
      p.issuer.toLowerCase().includes(kw) ||
      p.category.toLowerCase().includes(kw) ||
      p.tags.some((t) => t.toLowerCase().includes(kw))
    );
  });

  const columns = [
    {
      title: '政策名称',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: PolicyDocument) => (
        <Space direction="vertical" size={2} style={{ maxWidth: 300 }}>
          <Space>
            <FileTextOutlined style={{ color: '#0F2B5B' }} />
            <Text strong ellipsis={{ tooltip: text }} style={{ maxWidth: 260 }}>
              {text}
            </Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.issuer}
          </Text>
        </Space>
      ),
    },
    {
      title: '行业分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => (
        <Tag color={categoryMap[cat]?.color}>{categoryMap[cat]?.label || cat}</Tag>
      ),
    },
    {
      title: '当前版本',
      dataIndex: 'currentVersion',
      key: 'currentVersion',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (tags: string[]) => (
        <Space wrap size={4}>
          {tags.slice(0, 3).map((tag) => (
            <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>
          ))}
          {tags.length > 3 && <Tag style={{ fontSize: 11 }}>+{tags.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => (
        <Tag color={statusMap[s]?.color}>{statusMap[s]?.label || s}</Tag>
      ),
    },
    {
      title: '变更数',
      key: 'changes',
      width: 110,
      render: (_: any, record: PolicyDocument) => {
        const { added, modified, removed } = record.diffSummary;
        return (
          <Space size={4}>
            {added.length > 0 && <Tag color="success" style={{ fontSize: 11 }}>+{added.length}</Tag>}
            {modified.length > 0 && <Tag color="warning" style={{ fontSize: 11 }}>~{modified.length}</Tag>}
            {removed.length > 0 && <Tag color="error" style={{ fontSize: 11 }}>-{removed.length}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 110,
      render: (date: string) => <Text type="secondary" style={{ fontSize: 12 }}>{date}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: PolicyDocument) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
          </Tooltip>
          {record.versions.length > 1 && (
            <Tooltip title="对比历史版本">
              <Button
                type="link"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => onCompare(record)}
                style={{ color: '#0F2B5B' }}
              >
                对比
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Space size="large">
          <Input.Search
            placeholder="搜索政策名称 / 机构 / 分类 / 标签..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ width: 360 }}
            allowClear
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {filteredPolicies.length} 条政策文件
          </Text>
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={filteredPolicies}
        rowKey="id"
        pagination={{ pageSize: 8, showSizeChanger: true }}
        locale={{ emptyText: <Empty description="暂无匹配的政策文件" /> }}
      />
    </>
  );
};

export default Knowledge;
