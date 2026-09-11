ALTER TABLE `users` ADD `tour_enabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tour_seen_at` datetime;