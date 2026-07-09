CREATE TABLE `service_assets` (
	`service_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`role` enum('Core','Supporting','Dependency') NOT NULL DEFAULT 'Supporting',
	`notes` text,
	CONSTRAINT `service_assets_service_id_asset_id_pk` PRIMARY KEY(`service_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`status` enum('Planned','Active','Degraded','Retired') NOT NULL DEFAULT 'Planned',
	`tier_id` char(36),
	`domain_id` char(36),
	`business_owner` varchar(255),
	`technical_owner` varchar(255),
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_services_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `idx_service_assets_asset` ON `service_assets` (`asset_id`);