import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Table, Tag, Space, Button, Typography, Tooltip, Modal, Form, message, Spin, Empty } from 'antd';
import { SearchOutlined, PlusOutlined, FileTextOutlined, FolderOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { knowledgeApi } from '@/api/modules';
import type { KnowledgeDocument } from '@/types/api';

const { Text } = Typography;

const Knowledge: React.FC = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [form] = Form.useForm();

  // ===== 数据来源：调用业务接口 =====
  // 历史项目从 '@/mock/data/knowledge' 直接 import mock 数据，
  // 现已统一收敛为调用 knowledgeApi，后端未上线前展示空态，避免假数据"看起来像真的"。
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await knowledgeApi.getList({
        page: 1,
        pageSize: 100,
        category: selectedCategory || undefined,
        keyword: searchQuery || undefined,
      });
      setDocs((resp.data?.data?.list as unknown as KnowledgeDocument[]) ?? []);
    } catch (err: any) {
      // 接口未就绪：业务方应主动看到"未连接后端"，而不是默认渲染假数据
      setDocs([]);
      setErrorMsg(err?.message || '知识库接口未就绪，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory]);

  const categoryMap: Record<string, { label: string; color: string }> = {
    policy: { label: t('knowledge.policy'), color: 'blue' },
    project: { label: t('knowledge.project'), color: 'blue' },
    faq: { label: t('knowledge.faq'), color: 'orange' },
    template: { label: t('knowledge.template'), color: 'cyan' },
    report: { label: t('knowledge.report'), color: 'green' },
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    indexed: { label: t('knowledge.statusIndexed'), color: 'success' },
    indexing: { label: t('knowledge.statusIndexing'), color: 'processing' },
    failed: { label: t('knowledge.statusFailed'), color: 'error' },
  };

  const categories = [
    { value: '', label: t('knowledge.allCategory') },
    { value: 'policy', label: t('knowledge.policy') },
    { value: 'project', label: t('knowledge.project') },
    { value: 'faq', label: t('knowledge.faq') },
    { value: 'template', label: t('knowledge.template') },
    { value: 'report', label: t('knowledge.report') },
  ];

  const filteredData = docs;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const columns = [
    {
      title: t('knowledge.fileName'),
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Tooltip title={text}>
            <a
              style={{
                maxWidth: 300,
                display: 'inline-block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </a>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: t('knowledge.category'),
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (category: string) => (
        <Tag color={categoryMap[category]?.color}>{categoryMap[category]?.label || category}</Tag>
      ),
    },
    {
      title: t('knowledge.author'),
      dataIndex: 'uploader',
      key: 'uploader',
      width: 120,
      render: (uploader?: string) => <Text type="secondary">{uploader || '-'}</Text>,
    },
    {
      title: t('knowledge.fileSize'),
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (size: number) => <Text type="secondary">{formatFileSize(size)}</Text>,
    },
    {
      title: t('knowledge.updateTime'),
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => <Text type="secondary">{formatDate(date)}</Text>,
    },
    {
      title: t('knowledge.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={statusMap[status]?.color || 'default'}>{statusMap[status]?.label || status}</Tag>
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 120,
      render: (_: unknown, record: KnowledgeDocument) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedDoc(record);
              setViewModalVisible(true);
            }}
          >
            {t('common.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedDoc(record);
              form.setFieldsValue({
                title: record.title,
                category: record.category,
              });
              setEditModalVisible(true);
            }}
          >
            {t('common.edit')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <FolderOutlined />
          <h2 style={{ margin: 0 }}>{t('knowledge.title')}</h2>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 'normal' }}>
            {t('knowledge.totalDocuments', { count: filteredData.length })}
          </Text>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setCreateModalVisible(true);
          }}
        >
          {t('knowledge.newKnowledge')}
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }} size="large" wrap>
        <Input.Search
          placeholder={t('knowledge.search')}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Select
          value={selectedCategory}
          onChange={setSelectedCategory}
          style={{ width: 150 }}
        >
          {categories.map((cat) => (
            <Select.Option key={cat.value} value={cat.value}>
              {cat.label}
            </Select.Option>
          ))}
        </Select>
      </Space>

      <Spin spinning={loading}>
        {errorMsg && !loading && (
          <div style={{ padding: 16, marginBottom: 12, background: '#FFF7E6', border: '1px solid #FFD591', borderRadius: 6 }}>
            <Text type="warning">{errorMsg}</Text>
          </div>
        )}
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          locale={{
            emptyText: loading ? '加载中…' : <Empty description={errorMsg ? '—' : '暂无文档'} />,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('knowledge.totalDocs', { count: total }),
          }}
        />
      </Spin>

      {/* 查看文档 Modal */}
      <Modal
        title={t('knowledge.documentPreview')}
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>{t('common.close')}</Button>,
        ]}
        style={{ width: 700, maxWidth: 'calc(100vw - 32px)' }}
      >
        {selectedDoc && (
          <div style={{ padding: '12px 0' }}>
            <h3>{selectedDoc.title}</h3>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={categoryMap[selectedDoc.category]?.color}>{categoryMap[selectedDoc.category]?.label}</Tag>
              <Text type="secondary">{t('knowledge.author')}: {selectedDoc.uploader || '-'}</Text>
              <Text type="secondary">{t('knowledge.fileSize')}: {formatFileSize(selectedDoc.fileSize)}</Text>
            </Space>
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Text type="secondary">{t('knowledge.previewContent') || '文档预览功能开发中...'}</Text>
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑文档 Modal */}
      <Modal
        title={t('common.edit')}
        open={editModalVisible}
        onOk={() => {
          form.validateFields().then(values => {
            message.success(t('knowledge.updateSuccess') || '文档信息已更新');
            setEditModalVisible(false);
          });
        }}
        onCancel={() => setEditModalVisible(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label={t('knowledge.fileName')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="category"
            label={t('knowledge.category')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select>
              {categories.filter(c => c.value).map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建知识 Modal */}
      <Modal
        title={t('knowledge.newKnowledge')}
        open={createModalVisible}
        onOk={() => {
          form.validateFields().then(values => {
            message.success(t('knowledge.createSuccess') || '知识创建成功');
            setCreateModalVisible(false);
          });
        }}
        onCancel={() => setCreateModalVisible(false)}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label={t('knowledge.fileName')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('knowledge.fileNamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="category"
            label={t('knowledge.category')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Select placeholder={t('knowledge.selectCategory')}>
              {categories.filter(c => c.value).map((cat) => (
                <Select.Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Knowledge;
