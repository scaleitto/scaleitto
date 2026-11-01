CREATE TABLE `landing_stats` (
	`page_id` varchar(36) NOT NULL,
	`version` varchar(1) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	CONSTRAINT `landing_stats_page_id_version_pk` PRIMARY KEY(`page_id`,`version`)
);
--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `variants` json;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `published` json;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `meta_description` varchar(300);--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `pixels` json;--> statement-breakpoint
ALTER TABLE `orders` ADD `landing_version` varchar(1);--> statement-breakpoint
ALTER TABLE `landing_pages` DROP COLUMN `strategy`;--> statement-breakpoint
ALTER TABLE `shops` DROP COLUMN `ai_prompt`;--> statement-breakpoint
UPDATE `landing_pages` SET `published` = CONCAT('{"sections":', `sections`, ',"variants":[]}') WHERE `status` = 'published';--> statement-breakpoint
INSERT INTO `landing_stats` (`page_id`, `version`, `shop_id`, `views`) SELECT `id`, 'A', `shop_id`, `views` FROM `landing_pages` WHERE `views` > 0;--> statement-breakpoint
UPDATE `orders` SET `landing_version` = 'A' WHERE `landing_page_id` IS NOT NULL;
