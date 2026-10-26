ALTER TABLE `ai_jobs` ADD `prepared` json;--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `response_id` varchar(120);--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `model` varchar(80);--> statement-breakpoint
ALTER TABLE `ai_jobs` ADD `claimed_until` timestamp NULL DEFAULT NULL;