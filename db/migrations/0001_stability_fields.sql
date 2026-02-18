ALTER TABLE `labels` ADD `retry_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `labels` ADD `last_error` text;
--> statement-breakpoint
ALTER TABLE `releases` ADD `match_confidence` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `releases` ADD `processing_error` text;
--> statement-breakpoint
ALTER TABLE `queue_items` ADD `source` text DEFAULT 'track' NOT NULL;
