CREATE TABLE `member_activity` (
	`shop_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`day` date NOT NULL,
	`first_seen` datetime NOT NULL,
	`last_seen` datetime NOT NULL,
	`active_minutes` int NOT NULL DEFAULT 0,
	`shift_minutes` int NOT NULL DEFAULT 0,
	CONSTRAINT `member_activity_shop_id_user_id_day_pk` PRIMARY KEY(`shop_id`,`user_id`,`day`)
);
--> statement-breakpoint
ALTER TABLE `order_events` MODIFY COLUMN `type` enum('created','status','note','edit','assign') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `assigned_to` varchar(36);--> statement-breakpoint
ALTER TABLE `orders` ADD `assigned_at` timestamp;--> statement-breakpoint
ALTER TABLE `shop_members` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_members` ADD `schedule` json;--> statement-breakpoint
ALTER TABLE `shops` ADD `assign_mode` enum('manual','balanced','on_shift') DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
CREATE INDEX `orders_shop_assigned_idx` ON `orders` (`shop_id`,`assigned_to`,`status`);