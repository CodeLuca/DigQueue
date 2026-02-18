CREATE TABLE `app_secrets` (
	`id` integer PRIMARY KEY NOT NULL,
	`discogs_token` text,
	`youtube_api_key` text,
	`updated_at` integer NOT NULL
);
