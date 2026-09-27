CREATE TABLE `elo_checkpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`algorithm_version` text NOT NULL,
	`status` text NOT NULL,
	`cutoff_resolved_at` integer NOT NULL,
	`rounds_processed` integer DEFAULT 0 NOT NULL,
	`started_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ready_at` integer,
	`failed_at` integer,
	CONSTRAINT "elo_checkpoint_rounds_nonnegative" CHECK("elo_checkpoint"."rounds_processed" >= 0),
	CONSTRAINT "elo_checkpoint_status_timestamps" CHECK(
    ("elo_checkpoint"."status" = 'building' and "elo_checkpoint"."ready_at" is null and "elo_checkpoint"."failed_at" is null)
    or ("elo_checkpoint"."status" = 'ready' and "elo_checkpoint"."ready_at" is not null and "elo_checkpoint"."failed_at" is null)
    or ("elo_checkpoint"."status" = 'failed' and "elo_checkpoint"."failed_at" is not null and "elo_checkpoint"."ready_at" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elo_checkpoint_one_building_per_version` ON `elo_checkpoint` (`algorithm_version`) WHERE "elo_checkpoint"."status" = 'building';--> statement-breakpoint
CREATE INDEX `elo_checkpoint_latest_ready_idx` ON `elo_checkpoint` (`algorithm_version`,`cutoff_resolved_at`,`id`) WHERE "elo_checkpoint"."status" = 'ready';--> statement-breakpoint
CREATE TABLE `elo_checkpoint_rating` (
	`checkpoint_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` real NOT NULL,
	`games` integer NOT NULL,
	PRIMARY KEY(`checkpoint_id`, `user_id`),
	FOREIGN KEY (`checkpoint_id`) REFERENCES `elo_checkpoint`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "elo_checkpoint_rating_games_nonnegative" CHECK("elo_checkpoint_rating"."games" >= 0)
);
--> statement-breakpoint
CREATE INDEX `round_elo_replay_idx` ON `round` (`resolved_at`,`id`,`player_user_id`,`opponent_user_id`,`decision`) WHERE "round"."status" = 'resolved';