ALTER TABLE `labels` ADD `source_type` text NOT NULL DEFAULT 'workspace';
--> statement-breakpoint
ALTER TABLE `releases` ADD `import_source` text NOT NULL DEFAULT 'label';
--> statement-breakpoint
UPDATE `releases` SET `import_source` = 'discogs_want' WHERE `label_id` = -900001;
--> statement-breakpoint
UPDATE `labels` SET `source_type` = 'derived_want' WHERE `id` = -900001;
