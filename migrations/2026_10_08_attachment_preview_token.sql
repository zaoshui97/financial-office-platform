-- 2026-10-08: 附件表加预览 token 字段
-- 动机：让前端能用 Microsoft Office Online 等第三方服务预览 Word/Excel/PPT，
--       这类服务要求 src 是公网可访问的 URL，且无法加 Authorization header。
-- 设计：上传时自动生成 32 字节 URL-safe token + 24h 过期时间，
--       提供 GET /attachments/download-public/{token} 无鉴权下载接口。
ALTER TABLE attachments
  ADD COLUMN preview_token        VARCHAR(64)  NULL  COMMENT '24h 临时预览 token（用于 Office Online 等第三方预览）',
  ADD COLUMN preview_expires_at   DATETIME     NULL  COMMENT '预览 token 过期时间（UTC）';

-- 索引：按 token 查询（O(log n)），同时支持按过期时间清理
CREATE INDEX idx_attachment_preview_token ON attachments (preview_token);
