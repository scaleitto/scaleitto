CREATE TABLE `plan_requests` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`months` int NOT NULL,
	`amount` int NOT NULL,
	`method` enum('ccp','rib','whatsapp') NOT NULL,
	`receipt_url` varchar(255),
	`note` varchar(500),
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`admin_note` varchar(500),
	`requested_by` varchar(36) NOT NULL,
	`decided_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plan_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `locked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `shops` ADD `plan_expires_at` datetime;--> statement-breakpoint
CREATE INDEX `plan_requests_shop_idx` ON `plan_requests` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `plan_requests_status_idx` ON `plan_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_shop_locked_idx` ON `orders` (`shop_id`,`locked`,`created_at`);