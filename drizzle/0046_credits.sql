CREATE TABLE `credit_ledger` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`amount` int NOT NULL,
	`kind` enum('trial','subscription','purchase','admin','whatsapp','notification','refund','ai') NOT NULL,
	`note` varchar(200),
	`balance_after` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_purchases` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`pack` varchar(20) NOT NULL,
	`credits` int NOT NULL,
	`amount` int NOT NULL,
	`method` enum('card','ccp','rib','whatsapp') NOT NULL,
	`receipt_url` varchar(255),
	`note` varchar(500),
	`status` enum('pending','paid','rejected') NOT NULL DEFAULT 'pending',
	`provider_ref` varchar(80),
	`admin_note` varchar(500),
	`requested_by` varchar(36) NOT NULL,
	`decided_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `shops` ADD `credits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `credit_ledger_shop_idx` ON `credit_ledger` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_purchases_shop_idx` ON `credit_purchases` (`shop_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_purchases_status_idx` ON `credit_purchases` (`status`,`created_at`);--> statement-breakpoint
UPDATE `shops` SET `credits` = 500;--> statement-breakpoint
INSERT INTO `credit_ledger` (`id`, `shop_id`, `amount`, `kind`, `note`, `balance_after`) SELECT UUID(), `id`, 500, 'trial', NULL, 500 FROM `shops`;
