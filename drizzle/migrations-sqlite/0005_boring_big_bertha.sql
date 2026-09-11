ALTER TABLE `users` ADD `timezone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_new_feedback` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notify_contracts_expiring` integer DEFAULT true NOT NULL;