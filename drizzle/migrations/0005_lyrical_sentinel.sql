ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `timezone` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `language` varchar(10) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `notify_new_feedback` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `notify_contracts_expiring` boolean DEFAULT true NOT NULL;