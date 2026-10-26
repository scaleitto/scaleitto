CREATE TABLE `ai_jobs` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`status` enum('queued','running','done','failed') NOT NULL DEFAULT 'queued',
	`stage` varchar(30),
	`input` json NOT NULL,
	`landing_page_id` varchar(36),
	`error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_jobs_shop_idx` ON `ai_jobs` (`shop_id`,`created_at`);