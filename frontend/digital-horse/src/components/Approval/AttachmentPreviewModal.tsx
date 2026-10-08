/**
 * 附件预览 Modal
 *  - 图片：内联显示
 *  - PDF：<embed> 内联渲染
 *  - Office（docx/xlsx/pptx）：优先用 Microsoft Office Online 渲染，
 *                不可达时降级为「下载查看」（带 token）
 *  - 其它：仅显示文件名 + 下载按钮
 *
 * 预览策略：
 *  - 本机部署（localhost/内网）时，Microsoft Office Online（公网）无法访问内网附件；
 *    我们走「后端鉴权下载 → blob URL → 浏览器原生渲染」链路。
 *  - 公网部署时，可选走 Microsoft Office Online iframe，体验更佳。
 *
 * 关键：fetch 下载要带 Authorization header（避免被 401 拦），创建 blob URL 供 <embed>/<iframe> 使用。
 */
import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Divider, message, Spin } from 'antd';
import {
  FileOutlined, DownloadOutlined, FilePdfOutlined, FileImageOutlined,
  FileWordOutlined, FileExcelOutlined, FilePptOutlined, FileZipOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { attachmentsApi, attachmentDownloadUrl, type Attachment } from '@/api/attachments';

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
function isOfficeWord(ext: string) {
  return ['.doc', '.docx'].includes(ext.toLowerCase());
}
function isOfficeExcel(ext: string) {
  return ['.xls', '.xlsx', '.csv'].includes(ext.toLowerCase());
}
function isOfficePpt(ext: string) {
  return ['.ppt', '.pptx'].includes(ext.toLowerCase());
}
function isOffice(ext: string) {
  return isOfficeWord(ext) || isOfficeExcel(ext) || isOfficePpt(ext);
}

interface Props {
  attachment: Attachment | null;
  open: boolean;
  onClose: () => void;
}

/** 从 zustand persist 里读 token（兼容 undefined/null） */
function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token?.access_token ?? null;
  } catch {
    return null;
  }
}

const AttachmentPreviewModal: React.FC<Props> = ({ attachment, open, onClose }) => {
  if (!attachment) return null;

  const ext = attachment.extension;
  const downloadUrl = attachmentDownloadUrl(attachment.id);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [officeUrl, setOfficeUrl] = useState<string | null>(null);
  const [officeError, setOfficeError] = useState<string | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(false);

  React.useEffect(() => {
    // 每次切换附件重置
    if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    setOfficeUrl(null);
    setOfficeError(null);
    setLoadingBlob(false);
    if (!open || !attachment) return;

    let active = true;
    const token = getAccessToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Office 文档：先尝试拿到 blob URL（任何环境都能本地渲染）
    // PDF / 图片：直接走鉴权下载 + blob URL
    if (isImage(ext) || isPdf(ext) || isOffice(ext)) {
      setLoadingBlob(true);
      (async () => {
        try {
          const resp = await fetch(downloadUrl, { headers });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          if (!active) return;
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          // Office 文档额外尝试给 Microsoft Web Viewer 喂公网 URL；
          // 如果 preview_token 在后端存在，我们把公网免鉴权下载地址喂过去
          if (isOffice(ext) && attachment.preview_token) {
            const publicUrl = attachmentsApi.previewPublicUrl(attachment);
            if (publicUrl) {
              // Microsoft Office Online 不能访问 localhost/内网，
              // 所以仅在公网域名下启用；这里给个判断（window.location.hostname 非 localhost/127.x）
              const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname)
                || window.location.hostname.startsWith('192.168.')
                || window.location.hostname.startsWith('10.');
              if (!isLocal) {
                setOfficeUrl(
                  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                    window.location.origin + publicUrl
                  )}`
                );
              }
            }
          }
        } catch (e: any) {
          if (active) {
            setOfficeError(e?.message || '加载失败');
            message.error('预览加载失败，请改用下载');
          }
        } finally {
          if (active) setLoadingBlob(false);
        }
      })();
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attachment.id]);

  // 关闭时释放 blob URL
  React.useEffect(() => () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const handleDownload = async () => {
    try {
      const token = getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(downloadUrl, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = attachment.original_filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      message.error('下载失败，请检查网络或重试');
    }
  };

  const handleRefreshToken = async () => {
    try {
      await attachmentsApi.refreshPreviewToken(attachment.id);
      message.success('预览链接已刷新');
    } catch (e) {
      message.error('刷新失败，请稍后再试');
    }
  };

  // ===== 渲染预览内容 =====
  let previewEl: React.ReactNode = null;
  if (loadingBlob) {
    previewEl = (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin tip="加载中…" />
      </div>
    );
  } else if (officeError) {
    previewEl = (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <FileOutlined style={{ fontSize: 48, color: '#FF4D4F' }} />
        <Title level={5} style={{ marginTop: 16, color: '#FF4D4F' }}>预览失败</Title>
        <Text type="secondary">{officeError}</Text>
        <Divider />
        <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
          下载查看
        </Button>
      </div>
    );
  } else if (blobUrl) {
    if (isImage(ext)) {
      previewEl = (
        <div style={{ textAlign: 'center', maxHeight: '70vh', overflow: 'auto', background: '#0F2B5B08' }}>
          <img src={blobUrl} alt={attachment.original_filename} style={{ maxWidth: '100%' }} />
        </div>
      );
    } else if (isPdf(ext)) {
      previewEl = <embed src={blobUrl} type="application/pdf" width="100%" height="600px" />;
    } else if (isOffice(ext)) {
      // Office 文档：优先用 Microsoft Office Online（公网时），否则提示用下载
      if (officeUrl) {
        previewEl = (
          <iframe
            src={officeUrl}
            title={attachment.original_filename}
            width="100%"
            height="600px"
            style={{ border: 'none' }}
          />
        );
      } else if (blobUrl) {
        // 本地/内网环境：浏览器对 Office 三件套的原生支持不稳定，
        // 给用户清晰提示，并提供 Microsoft Online 链接（如果部署到了公网会更好）。
        previewEl = (
          <div style={{ padding: 24 }}>
            <Title level={5}>
              <Space>
                {pickIcon(ext)}
                {attachment.original_filename}
              </Space>
            </Title>
            <Text type="secondary">
              本地环境浏览器无法直接渲染 Office 文件，建议：
            </Text>
            <Divider />
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button block type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载到本地查看
              </Button>
              {isOfficeWord(ext) && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  💡 提示：若系统部署到公网，可启用 Microsoft Office Online 在线预览（iframe 渲染）
                </Text>
              )}
              {isOfficeExcel(ext) && (
                <Button
                  block
                  icon={<FileExcelOutlined />}
                  onClick={handleDownload}
                >
                  下载 Excel 用本地 WPS/Office 打开
                </Button>
              )}
            </Space>
          </div>
        );
      }
    } else {
      // 其它文本类（如 .txt / .md / .csv）
      if (['.txt', '.md', '.csv'].includes(ext.toLowerCase())) {
        previewEl = (
          <iframe src={blobUrl} title={attachment.original_filename} width="100%" height="500px" style={{ border: '1px solid #F0F0F0' }} />
        );
      } else {
        previewEl = (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <FileOutlined style={{ fontSize: 48, color: '#8A94A6' }} />
            <Divider />
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
              下载
            </Button>
          </div>
        );
      }
    }
  } else {
    previewEl = <Text type="secondary">加载中…</Text>;
  }

  // 文件大小安全格式化（避免 NaN）
  const sizeText = (() => {
    const s = Number(attachment.size);
    if (!isFinite(s) || isNaN(s)) return '大小未知';
    if (s < 1024) return `${s} B`;
    if (s < 1024 * 1024) return `${(s / 1024).toFixed(1)} KB`;
    return `${(s / 1024 / 1024).toFixed(2)} MB`;
  })();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      title={
        <Space>
          {pickIcon(ext)}
          <span>{attachment.original_filename}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({sizeText})
          </Text>
        </Space>
      }
    >
      {previewEl}
      <Divider style={{ margin: '12px 0' }} />
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        {attachment.preview_token && (
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefreshToken}>
            刷新预览链接
          </Button>
        )}
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            下载
          </Button>
          <Button type="primary" onClick={onClose}>关闭</Button>
        </Space>
      </Space>
    </Modal>
  );
};

export default AttachmentPreviewModal;
