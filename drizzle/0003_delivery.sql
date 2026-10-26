CREATE TABLE `carrier_accounts` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`carrier` varchar(40) NOT NULL,
	`platform` enum('yalidine','ecotrack','procolis','noest') NOT NULL,
	`base_url` varchar(255) NOT NULL,
	`credentials` text NOT NULL,
	`origin_wilaya` int NOT NULL DEFAULT 16,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `carrier_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `carrier_accounts_shop_carrier_uq` UNIQUE(`shop_id`,`carrier`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`carrier_account_id` varchar(36),
	`carrier_name` varchar(80) NOT NULL,
	`tracking_number` varchar(80) NOT NULL,
	`label_url` varchar(500),
	`status` enum('created','in_transit','out_for_delivery','attempted','delivered','returning','returned','cancelled','unknown') NOT NULL DEFAULT 'created',
	`raw_status` varchar(120),
	`checked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `shipments_order_uq` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE INDEX `shipments_shop_status_idx` ON `shipments` (`shop_id`,`status`);