CREATE TABLE `asset_risks` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'Operational' NOT NULL,
	`likelihood` text DEFAULT 'Medium' NOT NULL,
	`impact` text DEFAULT 'Medium' NOT NULL,
	`status` text DEFAULT 'Open' NOT NULL,
	`owner` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_asset_risks_asset` ON `asset_risks` (`asset_id`);