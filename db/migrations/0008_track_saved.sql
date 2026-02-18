ALTER TABLE `tracks` ADD `saved` integer NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE `tracks` SET `saved` = `wishlist`;
