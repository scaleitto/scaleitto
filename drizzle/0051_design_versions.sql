CREATE TABLE `design_versions` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`pages` json NOT NULL,
	`user_id` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `design_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `design_versions_shop_idx` ON `design_versions` (`shop_id`,`created_at`);