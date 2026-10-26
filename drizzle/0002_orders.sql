CREATE TABLE `blocked_phones` (
	`shop_id` varchar(36) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`reason` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_phones_shop_id_phone_pk` PRIMARY KEY(`shop_id`,`phone`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`quantity` int NOT NULL DEFAULT 1,
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
CREATE TABLE `order_events` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`type` enum('created','status','note','edit') NOT NULL,
	`from_status` varchar(20),
	`to_status` varchar(20),
	`note` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`variant_id` varchar(36),
	`name` varchar(200) NOT NULL,
	`variant_title` varchar(200),
	`sku` varchar(80),
	`unit_price` int NOT NULL,
	`quantity` int NOT NULL,
	`total` int NOT NULL,
	`offer_label` varchar(60),
	`stock_tracked` boolean NOT NULL DEFAULT false,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`number` int NOT NULL,
	`status` enum('new','no_answer','postponed','confirmed','shipped','delivered','returned','cancelled') NOT NULL DEFAULT 'new',
	`customer_name` varchar(120) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`wilaya_code` int NOT NULL,
	`commune` varchar(120) NOT NULL,
	`address` varchar(255),
	`delivery_type` enum('home','office') NOT NULL,
	`subtotal` int NOT NULL,
	`shipping_price` int NOT NULL,
	`total` int NOT NULL,
	`customer_note` varchar(500),
	`ip` varchar(45),
	`user_agent` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_shop_number_uq` UNIQUE(`shop_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`shop_id` varchar(36) NOT NULL,
	`wilaya_code` int NOT NULL,
	`home_price` int,
	`office_price` int,
	CONSTRAINT `shipping_rates_shop_id_wilaya_code_pk` PRIMARY KEY(`shop_id`,`wilaya_code`)
);
--> statement-breakpoint
CREATE INDEX `leads_shop_status_idx` ON `leads` (`shop_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_shop_phone_idx` ON `leads` (`shop_id`,`phone`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_shop_created_idx` ON `orders` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_shop_status_idx` ON `orders` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_shop_phone_idx` ON `orders` (`shop_id`,`phone`);