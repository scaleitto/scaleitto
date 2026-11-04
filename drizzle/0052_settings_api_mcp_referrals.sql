CREATE TABLE `mcp_tokens` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`scopes` json NOT NULL,
	`client` varchar(120),
	`last_used_at` datetime,
	`revoked_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mcp_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_tokens_hash_uq` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `referral_vouchers` (
	`id` varchar(36) NOT NULL,
	`shop_id` varchar(36) NOT NULL,
	`referred_shop_id` varchar(36) NOT NULL,
	`status` enum('pending','available','used') NOT NULL DEFAULT 'pending',
	`value` int NOT NULL DEFAULT 0,
	`available_at` datetime,
	`used_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_vouchers_uq` UNIQUE(`shop_id`,`referred_shop_id`)
);
--> statement-breakpoint
ALTER TABLE `plan_requests` ADD `discount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `plan_requests` ADD `voucher_id` varchar(36);--> statement-breakpoint
ALTER TABLE `shops` ADD `api_origins` json;--> statement-breakpoint
ALTER TABLE `shops` ADD `referred_by` varchar(36);--> statement-breakpoint
CREATE INDEX `mcp_tokens_shop_idx` ON `mcp_tokens` (`shop_id`);--> statement-breakpoint
CREATE INDEX `referral_vouchers_shop_idx` ON `referral_vouchers` (`shop_id`,`status`);