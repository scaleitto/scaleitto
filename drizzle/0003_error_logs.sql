CREATE TABLE `error_logs` (
	`id` varchar(36) NOT NULL,
	`digest` varchar(64),
	`message` text NOT NULL,
	`stack` text,
	`path` varchar(500),
	`method` varchar(10),
	`route_type` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `errors_created_idx` ON `error_logs` (`created_at`);