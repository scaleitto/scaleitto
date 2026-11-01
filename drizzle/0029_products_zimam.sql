ALTER TABLE `products` ADD `short_description` varchar(120);--> statement-breakpoint
ALTER TABLE `products` ADD `description_images` json;--> statement-breakpoint
ALTER TABLE `products` ADD `low_stock` int;--> statement-breakpoint
ALTER TABLE `products` ADD `show_out_of_stock` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `carrier_account_id` varchar(36);--> statement-breakpoint
ALTER TABLE `products` ADD `similar_ids` json;