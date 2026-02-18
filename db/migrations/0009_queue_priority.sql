ALTER TABLE `queue_items` ADD `priority` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `queue_items` ADD `bumped_at` integer;
