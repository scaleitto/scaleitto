CREATE TABLE `member_invites` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` enum('owner','manager','agent') NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`invited_by` varchar(36),
	`expires_at` datetime NOT NULL,
	`accepted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `member_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_invites_token_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `shop_channels` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`kind` enum('shopify','woocommerce') NOT NULL,
	`token` varchar(40) NOT NULL,
	`secret` text NOT NULL,
	`store_url` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`last_order_at` datetime,
	`orders_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shop_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `shop_channels_shop_kind_uq` UNIQUE(`shop_id`,`kind`),
	CONSTRAINT `shop_channels_token_uq` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `channel` varchar(20);--> statement-breakpoint
ALTER TABLE `orders` ADD `external_ref` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_shop_external_uq` UNIQUE(`shop_id`,`external_ref`);--> statement-breakpoint
CREATE INDEX `member_invites_shop_idx` ON `member_invites` (`shop_id`);