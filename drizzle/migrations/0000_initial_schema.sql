CREATE TABLE `app_settings` (
	`key` varchar(255) NOT NULL,
	`value` text,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `asset_architects` (
	`asset_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`user_name` varchar(255) NOT NULL,
	CONSTRAINT `asset_architects_asset_id_user_id_pk` PRIMARY KEY(`asset_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `asset_capabilities` (
	`asset_id` char(36) NOT NULL,
	`business_capability_id` char(36) NOT NULL,
	CONSTRAINT `asset_capabilities_asset_id_business_capability_id_pk` PRIMARY KEY(`asset_id`,`business_capability_id`)
);
--> statement-breakpoint
CREATE TABLE `asset_complexities` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sort_order` int unsigned,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_complexities_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_asset_complexities_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `asset_departments` (
	`asset_id` char(36) NOT NULL,
	`department_id` char(36) NOT NULL,
	CONSTRAINT `asset_departments_asset_id_department_id_pk` PRIMARY KEY(`asset_id`,`department_id`)
);
--> statement-breakpoint
CREATE TABLE `asset_dependencies` (
	`id` char(36) NOT NULL,
	`source_asset_id` char(36) NOT NULL,
	`target_asset_id` char(36) NOT NULL,
	`type` enum('API','Database','File Transfer','Event / Message','UI Embed','Other') NOT NULL DEFAULT 'API',
	`direction` enum('outbound','bidirectional') NOT NULL DEFAULT 'outbound',
	`notes` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_dependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_dep_pair` UNIQUE(`source_asset_id`,`target_asset_id`)
);
--> statement-breakpoint
CREATE TABLE `asset_roadmap_phases` (
	`id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`classification_id` char(36) NOT NULL,
	`start_quarter` varchar(7) NOT NULL,
	`end_quarter` varchar(7) NOT NULL,
	`notes` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_roadmap_phases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asset_strategies` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sort_order` int unsigned,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_strategies_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_asset_strategies_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`short_code` varchar(50),
	`description` text,
	`type` enum('SaaS','On-Premise','Hybrid','Cloud','Open Source','Other') NOT NULL DEFAULT 'Other',
	`category` varchar(100) NOT NULL DEFAULT 'Application',
	`icon` varchar(100) DEFAULT 'Server',
	`hero_diagram_id` char(36),
	`vendor_id` char(36),
	`lifecycle_status` enum('Proposed','Approved','In Development','Production','Sunset','Retired') NOT NULL DEFAULT 'Proposed',
	`business_owner` varchar(255),
	`technical_owner` varchar(255),
	`vendor` varchar(255),
	`sla_availability` varchar(50),
	`sla_rto` varchar(100),
	`sla_rpo` varchar(100),
	`go_live_date` date,
	`retirement_date` date,
	`app_url` varchar(500),
	`notes` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`domain_id` char(36),
	`tier_id` char(36),
	`strategy_id` char(36),
	`doc_url` varchar(500),
	`contract_end_date` date,
	`contract_amount` decimal(15,2),
	`complexity_id` char(36),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` char(36) NOT NULL,
	`table_name` varchar(100) NOT NULL,
	`record_id` char(36) NOT NULL,
	`action` enum('CREATE','UPDATE','DELETE') NOT NULL,
	`performed_by_id` char(36) NOT NULL,
	`performed_by_name` varchar(255) NOT NULL,
	`performed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`old_values` longtext,
	`new_values` longtext,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_capabilities` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`industry_sector_id` char(36) NOT NULL,
	`sort_order` int unsigned,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_capabilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `changelog` (
	`id` char(36) NOT NULL,
	`version` varchar(50) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`type` enum('feature','fix','improvement','breaking') NOT NULL DEFAULT 'feature',
	`released_at` date NOT NULL,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `changelog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('Published','Unpublished') NOT NULL DEFAULT 'Unpublished',
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_departments_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `diagram_assets` (
	`diagram_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	CONSTRAINT `diagram_assets_diagram_id_asset_id_pk` PRIMARY KEY(`diagram_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `diagram_types` (
	`id` char(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`sort_order` int unsigned,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `diagram_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_diagram_type_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `diagram_versions` (
	`id` char(36) NOT NULL,
	`diagram_id` char(36) NOT NULL,
	`version_number` int unsigned NOT NULL,
	`content` longtext NOT NULL,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `diagram_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_diagram_version` UNIQUE(`diagram_id`,`version_number`)
);
--> statement-breakpoint
CREATE TABLE `diagrams` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`project_id` char(36),
	`diagram_type_id` char(36),
	CONSTRAINT `diagrams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `domains_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_domains_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `industry_sectors` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `industry_sectors_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_industry_sectors_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `investment_classifications` (
	`id` char(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL,
	`sort_order` int unsigned,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investment_classifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plantuml_diagram_assets` (
	`diagram_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`matched_on` varchar(255),
	`tagged_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `plantuml_diagram_assets_diagram_id_asset_id_pk` PRIMARY KEY(`diagram_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `plantuml_diagrams` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`project_id` char(36),
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plantuml_diagrams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plantuml_versions` (
	`id` char(36) NOT NULL,
	`diagram_id` char(36) NOT NULL,
	`version_number` int unsigned NOT NULL,
	`source` longtext NOT NULL,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `plantuml_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_plantuml_version` UNIQUE(`diagram_id`,`version_number`)
);
--> statement-breakpoint
CREATE TABLE `project_assets` (
	`project_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`dependency_type` enum('upstream','downstream') NOT NULL DEFAULT 'downstream',
	`notes` text,
	CONSTRAINT `project_assets_project_id_asset_id_pk` PRIMARY KEY(`project_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('Active','On Hold','Completed','Cancelled') NOT NULL DEFAULT 'Active',
	`start_date` date,
	`end_date` date,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`permission_level` enum('read-only','member','admin') NOT NULL DEFAULT 'member',
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_roles_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`user_name` varchar(255) NOT NULL,
	`type` enum('Feature Request','Report Request','Bug','Other') NOT NULL DEFAULT 'Feature Request',
	`subject` varchar(500) NOT NULL,
	`description` text,
	`status` enum('New','Acknowledged','Under Review','Will Fix','Will Not Implement','Completed') NOT NULL DEFAULT 'New',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `support_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiers` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`sla_availability` varchar(50),
	`support_hours` varchar(100),
	`response_time` varchar(100),
	`resolution_time` varchar(100),
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tiers_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_tiers_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'Member',
	`role_id` char(36),
	`token_version` int unsigned NOT NULL DEFAULT 1,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`website` varchar(500),
	`email` varchar(255),
	`phone` varchar(100),
	`address_line1` varchar(255),
	`address_line2` varchar(255),
	`city` varchar(100),
	`state_province` varchar(100),
	`country` varchar(100),
	`postal_code` varchar(20),
	`primary_contact_name` varchar(255),
	`primary_contact_role` varchar(100),
	`primary_contact_email` varchar(255),
	`primary_contact_phone` varchar(100),
	`notes` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_vendors_name` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_architects_user` ON `asset_architects` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_capabilities_cap` ON `asset_capabilities` (`business_capability_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_departments_dept` ON `asset_departments` (`department_id`);--> statement-breakpoint
CREATE INDEX `idx_dep_source` ON `asset_dependencies` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_dep_target` ON `asset_dependencies` (`target_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_phases_asset_id` ON `asset_roadmap_phases` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_phases_classification_id` ON `asset_roadmap_phases` (`classification_id`);--> statement-breakpoint
CREATE INDEX `idx_assets_lifecycle` ON `assets` (`lifecycle_status`);--> statement-breakpoint
CREATE INDEX `idx_audit_table_record` ON `audit_log` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_performed_at` ON `audit_log` (`performed_at`);--> statement-breakpoint
CREATE INDEX `idx_business_capabilities_industry` ON `business_capabilities` (`industry_sector_id`);--> statement-breakpoint
CREATE INDEX `idx_changelog_released_at` ON `changelog` (`released_at`);--> statement-breakpoint
CREATE INDEX `idx_diagram_assets_asset` ON `diagram_assets` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_diagram_versions_diagram` ON `diagram_versions` (`diagram_id`);--> statement-breakpoint
CREATE INDEX `idx_pda_asset` ON `plantuml_diagram_assets` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_plantuml_versions_diagram` ON `plantuml_versions` (`diagram_id`);--> statement-breakpoint
CREATE INDEX `idx_project_assets_asset` ON `project_assets` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_support_user` ON `support_requests` (`user_id`);