ALTER TABLE `order_events` MODIFY COLUMN `type` enum('created','status','note','edit','assign','message','risk') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `risk` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `risk_reasons` json;--> statement-breakpoint
ALTER TABLE `shops` ADD `protection` json;--> statement-breakpoint
CREATE INDEX `orders_phone_idx` ON `orders` (`phone`);