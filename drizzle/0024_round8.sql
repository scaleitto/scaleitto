ALTER TABLE `order_items` MODIFY COLUMN `offer_label` varchar(160);--> statement-breakpoint
ALTER TABLE `order_events` MODIFY COLUMN `type` enum('created','status','note','edit','assign','message','risk','followup') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `status` enum('new','no_answer','postponed','confirmed','shipped','delivered','returned','cancelled','callback','voicemail','fake','wrong_number','duplicate','remark') NOT NULL DEFAULT 'new';--> statement-breakpoint
UPDATE `orders` SET `status` = 'callback' WHERE `status` = 'postponed';--> statement-breakpoint
UPDATE `order_events` SET `from_status` = 'callback' WHERE `from_status` = 'postponed';--> statement-breakpoint
UPDATE `order_events` SET `to_status` = 'callback' WHERE `to_status` = 'postponed';--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `status` enum('new','confirmed','cancelled','callback','no_answer','voicemail','fake','wrong_number','duplicate','remark','shipped','delivered','returned') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_state` enum('shipped','postponed','no_answer','delivered','returned');--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_fault` enum('courier','customer','company');--> statement-breakpoint
ALTER TABLE `orders` ADD `processing` enum('claim','reinjected');--> statement-breakpoint
UPDATE `orders` SET `delivery_state` = `status` WHERE `status` IN ('shipped','delivered','returned');--> statement-breakpoint
UPDATE `orders` o JOIN `shipments` s ON s.`order_id` = o.`id` SET o.`delivery_state` = 'postponed' WHERE o.`status` = 'shipped' AND s.`status` = 'suspended';
