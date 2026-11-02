CREATE TABLE `promotions` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`percent` int NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`product_ids` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `promotions_shop_idx` ON `promotions` (`shop_id`,`ends_at`);