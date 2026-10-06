/**
 * ComplianceReceiptCard —— 合规回执 UI 组件
 *
 * 用途：沙箱检测完成后，用户点击"导出合规回执"，
 *       弹出此卡片展示结构化回执，并支持下载 / 复制。
 */

import React, { useState } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Typography,
  Descriptions,
  App,
  Tabs,
} from 'antd';
import {
  FileProtectOutlined,
  DownloadOutlined,
  CopyOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { downloadReceipt, exportReceiptMarkdown, type ComplianceReceipt } from '@/services/sandbox/complianceReceipt';

const { Text, Paragraph } = Typography;

interface ComplianceReceiptCardProps {
  receipt: ComplianceReceipt;
}

export const ComplianceReceiptCard: React.FC<ComplianceReceiptCardProps> = ({ receipt }) => {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState('summary');

  const handleCopy = () => {
    const md = exportReceiptMarkdown(receipt);
    navigator.clipboard.writeText(md).then(
      () => message.success('已复制为 Markdown 到剪贴板'),
      () => message.error('复制失败')
    );
  };

  const handlePrint = () => {
    const md = exportReceiptMarkdown(receipt);
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) {
      message.error('无法打开打印窗口');
      return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${receipt.receiptId}</title>
      <style>body{font-family:-apple-system,sans-serif;padding:32px;color:#222;line-height:1.6}h1{margin-bottom:8px;color:#0F2B5B;border-bottom:2px solid #0F2B5B;padding-bottom:8px}h2{margin-top:24px;color:#0F2B5B;border-left:4px solid #0F2B5B;padding-left:10px}code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:Menlo,monospace}.seal{background:#fffbe6;border:1px dashed #faad14;padding:12px;margin:16px 0;border-radius:4px}</style>
      </head><body><pre style="white-space:pre-wrap;font-family:inherit">${md.replace(/</g, '&lt;')}</pre></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const resultColor = receipt.blocked ? 'error' : receipt.passed ? 'success' : 'warning';
  const resultText = receipt.blocked ? '阻断' : receipt.passed ? '通过' : '警告';

  return (
    <Card
      title={
        <Space>
          <FileProtectOutlined style={{ color: '#0F2B5B' }} />
          <span>合规检查回执</span>
          <Tag color="blue">{receipt.receiptId}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
            复制 Markdown
          </Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={handlePrint}>
            打印
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              downloadReceipt(receipt);
              message.success('已下载 JSON 回执');
            }}
          >
            下载 JSON
          </Button>
        </Space>
      }
      size="small"
    >
      {/* 防伪区 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fffbe6 0%, #fff7d6 100%)',
          border: '1px dashed #faad14',
          padding: '12px 16px',
          borderRadius: 4,
          marginBottom: 12,
        }}
      >
        <Space direction="vertical" size={4}>
          <Text strong style={{ fontSize: 13 }}>
            本回执已生成防伪码，可作为合规审计凭证
          </Text>
          <Text code style={{ fontSize: 14, color: '#D48806' }}>
            {receipt.sealHash}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            签发时间：{receipt.issuedAt} · 输入哈希：<code>{receipt.inputHash}</code>
          </Text>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'summary',
          label: '摘要',
          children: (
            <>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="检测结果">
                  <Tag color={resultColor}>{resultText}</Tag>
                  <Tag>{receipt.score.toFixed(1)} / 5</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="问题数">
                  <Text strong>{receipt.issueCount}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="操作人">
                  {receipt.operator}
                  {receipt.operatorDept && <Tag style={{ marginLeft: 4 }}>{receipt.operatorDept}</Tag>}
                  {receipt.operatorRole && <Tag color="geekblue">{receipt.operatorRole}</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="来源">{receipt.source}</Descriptions.Item>
                <Descriptions.Item label="输入长度">{receipt.inputLength} 字</Descriptions.Item>
                <Descriptions.Item label="输入哈希">
                  <Text code>{receipt.inputHash}</Text>
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>输入预览</Text>
                <Paragraph
                  style={{
                    background: '#f4f4f4',
                    padding: '8px 12px',
                    borderRadius: 4,
                    marginBottom: 0,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {receipt.inputPreview}
                </Paragraph>
              </div>

              {receipt.businessRef && (
                <Descriptions
                  column={1}
                  size="small"
                  bordered
                  style={{ marginTop: 12 }}
                  title="关联业务单据"
                >
                  <Descriptions.Item label="类型">{receipt.businessRef.type}</Descriptions.Item>
                  <Descriptions.Item label="ID">{receipt.businessRef.id}</Descriptions.Item>
                  {receipt.businessRef.title && (
                    <Descriptions.Item label="标题">{receipt.businessRef.title}</Descriptions.Item>
                  )}
                </Descriptions>
              )}
            </>
          ),
        },
        {
          key: 'issues',
          label: `命中问题 (${receipt.issues.length})`,
          children:
            receipt.issues.length === 0 ? (
              <Text type="secondary">本次检测未命中任何规则</Text>
            ) : (
              receipt.issues.map((iss, idx) => (
                <Card
                  key={iss.ruleId}
                  size="small"
                  style={{ marginBottom: 8 }}
                  title={
                    <Space>
                      <Tag color="red">{idx + 1}</Tag>
                      <Text strong>{iss.ruleName}</Text>
                      <Tag color="default">{iss.ruleId}</Tag>
                      <Tag color={iss.severity === 'block' ? 'red' : iss.severity === 'warn' ? 'gold' : 'default'}>
                        {iss.severity}
                      </Tag>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">命中次数：</Text>
                      <Text strong>{iss.hitCount}</Text>
                    </div>
                    <div>
                      <Text type="secondary">修复建议：</Text>
                      <Paragraph style={{ marginBottom: 0 }}>{iss.suggestion}</Paragraph>
                    </div>
                    {iss.regulationIds.length > 0 && (
                      <div>
                        <Text type="secondary">关联法规：</Text>
                        <Space wrap>
                          {iss.regulationIds.map((id) => (
                            <Tag key={id} color="red">{id}</Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                  </Space>
                </Card>
              ))
            ),
        },
        {
          key: 'json',
          label: '原始 JSON',
          children: (
            <pre
              style={{
                background: '#0F2B5B',
                color: '#e6f4ff',
                padding: 12,
                borderRadius: 4,
                maxHeight: 400,
                overflow: 'auto',
                fontSize: 12,
              }}
            >
              {JSON.stringify(receipt, null, 2)}
            </pre>
          ),
        },
      ]} />
    </Card>
  );
};

export default ComplianceReceiptCard;
