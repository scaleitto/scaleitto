CREATE TABLE `landing_pages` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(200) NOT NULL,
	`sections` json NOT NULL,
	`status` enum('active','draft') NOT NULL DEFAULT 'active',
	`views` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `landing_shop_slug_uq` UNIQUE(`shop_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`landing_page_id` varchar(36),
	`name` varchar(120),
	`phone` varchar(20) NOT NULL,
	`wilaya_code` int,
	`status` enum('abandoned','contacted','converted') NOT NULL DEFAULT 'abandoned',
	`order_id` varchar(36),
	`ip` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `line_total` int;--> statement-breakpoint
ALTER TABLE `order_items` ADD `is_upsell` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `landing_page_id` varchar(36);--> statement-breakpoint
ALTER TABLE `products` ADD `offers` json;--> statement-breakpoint
ALTER TABLE `products` ADD `upsell_product_id` varchar(36);--> statement-breakpoint
ALTER TABLE `products` ADD `upsell_price` int;--> statement-breakpoint
ALTER TABLE `shops` ADD `meta_pixel_id` varchar(30);--> statement-breakpoint
ALTER TABLE `shops` ADD `tiktok_pixel_id` varchar(40);--> statement-breakpoint
ALTER TABLE `shops` ADD `gtm_id` varchar(20);--> statement-breakpoint
CREATE INDEX `leads_shop_status_idx` ON `leads` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `leads_shop_phone_idx` ON `leads` (`shop_id`,`phone`);