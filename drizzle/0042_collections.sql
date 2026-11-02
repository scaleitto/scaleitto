CREATE TABLE `collections` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`handle` varchar(80) NOT NULL,
	`titles` json NOT NULL,
	`descriptions` json NOT NULL,
	`parent_id` varchar(36),
	`image` varchar(500),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_handle_uq` UNIQUE(`shop_id`,`handle`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `collection_ids` json;