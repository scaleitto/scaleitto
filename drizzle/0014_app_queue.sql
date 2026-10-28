CREATE TABLE `app_queue` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`event` varchar(20) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`next_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`last_error` varchar(500),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `app_queue_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_queue_order_uq` UNIQUE(`shop_id`,`order_id`)
);
--> statement-breakpoint
CREATE INDEX `app_queue_due_idx` ON `app_queue` (`next_at`);