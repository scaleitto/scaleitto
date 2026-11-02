CREATE TABLE `page_views` (
	`shop_id` varchar(36) NOT NULL,
	`day` varchar(10) NOT NULL,
	`product_id` varchar(36) NOT NULL DEFAULT '',
	`source` varchar(100) NOT NULL DEFAULT '',
	`impressions` int NOT NULL DEFAULT 0,
	`visitors` int NOT NULL DEFAULT 0,
	CONSTRAINT `page_views_shop_id_day_product_id_source_pk` PRIMARY KEY(`shop_id`,`day`,`product_id`,`source`)
);
