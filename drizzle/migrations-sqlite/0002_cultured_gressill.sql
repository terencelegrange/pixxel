CREATE TABLE `asset_risk_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`risk_factor_id` text NOT NULL,
	`status` text DEFAULT 'Not Met' NOT NULL,
	`notes` text,
	`assessed_by_id` text NOT NULL,
	`assessed_by_name` text NOT NULL,
	`assessed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_asset_risk` ON `asset_risk_assessments` (`asset_id`,`risk_factor_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_risk_factor` ON `asset_risk_assessments` (`risk_factor_id`);--> statement-breakpoint
CREATE TABLE `feature_tier_features` (
	`tier_id` text NOT NULL,
	`feature_key` text NOT NULL,
	PRIMARY KEY(`tier_id`, `feature_key`)
);
--> statement-breakpoint
CREATE TABLE `feature_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer,
	`is_default` integer DEFAULT false NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_feature_tiers_name` ON `feature_tiers` (`name`);--> statement-breakpoint
CREATE TABLE `risk_factor_categories` (
	`risk_factor_id` text NOT NULL,
	`category` text NOT NULL,
	PRIMARY KEY(`risk_factor_id`, `category`)
);
--> statement-breakpoint
CREATE INDEX `idx_risk_factor_categories_category` ON `risk_factor_categories` (`category`);--> statement-breakpoint
CREATE TABLE `risk_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kind` text DEFAULT 'Attribute' NOT NULL,
	`severity` text DEFAULT 'Medium' NOT NULL,
	`likelihood` text DEFAULT 'Medium' NOT NULL,
	`impact` text DEFAULT 'Medium' NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_risk_factors_name` ON `risk_factors` (`name`);