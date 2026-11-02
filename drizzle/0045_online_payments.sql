CREATE TABLE `shop_payments` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`provider` enum('chargily','slickpay') NOT NULL,
	`credentials` text NOT NULL,
	`mode` enum('test','live') NOT NULL DEFAULT 'test',
	`fees_on_buyer` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`checked_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_payments_uq` UNIQUE(`shop_id`,`provider`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method` enum('cod','card') DEFAULT 'cod' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` enum('none','pending','paid','failed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_provider` varchar(20);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_ref` varchar(80);--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` datetime;