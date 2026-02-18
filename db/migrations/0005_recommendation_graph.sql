CREATE TABLE `feedback_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer,
	`release_id` integer,
	`label_id` integer,
	`event_type` text NOT NULL,
	`event_value` real DEFAULT 1 NOT NULL,
	`source` text DEFAULT 'app' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `release_signals` (
	`release_id` integer PRIMARY KEY NOT NULL,
	`primary_artist` text,
	`styles_text` text DEFAULT '' NOT NULL,
	`genres_text` text DEFAULT '' NOT NULL,
	`contributors_text` text DEFAULT '' NOT NULL,
	`companies_text` text DEFAULT '' NOT NULL,
	`format_text` text DEFAULT '' NOT NULL,
	`country` text,
	`year` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade
);
