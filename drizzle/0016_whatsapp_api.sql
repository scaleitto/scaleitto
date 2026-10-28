CREATE TABLE `shop_whatsapp` (
	`shop_id` varchar(36) NOT NULL,
	`phone_number_id` varchar(40) NOT NULL,
	`token` text NOT NULL,
	`templates` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shop_whatsapp_shop_id` PRIMARY KEY(`shop_id`)
);
