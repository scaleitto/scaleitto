ALTER TABLE `shops` ADD `seo` json;--> statement-breakpoint
ALTER TABLE `shops` ADD `policies` json;--> statement-breakpoint
ALTER TABLE `shops` ADD `custom_domain` varchar(191);--> statement-breakpoint
ALTER TABLE `shops` ADD `domain_token` varchar(64);--> statement-breakpoint
ALTER TABLE `shops` ADD `domain_verified_at` datetime;--> statement-breakpoint
ALTER TABLE `shops` ADD CONSTRAINT `shops_domain_uq` UNIQUE(`custom_domain`);