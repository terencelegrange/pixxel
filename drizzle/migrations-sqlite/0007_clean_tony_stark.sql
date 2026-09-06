CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_api_keys_key_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_revoked_at` ON `api_keys` (`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_api_keys_created_by` ON `api_keys` (`created_by_id`);