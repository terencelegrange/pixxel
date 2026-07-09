CREATE TABLE `service_assets` (
	`service_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`role` text DEFAULT 'Supporting' NOT NULL,
	`notes` text,
	PRIMARY KEY(`service_id`, `asset_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_service_assets_asset` ON `service_assets` (`asset_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Planned' NOT NULL,
	`tier_id` text,
	`domain_id` text,
	`business_owner` text,
	`technical_owner` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_services_slug` ON `services` (`slug`);