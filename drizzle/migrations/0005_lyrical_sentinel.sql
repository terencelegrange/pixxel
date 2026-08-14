ALTER TABLE `users` ADD `timezone` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `language` varchar(10) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_new_feedback` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_contracts_expiring` boolean DEFAULT true NOT NULL;