/**
 * 附件预览 Modal
 *  - 图片：内联显示
 *  - PDF：<embed> 内联渲染
 *  - Office（docx/xlsx/pptx）：浏览器预览（推荐下载）
 *  - 其它：仅显示文件名 + 下载按钮
 */
import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Divider, message } from 'antd';
import {
  FileOutlined, DownloadOutlined, FilePdfOutlined, FileImageOutlined,
  FileWordOutlined, FileExcelOutlined, FilePptOutlined, FileZipOutlined,
} from '@ant-design/icons';
import { attachmentDownloadUrl, type Attachment } from '@/api/attachments';

const { Text, Title } = Typography;

function pickIcon(ext: string): React.ReactNode {
  const e = ext.toLowerCase();
  if (e === '.pdf') return <FilePdfOutlined style={{ color: '#D64045' }} />;
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(e)) return <FileImageOutlined style={{ color: '#22A775' }} />;
  if (['.doc', '.docx'].includes(e)) return <FileWordOutlined style={{ color: '#0F2B5B' }} />;
  if (['.xls', '.xlsx', '.csv'].includes(e)) return <FileExcelOutlined style={{ color: '#22A775' }} />;
  if (['.ppt', '.pptx'].includes(e)) return <FilePptOutlined style={{ color: '#fa8c16' }} />;
  if (['.zip', '.7z', '.rar'].includes(e)) return <FileZipOutlined style={{ color: '#8A94A6' }} />;
  return <FileOutlined />;
}

function isImage(ext: string) {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext.toLowerCase());
}
function isPdf(ext: string) {
  return ext.toLowerCase() === '.pdf';
}
function isOffice(ext: string) {
  return ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext.toLowerCase());
}

interface Props {
  attachment: Attachment | null;
  open: boolean;
  onClose: () => void;
}

const AttachmentPreviewModal: React.FC<Props> = ({ attachment, open, onClose }) => {
  if (!attachment) return null;

  const ext = attachment.extension;
  const url = attachmentDownloadUrl(attachment.id);

  // fetch + blob 用于带 token 的预览（embed/img 不支持自定义 header）
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  React.useEffect(() => {
    if (!open) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }
    // 始终走 blob URL（避开 Authorization header 问题）
    let active = true;
    (async () => {
      try {
        const token = (() => {
          try { return JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token?.access_token; }
          catch { return null; }
        })();
        const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (!active) return;
        setBlobUrl(URL.createObjectURL(blob));
      } catch (e) {
        message.error('预览加载失败，请改用下载');
      }
    })();
    return () => { active = false; };
  }, [open, attachment.id]);

  let previewEl: React.ReactNode = null;
  if (blobUrl) {
    if (isImage(ext)) {
      previewEl = (
        <div style={{ textAlign: 'center', maxHeight: '70vh', overflow: 'auto', background: '#0F2B5B08' }}>
          <img src={blobUrl} alt={attachment.original_filename} style={{ maxWidth: '100%' }} />
        </div>
      );
    } else if (isPdf(ext)) {
      previewEl = (
        <embed src={blobUrl} type="application/pdf" width="100%" height="600px" />
      );
    } else if (isOffice(ext)) {
      previewEl = (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Title level={5}>{attachment.original_filename}</Title>
          <Text type="secondary">Office 文档浏览器暂不支持内联预览，请下载后用本地应用打开</Text>
          <Divider />
          <Button type="primary" icon={<DownloadOutlined />} href={url} target="_blank">
            下载查看
          </Button>
        </div>
      );
    } else {
      previewEl = (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <FileOutlined style={{ fontSize: 48, color: '#8A94A6' }} />
          <Divider />
          <Button type="primary" icon={<DownloadOutlined />} href={url} target="_blank">
            下载
          </Button>
        </div>
      );
    }
  } else {
    previewEl = <Text type="secondary">加载中…</Text>;
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      title={
        <Space>
          {pickIcon(ext)}
          <span>{attachment.original_filename}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({(attachment.size / 1024).toFixed(1)} KB)
          </Text>
        </Space>
      }
    >
      {previewEl}
      <Divider style={{ margin: '12px 0' }} />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => {
            // 用 fetch 强制带 token 下载
            (async () => {
              const token = (() => {
                try { return JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token?.access_token; }
                catch { return null; }
              })();
              const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
              const blob = await resp.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = attachment.original_filename;
              a.click();
              URL.revokeObjectURL(a.href);
            })();
          }}
        >
          下载
        </Button>
      </Space>
    </Modal>
  );
};

export default AttachmentPreviewModal;
