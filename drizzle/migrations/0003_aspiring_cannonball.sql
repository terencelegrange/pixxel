CREATE TABLE IF NOT EXISTS `asset_risks` (
	`id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` enum('Operational','Financial','Compliance','Security','Vendor','Reputational','Other') NOT NULL DEFAULT 'Operational',
	`likelihood` enum('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
	`impact` enum('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
	`status` enum('Open','Mitigating','Accepted','Closed') NOT NULL DEFAULT 'Open',
	`owner` varchar(255),
	`created_by_id` char(36) NOT NULL,
	`created_by_name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_risks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_asset_risks_asset` ON `asset_risks` (`asset_id`);