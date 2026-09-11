CREATE TABLE `contracts` (
	`id` char(36) NOT NULL,
	`vendor_id` char(36),
	`asset_id` char(36),
	`title` varchar(255) NOT NULL,
	`value` decimal(15,2),
	`start_date` date,
	`end_date` date,
	`notice_period_days` int unsigned,
	`auto_renews` boolean NOT NULL DEFAULT false,
	`owner` varchar(255),
	`status` enum('Active','Terminated') NOT NULL DEFAULT 'Active',
	`doc_url` varchar(500),
	`notes` text,
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_contracts_vendor` ON `contracts` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `idx_contracts_asset` ON `contracts` (`asset_id`);