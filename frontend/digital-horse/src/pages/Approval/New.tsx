/**
 * 提交新审批 — 独立页 /approval/new
 *
 * 功能：
 *   1) 选审批类型 (leave / reimburse / seal / general)
 *   2) 填写标题 + 正文
 *   3) 上传多个附件（pdf/docx/xlsx/pptx/png/jpg/zip 等）
 *   4) 提交 → 调真实后端 → 跳到 /approval 列表
 *
 * Phase 1 简化：不做 AI 预审（沙箱），不做紧急程度评估。
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Select, Button, Space, Typography, Upload, message,
  App, Row, Col, Tag, Result, Alert,
} from 'antd';
import {
  InboxOutlined, ArrowLeftOutlined, FileTextOutlined, PaperClipOutlined,
  CheckCircleOutlined, FileOutlined, DeleteOutlined, EyeOutlined,
} from '@ant-design/icons';
import { approvalsApi, type ApprovalType } from '@/api/approvals';
import { attachmentsApi, attachmentDownloadUrl, type Attachment } from '@/api/attachments';
import { useUserStore } from '@/store/userStore';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const TYPE_OPTIONS: { value: ApprovalType; label: string; color: string; hint: string }[] = [
  { value: 'leave',      label: '请假',     color: '#3B82F6', hint: '事假 / 病假 / 年假' },
  { value: 'reimburse',  label: '报销',     color: '#fa8c16', hint: '差旅 / 招待 / 办公' },
  { value: 'seal',       label: '用印',     color: '#22A775', hint: '合同 / 文件 / 证明' },
  { value: 'general',    label: '通用申请', color: '#0F2B5B', hint: '其它事务' },
];

const NewApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { message: msgApi } = App.useApp();
  const [form] = Form.useForm();
  const user = useUserStore((s) => s.user);
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ id: number; title: string } | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const att = await attachmentsApi.upload(file);
      setAttachments((prev) => [...prev, att]);
      msgApi.success(`已上传：${att.original_filename}`);
    } catch (e) {
      msgApi.error('上传失败');
      console.error(e);
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 自动上传
  };

  const handleRemove = async (att: Attachment) => {
    try {
      await attachmentsApi.remove(att.id);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
      msgApi.success('已删除');
    } catch (e) {
      msgApi.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const created = await approvalsApi.create({
        type: values.type,
        title: values.title,
        content: values.content,
        attachment_ids: attachments.map((a) => a.id),
      });
      msgApi.success('已提交，审批已入列');
      setResult({ id: created.id, title: created.title || values.title });
    } catch (e: any) {
      if (e?.errorFields) {
        msgApi.warning('请补全必填项');
      } else {
        console.error(e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#22A775' }} />}
            title="审批已提交"
            subTitle={`审批单号 #${result.id} · ${result.title}，已通知审核人`}
            extra={[
              <Button key="list" type="primary" onClick={() => navigate('/approval')}>
                查看审批列表
              </Button>,
              <Button key="new" onClick={() => {
                setResult(null);
                setAttachments([]);
                form.resetFields();
              }}>
                再提一个
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: '#F7F9FC', minHeight: '100%' }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/approval')}>
          返回列表
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          申请人：{user?.name || '—'} · 部门：{(user as any)?.department || '—'}
        </Text>
      </Space>

      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Card
            title={
              <Space>
                <FileTextOutlined style={{ color: '#0F2B5B' }} />
                <span>新建审批申请</span>
              </Space>
            }
          >
            <Form form={form} layout="vertical" requiredMark="optional" initialValues={{ type: 'general' }}>
              <Form.Item
                name="type"
                label="审批类型"
                rules={[{ required: true, message: '请选择审批类型' }]}
              >
                <Select size="large" placeholder="选择一类">
                  {TYPE_OPTIONS.map((t) => (
                    <Select.Option key={t.value} value={t.value}>
                      <Space>
                        <Tag color={t.color} style={{ marginRight: 0 }}>{t.label}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{t.hint}</Text>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="title"
                label="标题"
                rules={[
                  { required: true, message: '请填写标题' },
                  { max: 200, message: '标题不能超过 200 字' },
                ]}
              >
                <Input size="large" placeholder="如：Q4 部门团建预算申请" maxLength={200} showCount />
              </Form.Item>

              <Form.Item
                name="content"
                label="申请详情"
                rules={[
                  { required: true, message: '请填写申请详情' },
                  { min: 10, message: '详情至少 10 字' },
                ]}
              >
                <Input.TextArea
                  rows={8}
                  placeholder="详细说明：背景、金额、时间、需要的支持等…"
                  maxLength={64000}
                  showCount
                />
              </Form.Item>

              <Form.Item label="附件（可选，最多 20 MB / 个）">
                <Dragger
                  name="file"
                  multiple
                  beforeUpload={(file) => {
                    handleUpload(file);
                    return false;
                  }}
                  showUploadList={false}
                  disabled={uploading}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#0F2B5B' }} />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
                  <p className="ant-upload-hint">
                    支持 PDF / Word / Excel / PPT / 图片 / 压缩包，单个文件最大 20MB
                  </p>
                </Dragger>

                {attachments.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {attachments.map((att) => (
                      <Card
                        key={att.id}
                        size="small"
                        style={{ marginBottom: 8 }}
                        styles={{ body: { padding: '8px 12px' } }}
                      >
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Space>
                            <PaperClipOutlined style={{ color: '#0F2B5B' }} />
                            <Text strong>{att.original_filename}</Text>
                            <Tag>{(att.size / 1024).toFixed(1)} KB</Tag>
                          </Space>
                          <Space>
                            <Button
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => window.open(attachmentDownloadUrl(att.id), '_blank')}
                            >
                              预览
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemove(att)}
                            >
                              删除
                            </Button>
                          </Space>
                        </Space>
                      </Card>
                    ))}
                  </div>
                )}
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                <Space>
                  <Button
                    type="primary"
                    size="large"
                    loading={submitting}
                    onClick={handleSubmit}
                    icon={<CheckCircleOutlined />}
                  >
                    提交审批
                  </Button>
                  <Button size="large" onClick={() => navigate('/approval')}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card size="small" title="提交流程">
            <Paragraph style={{ fontSize: 13 }}>
              <Text strong>1. 填写</Text>：选择类型、标题、详情<br />
              <Text strong>2. 附件</Text>：支持常见办公文档 + 图片<br />
              <Text strong>3. 提交</Text>：进入待审列表，部门管理员 / 超级管理员将收到通知
            </Paragraph>
            <Alert
              type="info"
              showIcon
              message="审批流转"
              description={
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li>员工 → 部门管理员（DEPT_ADMIN）</li>
                  <li>部门管理员 → 超级管理员（SUPER_ADMIN）</li>
                </ul>
              }
            />
          </Card>
          <Card size="small" title="小贴士" style={{ marginTop: 12 }}>
            <Paragraph style={{ fontSize: 12 }} type="secondary">
              • 标题简洁清楚，让审批人一眼看懂<br />
              • 详情写明背景 + 关键数据<br />
              • 报销类请附上票据图片/PDF
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default NewApprovalPage;
