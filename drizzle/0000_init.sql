CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(36),
	`variant_id` varchar(36),
	`name` varchar(200) NOT NULL,
	`variant_title` varchar(200),
	`sku` varchar(80),
	`unit_price` int NOT NULL,
	`quantity` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`number` int NOT NULL,
	`customer_name` varchar(120) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`wilaya_code` int NOT NULL,
	`commune` varchar(120) NOT NULL,
	`address` varchar(255),
	`delivery_type` enum('home','desk') NOT NULL,
	`subtotal` int NOT NULL,
	`shipping_cost` int NOT NULL,
	`total` int NOT NULL,
	`status` enum('new','confirmed','shipped','delivered','returned','cancelled') NOT NULL DEFAULT 'new',
	`note` text,
	`ip` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_shop_number_uq` UNIQUE(`shop_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` varchar(36) NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(80) NOT NULL,
	`price_monthly` int NOT NULL DEFAULT 0,
	`limits` json NOT NULL,
	`features` json NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`option_values` json NOT NULL,
	`title` varchar(200) NOT NULL,
	`sku` varchar(80),
	`price` int,
	`stock` int NOT NULL DEFAULT 0,
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
	`sku` varchar(80),
	`stock` int NOT NULL DEFAULT 0,
	`track_stock` boolean NOT NULL DEFAULT true,
	`images` json NOT NULL,
	`options` json NOT NULL,
	`status` enum('active','draft') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_shop_slug_uq` UNIQUE(`shop_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`shop_id` varchar(36) NOT NULL,
	`wilaya_code` int NOT NULL,
	`home_price` int,
	`desk_price` int,
	CONSTRAINT `shipping_rates_shop_id_wilaya_code_pk` PRIMARY KEY(`shop_id`,`wilaya_code`)
);
--> statement-breakpoint
CREATE TABLE `shop_contracts` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`limits` json NOT NULL,
	`price_monthly` int,
	`alert_threshold` int NOT NULL DEFAULT 80,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shop_members` (
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('owner','admin','confirmer') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_members_shop_id_user_id_pk` PRIMARY KEY(`shop_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(60) NOT NULL,
	`name` varchar(120) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`default_locale` varchar(5) NOT NULL DEFAULT 'ar',
	`currency` varchar(3) NOT NULL DEFAULT 'DZD',
	`phone` varchar(30),
	`logo_url` varchar(500),
	`theme` varchar(40) NOT NULL DEFAULT 'classic',
	`primary_color` varchar(9) NOT NULL DEFAULT '#4f46e5',
	`custom_domain` varchar(191),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `shops_domain_uq` UNIQUE(`custom_domain`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(120) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`is_platform_admin` boolean NOT NULL DEFAULT false,
	`locale` varchar(5) NOT NULL DEFAULT 'ar',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_shop_created_idx` ON `orders` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_phone_idx` ON `orders` (`shop_id`,`phone`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `product_variants` (`product_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `contracts_shop_idx` ON `shop_contracts` (`shop_id`);--> statement-breakpoint
CREATE INDEX `members_user_idx` ON `shop_members` (`user_id`);