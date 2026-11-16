CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`category` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`admin_note` text,
	`ip_hash` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `contacts_status_created_at_idx` ON `contacts` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `contacts_created_at_idx` ON `contacts` (`created_at`);