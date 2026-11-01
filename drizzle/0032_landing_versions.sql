CREATE TABLE `landing_versions` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`page_id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`sections` json NOT NULL,
	`form_template_id` varchar(36),
	`user_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `landing_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `landing_versions_page_idx` ON `landing_versions` (`page_id`,`created_at`);