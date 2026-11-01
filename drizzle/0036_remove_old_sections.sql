DROP TABLE `expenses`;--> statement-breakpoint
DROP TABLE `form_templates`;--> statement-breakpoint
DROP TABLE `stock_movements`;--> statement-breakpoint
ALTER TABLE `landing_pages` DROP COLUMN `form_template_id`;--> statement-breakpoint
ALTER TABLE `landing_versions` DROP COLUMN `form_template_id`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `paid_at`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `form_template_id`;--> statement-breakpoint
ALTER TABLE `shops` DROP COLUMN `low_stock`;