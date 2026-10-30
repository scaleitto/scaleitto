ALTER TABLE `order_events` MODIFY COLUMN `type` enum('created','status','note','edit','assign','message','risk','followup','call') NOT NULL;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `form_template_id` varchar(36);--> statement-breakpoint
ALTER TABLE `orders` ADD `call_attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `last_call_at` datetime;--> statement-breakpoint
UPDATE `orders` o SET o.`call_attempts` = (SELECT COUNT(*) FROM `order_events` e WHERE e.`order_id` = o.`id` AND e.`type` = 'status' AND e.`user_id` IS NOT NULL AND e.`to_status` IN ('confirmed','cancelled','callback','no_answer','voicemail','fake','wrong_number','duplicate','remark'));
