import React, { useState, useEffect } from 'react';
import { Alert, Card, Input, Select, Table, Tag, Space, Button, Typography, Tooltip, Modal, Upload, message, Tabs, Row, Col, Popconfirm, Spin, Empty, Descriptions } from 'antd';
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
import { ragApi } from '@/api/rag';
import type { DocumentNormalization, KnowledgeBase, RagDocument, RagDocumentContent } from '@/api/rag';
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

type TemplateType = 'notice' | 'email' | 'weekly';

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

  // ===== 真实知识库数据 =====
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | null>(null);
  const [docs, setDocs] = useState<RagDocument[]>([]);
  const [normalizations, setNormalizations] = useState<Record<number, DocumentNormalization>>({});
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [indexingDocumentId, setIndexingDocumentId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDocument, setDetailDocument] = useState<RagDocumentContent | null>(null);
  const [detailNormalization, setDetailNormalization] = useState<DocumentNormalization | null>(null);

  const fetchDocs = async (knowledgeBaseId = selectedKnowledgeBaseId) => {
    if (!knowledgeBaseId) {
      setDocs([]);
      return;
    }
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const remote = await ragApi.listDocuments(knowledgeBaseId);
      setDocs(remote);
      const results = await Promise.allSettled(remote.map((doc) => ragApi.getNormalization(doc.id)));
      const next: Record<number, DocumentNormalization> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') next[result.value.document_id] = result.value;
      });
      setNormalizations(next);
    } catch {
      setDocs([]);
      setDocsError('真实知识库加载失败，请确认后端服务和登录状态。');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setLoadingDocs(true);
      setDocsError(null);
      try {
        let bases = await ragApi.listKnowledgeBases();
        if (bases.length === 0) {
          const created = await ragApi.createKnowledgeBase({
            name: '企业知识库',
            description: '用于公司制度、业务材料和内部知识的检索与引用',
          });
          bases = [created];
        }
        setKnowledgeBases(bases);
        setSelectedKnowledgeBaseId(bases[0].id);
        await fetchDocs(bases[0].id);
      } catch {
        setDocsError('无法初始化真实知识库，请确认后端服务和登录状态。');
      } finally {
        setLoadingDocs(false);
      }
    };
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Document generator state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('notice');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // History
  const [history, setHistory] = useState<GeneratedDoc[]>([]);

  // Upload configuration
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: '.pdf,.docx,.txt',
    disabled: uploading || !selectedKnowledgeBaseId,
    beforeUpload: (file) => {
      const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
      if (!['.pdf', '.docx', '.txt'].includes(extension)) {
        message.error('仅支持 PDF、DOCX 和 TXT 文件');
        return Upload.LIST_IGNORE;
      }
      if (file.size > 20 * 1024 * 1024) {
        message.error('单个文件不能超过 20MB');
        return Upload.LIST_IGNORE;
      }
      if (!selectedKnowledgeBaseId) {
        message.error('知识库尚未就绪，请稍后重试');
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      void ragApi.uploadDocument(selectedKnowledgeBaseId, file as File)
        .then(async (document) => {
          const normalization = await ragApi.getNormalization(document.id);
          setNormalizations((previous) => ({ ...previous, [document.id]: normalization }));
          message.success(`${file.name} 已上传并完成归一化`);
          await fetchDocs(selectedKnowledgeBaseId);
        })
        .catch(() => undefined)
        .finally(() => setUploading(false));
      return false;
    },
  };

  const parseStatusMap: Record<string, { label: string; color: string }> = {
    processing: { label: '解析中', color: 'processing' },
    parsed: { label: '已解析', color: 'blue' },
    failed: { label: '解析失败', color: 'error' },
  };

  const indexStatusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待索引', color: 'default' },
    building: { label: '索引中', color: 'processing' },
    indexed: { label: '已索引', color: 'success' },
    failed: { label: '索引失败', color: 'error' },
  };

  const templates = [
    { key: 'notice', label: '公告', icon: <FileTextOutlined />, color: '#1890ff' },
    { key: 'email', label: '邮件', icon: <FolderOutlined />, color: '#52c41a' },
    { key: 'weekly', label: '周报', icon: <CalendarOutlined />, color: '#0F2B5B' },
  ];

  const fileTypes = [
    { value: '', label: '全部格式' },
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'Word' },
    { value: 'txt', label: 'TXT' },
  ];

  const filteredData = docs.filter((doc) => {
    const matchesKeyword = !searchQuery.trim() || doc.original_filename.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesType = !selectedCategory || doc.file_type === selectedCategory;
    return matchesKeyword && matchesType;
  });

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

  const handleOpenDocument = async (document: RagDocument) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailDocument(null);
    setDetailNormalization(normalizations[document.id] || null);
    try {
      const [content, normalization] = await Promise.all([
        ragApi.getDocumentContent(document.id),
        ragApi.getNormalization(document.id),
      ]);
      setDetailDocument(content);
      setDetailNormalization(normalization);
    } catch {
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleIndexDocument = async (document: RagDocument) => {
    setIndexingDocumentId(document.id);
    try {
      const indexed = await ragApi.indexDocument(document.id, document.index_status === 'failed' || document.index_status === 'indexed');
      setDocs((previous) => previous.map((item) => item.id === indexed.id ? indexed : item));
      message.success(`${document.original_filename} 已完成索引，可用于智能问答`);
    } catch {
      await fetchDocs(document.knowledge_base_id);
    } finally {
      setIndexingDocumentId(null);
    }
  };

  const handleDeleteDocument = async (document: RagDocument) => {
    await ragApi.deleteDocument(document.id);
    setDocs((previous) => previous.filter((item) => item.id !== document.id));
    setNormalizations((previous) => {
      const next = { ...previous };
      delete next[document.id];
      return next;
    });
    message.success('文档已删除');
  };

  const knowledgeColumns = [
    {
      title: '文档名称',
      dataIndex: 'original_filename',
      key: 'original_filename',
      render: (text: string, record: RagDocument) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Tooltip title={text}>
            <a onClick={() => void handleOpenDocument(record)} style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {text}
            </a>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '格式',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 80,
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size: number) => <Text type="secondary">{(size / 1024).toFixed(1)} KB</Text>,
    },
    {
      title: '归一化',
      key: 'normalization',
      width: 120,
      render: (_: unknown, record: RagDocument) => {
        const normalization = normalizations[record.id];
        return normalization?.status === 'normalized'
          ? <Tooltip title={`${normalization.chunk_count} 个文本片段`}><Tag color="cyan">已归一化 · {normalization.normalization_version}</Tag></Tooltip>
          : <Tag>未归一化</Tag>;
      },
    },
    {
      title: '处理状态',
      key: 'status',
      width: 170,
      render: (_: unknown, record: RagDocument) => (
        <Space size={4} wrap>
          <Tag color={parseStatusMap[record.status]?.color}>{parseStatusMap[record.status]?.label || record.status}</Tag>
          <Tooltip title={record.index_error || undefined}>
            <Tag color={indexStatusMap[record.index_status]?.color}>{indexStatusMap[record.index_status]?.label || record.index_status}</Tag>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => <Text type="secondary">{dayjs(date).format('YYYY-MM-DD')}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      render: (_: unknown, record: RagDocument) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void handleOpenDocument(record)}>查看</Button>
          {record.status === 'parsed' && (
            <Button
              type="link"
              size="small"
              loading={indexingDocumentId === record.id}
              onClick={() => void handleIndexDocument(record)}
            >
              {record.index_status === 'indexed' ? '重建索引' : '建立索引'}
            </Button>
          )}
          <Popconfirm title="确认删除这份文档？" onConfirm={() => void handleDeleteDocument(record)} okText="确认" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
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
              <Select
                value={selectedKnowledgeBaseId ?? undefined}
                placeholder="选择知识库"
                onChange={(value) => {
                  setSelectedKnowledgeBaseId(value);
                  void fetchDocs(value);
                }}
                style={{ width: 180 }}
                options={knowledgeBases.map((item) => ({ label: item.name, value: item.id }))}
              />
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
                {fileTypes.map((cat) => (
                  <Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>
                ))}
              </Select>
              <Button onClick={() => void fetchDocs()} loading={loadingDocs}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setActiveTab('files')}>上传文档</Button>
            </Space>
          </div>
          <Alert
            type="info"
            showIcon
            message="真实知识库"
            description="文档上传后会自动解析和归一化；完成向量索引后，可在 AI 智能助手中检索并引用原文。"
            style={{ margin: '16px 24px 0' }}
          />
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
            <Upload.Dragger {...uploadProps} style={{ opacity: uploading ? 0.7 : 1 }}>
              <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                <InboxOutlined style={{ fontSize: 48, color: '#0F2B5B' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 16, color: '#1D2129', marginBottom: 4 }}>
                {uploading ? '正在上传并归一化…' : '点击或拖拽文件上传'}
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 12, color: '#666' }}>
                支持 PDF、DOCX、TXT，单个文件最大 20MB。原文件会保留，解析文本将自动归一化。
              </p>
            </Upload.Dragger>
          </div>
          <Table
            columns={knowledgeColumns}
            dataSource={filteredData}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="还没有真实文档，请上传第一份文件" /> }}
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

      <Modal
        open={detailOpen}
        width={820}
        title={detailDocument?.original_filename || '文档详情'}
        footer={null}
        onCancel={() => setDetailOpen(false)}
      >
        <Spin spinning={detailLoading}>
          {detailDocument && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions size="small" bordered column={2}>
                <Descriptions.Item label="文件格式">{detailDocument.file_type.toUpperCase()}</Descriptions.Item>
                <Descriptions.Item label="文件大小">{(detailDocument.file_size / 1024).toFixed(1)} KB</Descriptions.Item>
                <Descriptions.Item label="解析字符">{detailDocument.parsed_char_count.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="文本片段">{detailNormalization?.chunk_count ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="归一化版本">{detailNormalization?.normalization_version || '未归一化'}</Descriptions.Item>
                <Descriptions.Item label="索引状态">{indexStatusMap[detailDocument.index_status]?.label || detailDocument.index_status}</Descriptions.Item>
                <Descriptions.Item label="正文指纹" span={2}>
                  <Text copyable={{ text: detailNormalization?.content_hash || '' }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {detailNormalization?.content_hash || '-'}
                  </Text>
                </Descriptions.Item>
              </Descriptions>
              <div>
                <Text strong>归一化文本预览</Text>
                <pre style={{ marginTop: 8, padding: 16, maxHeight: 420, overflow: 'auto', whiteSpace: 'pre-wrap', background: '#f7f8fa', borderRadius: 6 }}>
                  {detailDocument.parsed_text}
                </pre>
              </div>
            </Space>
          )}
        </Spin>
      </Modal>
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
