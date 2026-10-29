CREATE TABLE `auth_tokens` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` enum('verify','reset') NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` datetime;--> statement-breakpoint
CREATE INDEX `auth_tokens_user_idx` ON `auth_tokens` (`user_id`,`kind`);--> statement-breakpoint
-- Accounts created before email confirmation existed count as confirmed
UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;
