ALTER TABLE `shop_members` ADD `username` varchar(40);--> statement-breakpoint
ALTER TABLE `shop_members` ADD CONSTRAINT `members_shop_username_uq` UNIQUE(`shop_id`,`username`);