CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text,
	`asset_id` text,
	`title` text NOT NULL,
	`value` real,
	`start_date` text,
	`end_date` text,
	`notice_period_days` integer,
	`auto_renews` integer DEFAULT false NOT NULL,
	`owner` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`doc_url` text,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_contracts_vendor` ON `contracts` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_asset` ON `contracts` (`asset_id`);