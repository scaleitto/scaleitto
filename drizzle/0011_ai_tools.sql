ALTER TABLE `order_events` MODIFY COLUMN `type` enum('created','status','note','edit','assign','message') NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_generations` ADD `kind` varchar(30) DEFAULT 'landing' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_generations` ADD `result` json;--> statement-breakpoint
ALTER TABLE `products` ADD `call_guide` json;--> statement-breakpoint
ALTER TABLE `shops` ADD `messages` json;