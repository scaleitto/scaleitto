CREATE TABLE `whatsapp_messages` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`kind` enum('confirm','reminder','confirmed','shipped','delivered','out_for_delivery','failed_attempt','at_desk') NOT NULL,
	`status` enum('queued','sent','delivered','read','failed','skipped') NOT NULL DEFAULT 'queued',
	`wamid` varchar(128),
	`credits` int NOT NULL DEFAULT 0,
	`error` varchar(200),
	`due_at` datetime NOT NULL,
	`sent_at` datetime,
	`read_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_messages_uq` UNIQUE(`order_id`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `whatsapp` enum('waiting','confirmed','cancelled');--> statement-breakpoint
CREATE INDEX `whatsapp_messages_due_idx` ON `whatsapp_messages` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_messages_wamid_idx` ON `whatsapp_messages` (`wamid`);--> statement-breakpoint
CREATE INDEX `whatsapp_messages_shop_idx` ON `whatsapp_messages` (`shop_id`,`created_at`);