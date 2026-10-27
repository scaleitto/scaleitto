CREATE TABLE `ai_generations` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`response_id` varchar(120),
	`model` varchar(80),
	`status` enum('pending','saving','done','failed') NOT NULL DEFAULT 'pending',
	`brief` json NOT NULL,
	`landing_page_id` varchar(36),
	`error` text,
	`input_tokens` int,
	`output_tokens` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_pages` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(200) NOT NULL,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`language` varchar(5) NOT NULL DEFAULT 'ar',
	`color` varchar(9),
	`sections` json NOT NULL,
	`form` json NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `landing_shop_slug_uq` UNIQUE(`shop_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `landing_page_id` varchar(36);--> statement-breakpoint
ALTER TABLE `orders` ADD `extra` json;--> statement-breakpoint
CREATE INDEX `ai_generations_shop_created_idx` ON `ai_generations` (`shop_id`,`created_at`);