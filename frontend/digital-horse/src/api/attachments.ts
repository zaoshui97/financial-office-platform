/**
 * 附件 API
 *
 * 后端路径：/api/v1/attachments
 *  - POST   /upload                       multipart/form-data, field=file
 *  - GET    /                             列我的附件
 *  - GET    /by-business/{type}/{id}      按业务类型+id 列附件
 *  - GET    /{id}                         元数据
 *  - GET    /{id}/download                下载（鉴权）
 *  - GET    /download-public/{token}      24h 免鉴权下载（Office Online 等第三方预览）
 *  - POST   /{id}/refresh-preview-token   刷新 24h 预览 token
 *  - DELETE /{id}                         删除（仅上传者）
 */
import { http } from '@/utils/request';

export interface Attachment {
  id: number;
  user_id: number;
  original_filename: string;
  extension: string;
  content_type: string | null;
  size: number;
  business_type: string | null;
  business_id: number | null;
  /**
   * 24h 免鉴权预览 token（后端上传时自动签发）。
   * 用于组装公网可访问的预览地址：/api/v1/attachments/download-public/{token}
   */
  preview_token: string | null;
  /** token 过期时间（ISO 字符串） */
  preview_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttachmentListResponse {
  items: Attachment[];
  total: number;
}

export const attachmentsApi = {
  /**
   * 上传单个文件
   *
   * ⚠️ 千万不要手动设置 Content-Type: multipart/form-data（不带 boundary 会导致后端只
   * 读到 multipart 头部那行 ~30 字节，文件实际为空）。
   * 让 axios 自动生成完整 Content-Type（含 boundary）。
   */
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<Attachment>('/attachments/upload', form);
  },

  /** 列我的附件 */
  listMine: (limit = 50) =>
    http.get<AttachmentListResponse>('/attachments', { params: { limit } }),

  /** 按业务列附件 */
  listByBusiness: (businessType: string, businessId: number) =>
    http.get<AttachmentListResponse>(`/attachments/by-business/${businessType}/${businessId}`),

  /** 元数据 */
  get: (id: number) => http.get<Attachment>(`/attachments/${id}`),

  /** 鉴权下载（业务侧带 Bearer Token，浏览器内 fetch 用） */
  downloadUrl: (id: number) => `/api/v1/attachments/${id}/download`,

  /**
   * 24h 免鉴权公网预览 URL（用于 Microsoft Office Online iframe src）
   * ⚠️ 仅用于第三方预览服务；业务侧请用 downloadUrl 并带 token
   */
  previewPublicUrl: (att: Attachment): string | null => {
    if (!att.preview_token) return null;
    return `/api/v1/attachments/download-public/${att.preview_token}`;
  },

  /** 刷新预览 token（管理员侧 token 过期时调用） */
  refreshPreviewToken: (id: number) =>
    http.post<Attachment>(`/attachments/${id}/refresh-preview-token`),

  /** 删除 */
  remove: (id: number) => http.delete<void>(`/attachments/${id}`),
};

/** 兼容旧引用 */
export const attachmentDownloadUrl = attachmentsApi.downloadUrl;

export default attachmentsApi;
