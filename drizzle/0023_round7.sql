CREATE TABLE `expenses` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`day` date NOT NULL,
	`category` enum('ads','shipping','returns','packaging','salaries','subscription','other') NOT NULL,
	`amount` int NOT NULL,
	`note` varchar(200),
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_templates` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`form` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`delta` int NOT NULL,
	`reason` enum('order','cancel','return','reopen','restock','adjust','damaged','edit') NOT NULL,
	`note` varchar(200),
	`order_id` varchar(36),
	`user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` datetime;--> statement-breakpoint
ALTER TABLE `products` ADD `form_template_id` varchar(36);--> statement-breakpoint
ALTER TABLE `shipments` ADD `return_received_at` datetime;--> statement-breakpoint
ALTER TABLE `shops` ADD `low_stock` int DEFAULT 5 NOT NULL;--> statement-breakpoint
CREATE INDEX `expenses_shop_day_idx` ON `expenses` (`shop_id`,`day`);--> statement-breakpoint
CREATE INDEX `form_templates_shop_idx` ON `form_templates` (`shop_id`);--> statement-breakpoint
CREATE INDEX `stock_movements_shop_idx` ON `stock_movements` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`product_id`,`created_at`);