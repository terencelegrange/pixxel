ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `tour_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `tour_seen_at` datetime;