CREATE TABLE `shop_payment_methods` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`method` varchar(20) NOT NULL,
	`connector` varchar(20) NOT NULL,
	`credentials` text NOT NULL,
	`mode` enum('test','live') NOT NULL DEFAULT 'test',
	`active` boolean NOT NULL DEFAULT true,
	`checked_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_payment_methods_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_payment_methods_uq` UNIQUE(`shop_id`,`method`)
);
--> statement-breakpoint
DROP TABLE `shop_payments`;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `payment_method` varchar(20) NOT NULL DEFAULT 'cod';