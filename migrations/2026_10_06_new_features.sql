-- 一次性建 5 张新表（MySQL 8.0+，utf8mb4）
-- 适用：演示/Day 8 联调；生产请改走 alembic autogenerate。
-- 用法：mysql -u root -p financial_office < migrations/2026_10_06_new_features.sql

-- ===== 1. 审批主表 =====
CREATE TABLE IF NOT EXISTS `approvals` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `type` varchar(20) NOT NULL,
  `title` varchar(200) DEFAULT NULL,
  `content` text NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `sandbox_check` text DEFAULT NULL,
  `sandbox_passed` tinyint(1) DEFAULT NULL,
  `approved_by` bigint DEFAULT NULL,
  `closed_at` varchar(19) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_user` (`user_id`),
  KEY `idx_approval_status` (`status`),
  KEY `idx_approval_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 2. 审批操作流水 =====
CREATE TABLE IF NOT EXISTS `approval_actions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approval_id` bigint NOT NULL,
  `operator_id` bigint NOT NULL,
  `action` varchar(16) NOT NULL,
  `comment` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_action_approval` (`approval_id`),
  KEY `idx_action_operator` (`operator_id`),
  CONSTRAINT `fk_action_approval` FOREIGN KEY (`approval_id`) REFERENCES `approvals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_action_operator` FOREIGN KEY (`operator_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 3. 会议派单工单 =====
CREATE TABLE IF NOT EXISTS `meeting_actions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `meeting_id` bigint NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `owner_user_id` bigint DEFAULT NULL,
  `owner_role` varchar(50) DEFAULT NULL,
  `priority` varchar(8) NOT NULL DEFAULT 'P2',
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `source_decision` varchar(500) DEFAULT NULL,
  `estimate_hours` bigint DEFAULT NULL,
  `deadline` varchar(19) DEFAULT NULL,
  `approval_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_action_meeting` (`meeting_id`),
  KEY `idx_action_status` (`status`),
  KEY `idx_action_owner` (`owner_user_id`),
  CONSTRAINT `fk_action_meeting` FOREIGN KEY (`meeting_id`) REFERENCES `meeting_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_action_owner_user` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 4. 通知推送记录 =====
CREATE TABLE IF NOT EXISTS `notification_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `biz_type` varchar(32) NOT NULL,
  `biz_id` bigint DEFAULT NULL,
  `channel` varchar(16) NOT NULL,
  `status` varchar(16) NOT NULL,
  `content` text NOT NULL,
  `error_message` text DEFAULT NULL,
  `sent_at` varchar(19) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notify_user` (`user_id`),
  KEY `idx_notify_status` (`status`),
  KEY `idx_notify_biz` (`biz_type`, `biz_id`),
  CONSTRAINT `fk_notify_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 5. IM 一对一消息 =====
CREATE TABLE IF NOT EXISTS `im_direct_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `from_user_id` bigint NOT NULL,
  `to_user_id` bigint NOT NULL,
  `content` longtext NOT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_im_pair_created` (`from_user_id`, `to_user_id`, `created_at`),
  KEY `idx_im_to_created` (`to_user_id`, `created_at`),
  CONSTRAINT `fk_im_from` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_im_to` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 6. 附件表（审批 / 其它业务关联）=====
CREATE TABLE IF NOT EXISTS `attachments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `extension` varchar(16) NOT NULL,
  `content_type` varchar(100) DEFAULT NULL,
  `size` int NOT NULL,
  `business_type` varchar(32) DEFAULT NULL,
  `business_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attachment_uploader` (`user_id`),
  KEY `idx_attachment_business` (`business_type`, `business_id`),
  CONSTRAINT `fk_attachment_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
