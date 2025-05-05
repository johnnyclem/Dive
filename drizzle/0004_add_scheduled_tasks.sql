-- Create scheduled_tasks table
CREATE TABLE `scheduled_tasks` (
    `id` text PRIMARY KEY NOT NULL,
    `description` text NOT NULL,
    `type` text NOT NULL,
    `schedule` text NOT NULL,
    `status` text DEFAULT 'active' NOT NULL,
    `next_run_time` integer NOT NULL,
    `last_run_time` integer,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `created_by` text DEFAULT 'user' NOT NULL,
    `fail_reason` text
);
--> statement-breakpoint
CREATE INDEX `scheduled_tasks_status_nextrun_idx` ON `scheduled_tasks` (`status`, `next_run_time`); 