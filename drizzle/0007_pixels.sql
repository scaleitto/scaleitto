CREATE TABLE `pixel_events` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`pixel_id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`event` varchar(40) NOT NULL,
	`status` enum('sending','sent','failed') NOT NULL,
	`detail` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `pixel_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `pixel_events_once_uq` UNIQUE(`pixel_id`,`order_id`,`event`)
);
--> statement-breakpoint
CREATE TABLE `pixels` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`platform` enum('meta','tiktok','ga4','gtm') NOT NULL,
	`name` varchar(80) NOT NULL,
	`tag_id` varchar(40) NOT NULL,
	`secret` text,
	`test_code` varchar(40),
	`purchase_on` enum('placed','confirmed','delivered') NOT NULL DEFAULT 'placed',
	`product_ids` json,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pixels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking` json;--> statement-breakpoint
CREATE INDEX `pixel_events_shop_idx` ON `pixel_events` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `pixels_shop_idx` ON `pixels` (`shop_id`);