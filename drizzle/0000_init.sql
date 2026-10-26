CREATE TABLE `error_logs` (
	`id` varchar(36) NOT NULL,
	`digest` varchar(64),
	`message` text NOT NULL,
	`stack` text,
	`path` varchar(500),
	`method` varchar(10),
	`route_type` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
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
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
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
	`role` enum('owner','manager','agent') NOT NULL,
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
	`primary_color` varchar(9) NOT NULL DEFAULT '#10b981',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(191) NOT NULL,
	`name` varchar(120) NOT NULL,
	`phone` varchar(20),
	`password_hash` varchar(255) NOT NULL,
	`is_platform_admin` boolean NOT NULL DEFAULT false,
	`locale` varchar(5) NOT NULL DEFAULT 'ar',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `errors_created_idx` ON `error_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `contracts_shop_idx` ON `shop_contracts` (`shop_id`);--> statement-breakpoint
CREATE INDEX `members_user_idx` ON `shop_members` (`user_id`);