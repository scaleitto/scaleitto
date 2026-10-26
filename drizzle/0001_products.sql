CREATE TABLE `product_variants` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`option_values` json NOT NULL,
	`title` varchar(200) NOT NULL,
	`sku` varchar(80),
	`price` int,
	`stock` int NOT NULL DEFAULT 0,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text,
	`price` int NOT NULL,
	`compare_at_price` int,
	`cost_price` int,
	`sku` varchar(80),
	`track_stock` boolean NOT NULL DEFAULT false,
	`stock` int NOT NULL DEFAULT 0,
	`images` json NOT NULL,
	`options` json NOT NULL,
	`offers` json NOT NULL,
	`status` enum('active','draft') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_shop_slug_uq` UNIQUE(`shop_id`,`slug`)
);
--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `products_shop_created_idx` ON `products` (`shop_id`,`created_at`);