/**
 * ExportToolbar — 导出工具栏（PDF / Markdown / 分享到知识库）
 *
 * 业务联动（研报违规 → 沙箱改写）：
 *   - Markdown 导出走 exportMarkdownWithSandbox（带合规沙箱检测）
 *   - 命中阻断级违规时，弹窗提示并提供"跳转沙箱改写"按钮，
 *     把违规报告文本（Markdown 形式）通过 router state 传给 SandboxRunner
 *   - 沙箱页接收 initialText 后自动填到输入框，用户可直接改写后再次检测
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Space, Button, Tooltip, message, Dropdown, Modal, Input, Alert, Typography, Tag } from 'antd';
import {
  FilePdfOutlined,
  FileMarkdownOutlined,
  ShareAltOutlined,
  CopyOutlined,
  CloudUploadOutlined,
  CheckOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { exportMeetingPDF } from '@/services/pdfExportService';
import {
  downloadMarkdown,
  exportMarkdownWithSandbox,
  reportToPlainText,
  type SandboxError,
} from '@/services/postMeetingService';
import type { GetReportResponse } from '@/services/meetingApiContract';

const { Text, Paragraph } = Typography;

export interface ExportToolbarProps {
  report: GetReportResponse['data'];
  onShareToKnowledge?: () => void;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({ report, onShareToKnowledge }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // 阻断弹窗：sandboxError 非空时显示，提供"跳转沙箱改写"按钮
  const [sandboxError, setSandboxError] = useState<SandboxError | null>(null);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const result = await exportMeetingPDF(report);
      message.success(
        t('postMeeting.pdfExported', {
          filename: result.filename,
          size: (result.size / 1024).toFixed(1),
        })
      );
    } catch (e) {
      message.error(t('postMeeting.exportFailed'));
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  // Markdown 导出走"沙箱检测 + 下载"完整流程
  // 命中阻断级违规时，弹窗拦截 + 提供"跳转沙箱改写"按钮
  const handleExportMarkdown = async () => {
    setExporting(true);
    try {
      await exportMarkdownWithSandbox(report);
      message.success(t('postMeeting.mdExported'));
    } catch (e: any) {
      // 阻断错误由 service 层抛 SandboxError
      if (e && e.passed === false && e.blocked === true) {
        setSandboxError(e as SandboxError);
        message.error('检测到阻断级违规，已拦截导出');
      } else {
        message.error(t('postMeeting.exportFailed'));
        console.error(e);
      }
    } finally {
      setExporting(false);
    }
  };

  // 跳转沙箱改写：把违规报告文本作为 initialText 传给 SandboxRunner
  // SandboxRunner 已支持从 props.initialText 初始化（见 src/components/Sandbox/SandboxRunner.tsx）
  // 我们额外通过 router state 把报告标题 / 上下文带过去，便于沙箱页展示"这是哪份报告需要改写"
  const handleGotoSandboxRewrite = () => {
    const text = reportToPlainText(report);
    navigate('/sandbox', {
      state: {
        initialText: text,
        source: 'meeting_report',
        approvalTitle: report.meetingTitle, // 沙箱页通过 approvalTitle 显示来源
      },
    });
    setSandboxError(null);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(report.summary || '');
    message.success(t('postMeeting.copied'));
  };

  const handleShare = () => {
    setShareModalOpen(true);
    onShareToKnowledge?.();
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: t('postMeeting.exportPDF'),
      onClick: handleExportPDF,
      disabled: exporting,
    },
    {
      key: 'markdown',
      icon: <FileMarkdownOutlined />,
      label: t('postMeeting.exportMarkdown'),
      onClick: handleExportMarkdown,
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: t('postMeeting.copySummary'),
      onClick: handleCopyText,
    },
    { type: 'divider' },
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: t('postMeeting.shareToKnowledge'),
      onClick: handleShare,
    },
  ];

  return (
    <>
      <Space wrap>
        <Tooltip title={t('postMeeting.exportPDFTip')}>
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            loading={exporting}
            onClick={handleExportPDF}
          >
            {t('postMeeting.exportPDF')}
          </Button>
        </Tooltip>

        <Tooltip title={t('postMeeting.exportMdTip')}>
          <Button icon={<FileMarkdownOutlined />} onClick={handleExportMarkdown}>
            {t('postMeeting.exportMarkdown')}
          </Button>
        </Tooltip>

        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button icon={<ShareAltOutlined />}>{t('postMeeting.moreActions')}</Button>
        </Dropdown>
      </Space>

      <Modal
        title={t('postMeeting.shareTitle')}
        open={shareModalOpen}
        onCancel={() => setShareModalOpen(false)}
        footer={null}
      >
        <p>{t('postMeeting.shareDesc')}</p>
        <Input.TextArea
          rows={3}
          placeholder={t('postMeeting.sharePlaceholder')}
          prefix={<CloudUploadOutlined />}
        />
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={onShareToKnowledge}>
            {t('postMeeting.confirmShare')}
          </Button>
          <Button onClick={() => setShareModalOpen(false)}>{t('common.cancel')}</Button>
        </Space>
      </Modal>

      {/* 阻断级违规拦截弹窗：研报违规 → 沙箱改写 联动入口 */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#DC2626' }} />
            <span>{'研报命中阻断级违规，已拦截导出'}</span>
          </Space>
        }
        open={!!sandboxError}
        onCancel={() => setSandboxError(null)}
        footer={null}
        style={{ width: 560, maxWidth: 'calc(100vw - 32px)' }}
        destroyOnHidden
      >
        {sandboxError && (
          <>
            <Alert
              type="error"
              showIcon
              message={
                <Space size={6} wrap>
                  <Text strong>{`命中 ${sandboxError.sandboxResult.issues.filter((i) => i.severity === 'block').length} 条阻断规则`}</Text>
                  <Tag color="red">{`评分 ${sandboxError.sandboxResult.score.toFixed(1)}/5`}</Tag>
                </Space>
              }
              description={sandboxError.message}
              style={{ marginBottom: 16 }}
            />

            {/* 违规项摘要：仅展示前 3 条 */}
            <div style={{ background: '#F7F8FA', borderRadius: 6, padding: 12, marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{'主要违规：'}</Text>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
                {sandboxError.sandboxResult.issues.slice(0, 3).map((issue, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    <Text strong style={{ color: '#DC2626' }}>{issue.ruleName}</Text>
                    {issue.suggestion && (
                      <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                        建议：{issue.suggestion}
                      </Paragraph>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
              <Button onClick={() => setSandboxError(null)}>{'暂不导出'}</Button>
              <Button
                type="primary"
                danger
                icon={<EditOutlined />}
                onClick={handleGotoSandboxRewrite}
              >
                {'跳转沙箱改写'}
              </Button>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 12, marginBottom: 0 }}>
              {'提示：跳转后报告全文将自动填入沙箱输入框，AI 将提供改写建议，修改完成后可重新检测并导出。'}
            </Paragraph>
          </>
        )}
      </Modal>
    </>
  );
};

export default ExportToolbar;
