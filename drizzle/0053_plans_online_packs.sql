CREATE TABLE `quota_packs` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`pack` varchar(40) NOT NULL,
	`limit_key` varchar(40) NOT NULL,
	`amount` int NOT NULL,
	`credits` int NOT NULL,
	`month` date NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quota_packs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `plan_requests` MODIFY COLUMN `method` enum('ccp','rib','whatsapp','online') NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_requests` ADD `provider_ref` varchar(80);--> statement-breakpoint
CREATE INDEX `quota_packs_shop_idx` ON `quota_packs` (`shop_id`,`month`);