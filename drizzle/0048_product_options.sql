ALTER TABLE `product_variants` ADD `compare_at_price` int;--> statement-breakpoint
ALTER TABLE `product_variants` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `max_per_order` int;--> statement-breakpoint
ALTER TABLE `products` ADD `delivery_option` varchar(40);--> statement-breakpoint
ALTER TABLE `products` ADD `card_only` boolean DEFAULT false NOT NULL;