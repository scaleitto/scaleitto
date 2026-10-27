CREATE TABLE `app_events` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`app` enum('google_sheets','webhook') NOT NULL,
	`order_id` varchar(36),
	`kind` varchar(20) NOT NULL,
	`ok` boolean NOT NULL,
	`detail` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `app_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_apps` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`app` enum('google_sheets','webhook') NOT NULL,
	`url` varchar(500) NOT NULL,
	`secret` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_apps_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_apps_shop_app_uq` UNIQUE(`shop_id`,`app`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `external_ref` varchar(191);--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_shop_external_uq` UNIQUE(`shop_id`,`external_ref`);--> statement-breakpoint
CREATE INDEX `app_events_shop_idx` ON `app_events` (`shop_id`,`created_at`);