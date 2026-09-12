CREATE TABLE IF NOT EXISTS `asset_risk_assessments` (
	`id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`risk_factor_id` char(36) NOT NULL,
	`status` enum('Met','Not Met','Partial') NOT NULL DEFAULT 'Not Met',
	`notes` text,
	`assessed_by_id` char(36) NOT NULL,
	`assessed_by_name` varchar(255) NOT NULL,
	`assessed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_risk_assessments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_asset_risk` UNIQUE(`asset_id`,`risk_factor_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feature_tier_features` (
	`tier_id` char(36) NOT NULL,
	`feature_key` varchar(100) NOT NULL,
	CONSTRAINT `feature_tier_features_tier_id_feature_key_pk` PRIMARY KEY(`tier_id`,`feature_key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feature_tiers` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sort_order` int unsigned,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feature_tiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_feature_tiers_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `risk_factor_categories` (
	`risk_factor_id` char(36) NOT NULL,
	`category` varchar(100) NOT NULL,
	CONSTRAINT `risk_factor_categories_risk_factor_id_category_pk` PRIMARY KEY(`risk_factor_id`,`category`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `risk_factors` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`kind` enum('Attribute','Characteristic') NOT NULL DEFAULT 'Attribute',
	`severity` enum('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
	`likelihood` enum('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
	`impact` enum('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risk_factors_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_risk_factors_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_asset_risk_factor` ON `asset_risk_assessments` (`risk_factor_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_risk_factor_categories_category` ON `risk_factor_categories` (`category`);