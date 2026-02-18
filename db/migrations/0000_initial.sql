CREATE TABLE `api_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`response_json` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`discogs_url` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`current_page` integer DEFAULT 1 NOT NULL,
	`total_pages` integer DEFAULT 1 NOT NULL,
	`added_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY NOT NULL,
	`label_id` integer NOT NULL,
	`title` text NOT NULL,
	`artist` text DEFAULT 'Unknown Artist' NOT NULL,
	`year` integer,
	`catno` text,
	`discogs_url` text NOT NULL,
	`thumb_url` text,
	`details_fetched` integer DEFAULT false NOT NULL,
	`youtube_matched` integer DEFAULT false NOT NULL,
	`listened` integer DEFAULT false NOT NULL,
	`wishlist` integer DEFAULT false NOT NULL,
	`fetched_at` integer NOT NULL,
	`release_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`release_id` integer NOT NULL,
	`position` text NOT NULL,
	`title` text NOT NULL,
	`duration` text,
	`artists_text` text,
	`listened` integer DEFAULT false NOT NULL,
	`wishlist` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `youtube_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`video_id` text NOT NULL,
	`title` text NOT NULL,
	`channel_title` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`embeddable` integer DEFAULT true NOT NULL,
	`chosen` integer DEFAULT false NOT NULL,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `queue_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`youtube_video_id` text NOT NULL,
	`track_id` integer,
	`release_id` integer,
	`label_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE set null
);
