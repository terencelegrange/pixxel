CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `asset_architects` (
	`asset_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	PRIMARY KEY(`asset_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_architects_user` ON `asset_architects` (`user_id`);--> statement-breakpoint
CREATE TABLE `asset_capabilities` (
	`asset_id` text NOT NULL,
	`business_capability_id` text NOT NULL,
	PRIMARY KEY(`asset_id`, `business_capability_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_capabilities_cap` ON `asset_capabilities` (`business_capability_id`);--> statement-breakpoint
CREATE TABLE `asset_complexities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_asset_complexities_name` ON `asset_complexities` (`name`);--> statement-breakpoint
CREATE TABLE `asset_departments` (
	`asset_id` text NOT NULL,
	`department_id` text NOT NULL,
	PRIMARY KEY(`asset_id`, `department_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_departments_dept` ON `asset_departments` (`department_id`);--> statement-breakpoint
CREATE TABLE `asset_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`source_asset_id` text NOT NULL,
	`target_asset_id` text NOT NULL,
	`type` text DEFAULT 'API' NOT NULL,
	`direction` text DEFAULT 'outbound' NOT NULL,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dep_pair` ON `asset_dependencies` (`source_asset_id`,`target_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_dep_source` ON `asset_dependencies` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `idx_dep_target` ON `asset_dependencies` (`target_asset_id`);--> statement-breakpoint
CREATE TABLE `asset_roadmap_phases` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`classification_id` text NOT NULL,
	`start_quarter` text NOT NULL,
	`end_quarter` text NOT NULL,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phases_asset_id` ON `asset_roadmap_phases` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_phases_classification_id` ON `asset_roadmap_phases` (`classification_id`);--> statement-breakpoint
CREATE TABLE `asset_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_asset_strategies_name` ON `asset_strategies` (`name`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_code` text,
	`description` text,
	`type` text DEFAULT 'Other' NOT NULL,
	`category` text DEFAULT 'Application' NOT NULL,
	`icon` text DEFAULT 'Server',
	`hero_diagram_id` text,
	`vendor_id` text,
	`lifecycle_status` text DEFAULT 'Proposed' NOT NULL,
	`business_owner` text,
	`technical_owner` text,
	`vendor` text,
	`sla_availability` text,
	`sla_rto` text,
	`sla_rpo` text,
	`go_live_date` text,
	`retirement_date` text,
	`app_url` text,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`domain_id` text,
	`tier_id` text,
	`strategy_id` text,
	`doc_url` text,
	`contract_end_date` text,
	`contract_amount` real,
	`complexity_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_assets_lifecycle` ON `assets` (`lifecycle_status`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`action` text NOT NULL,
	`performed_by_id` text NOT NULL,
	`performed_by_name` text NOT NULL,
	`performed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`old_values` text,
	`new_values` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_table_record` ON `audit_log` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_performed_at` ON `audit_log` (`performed_at`);--> statement-breakpoint
CREATE TABLE `business_capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`industry_sector_id` text NOT NULL,
	`sort_order` integer,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_business_capabilities_industry` ON `business_capabilities` (`industry_sector_id`);--> statement-breakpoint
CREATE TABLE `changelog` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'feature' NOT NULL,
	`released_at` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_changelog_released_at` ON `changelog` (`released_at`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Unpublished' NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_departments_name` ON `departments` (`name`);--> statement-breakpoint
CREATE TABLE `diagram_assets` (
	`diagram_id` text NOT NULL,
	`asset_id` text NOT NULL,
	PRIMARY KEY(`diagram_id`, `asset_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_diagram_assets_asset` ON `diagram_assets` (`asset_id`);--> statement-breakpoint
CREATE TABLE `diagram_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_diagram_type_name` ON `diagram_types` (`name`);--> statement-breakpoint
CREATE TABLE `diagram_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`diagram_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`content` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_diagram_version` ON `diagram_versions` (`diagram_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_diagram_versions_diagram` ON `diagram_versions` (`diagram_id`);--> statement-breakpoint
CREATE TABLE `diagrams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` text,
	`diagram_type_id` text
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_domains_name` ON `domains` (`name`);--> statement-breakpoint
CREATE TABLE `industry_sectors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_industry_sectors_name` ON `industry_sectors` (`name`);--> statement-breakpoint
CREATE TABLE `investment_classifications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plantuml_diagram_assets` (
	`diagram_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`matched_on` text,
	`tagged_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`diagram_id`, `asset_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_pda_asset` ON `plantuml_diagram_assets` (`asset_id`);--> statement-breakpoint
CREATE TABLE `plantuml_diagrams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`project_id` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plantuml_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`diagram_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`source` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_plantuml_version` ON `plantuml_versions` (`diagram_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_plantuml_versions_diagram` ON `plantuml_versions` (`diagram_id`);--> statement-breakpoint
CREATE TABLE `project_assets` (
	`project_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`dependency_type` text DEFAULT 'downstream' NOT NULL,
	`notes` text,
	PRIMARY KEY(`project_id`, `asset_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_project_assets_asset` ON `project_assets` (`asset_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permission_level` text DEFAULT 'member' NOT NULL,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_roles_name` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`type` text DEFAULT 'Feature Request' NOT NULL,
	`subject` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'New' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_support_user` ON `support_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sla_availability` text,
	`support_hours` text,
	`response_time` text,
	`resolution_time` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tiers_name` ON `tiers` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'Member' NOT NULL,
	`role_id` text,
	`token_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`email` text,
	`phone` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state_province` text,
	`country` text,
	`postal_code` text,
	`primary_contact_name` text,
	`primary_contact_role` text,
	`primary_contact_email` text,
	`primary_contact_phone` text,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vendors_name` ON `vendors` (`name`);