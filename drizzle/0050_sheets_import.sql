ALTER TABLE `shop_channels` MODIFY COLUMN `kind` enum('shopify','woocommerce','google_sheets') NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_channels` ADD `settings` json;