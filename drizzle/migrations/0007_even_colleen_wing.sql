CREATE TABLE IF NOT EXISTS `api_keys` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`contact` varchar(255),
	`key_prefix` varchar(12) NOT NULL,
	`key_hash` char(64) NOT NULL,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`expires_at` datetime,
	`last_used_at` datetime,
	`use_count` int unsigned NOT NULL DEFAULT 0,
	`revoked_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_api_keys_key_hash` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_api_keys_revoked_at` ON `api_keys` (`revoked_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_api_keys_created_by` ON `api_keys` (`created_by_id`);