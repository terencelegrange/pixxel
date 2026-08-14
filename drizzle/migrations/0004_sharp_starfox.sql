CREATE TABLE `user_mfa_recovery_codes` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`code_hash` varchar(255) NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_mfa_recovery_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_pending_secret` text;--> statement-breakpoint
CREATE INDEX `idx_user_mfa_recovery_codes_user` ON `user_mfa_recovery_codes` (`user_id`);