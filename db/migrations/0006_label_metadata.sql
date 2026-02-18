ALTER TABLE `labels` ADD `blurb` text;
--> statement-breakpoint
ALTER TABLE `labels` ADD `image_url` text;
--> statement-breakpoint
ALTER TABLE `labels` ADD `notable_releases_json` text NOT NULL DEFAULT '[]';
