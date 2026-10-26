CREATE TABLE `ai_generations` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(40) NOT NULL,
	`model` varchar(80) NOT NULL,
	`input_tokens` int NOT NULL DEFAULT 0,
	`output_tokens` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `locale` varchar(5);--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `accent_color` varchar(9);--> statement-breakpoint
CREATE INDEX `ai_shop_created_idx` ON `ai_generations` (`shop_id`,`created_at`);