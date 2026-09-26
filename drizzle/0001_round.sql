CREATE TABLE `round` (
	`id` text PRIMARY KEY NOT NULL,
	`player_user_id` text NOT NULL,
	`opponent_user_id` text NOT NULL,
	`player_argument_snapshot` text NOT NULL,
	`opponent_defense_snapshot` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`decision` text,
	`probability_flip` real,
	`probability_dont_flip` real,
	`confidence` real,
	`model` text,
	`failure_code` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`judging_at` integer,
	`resolved_at` integer,
	`failed_at` integer,
	FOREIGN KEY (`player_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opponent_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "round_distinct_players" CHECK("round"."player_user_id" <> "round"."opponent_user_id"),
	CONSTRAINT "round_player_argument_not_blank" CHECK(trim("round"."player_argument_snapshot") <> ''),
	CONSTRAINT "round_opponent_defense_not_blank" CHECK(trim("round"."opponent_defense_snapshot") <> ''),
	CONSTRAINT "round_status_valid" CHECK("round"."status" in ('created', 'judging', 'resolved', 'failed')),
	CONSTRAINT "round_decision_valid" CHECK("round"."decision" is null or "round"."decision" in ('flip', 'dont_flip')),
	CONSTRAINT "round_failure_code_valid" CHECK("round"."failure_code" is null or "round"."failure_code" in ('jev_failed', 'invalid_jev_result', 'judging_timeout')),
	CONSTRAINT "round_probability_flip_range" CHECK("round"."probability_flip" is null or ("round"."probability_flip" >= 0 and "round"."probability_flip" <= 1)),
	CONSTRAINT "round_probability_dont_flip_range" CHECK("round"."probability_dont_flip" is null or ("round"."probability_dont_flip" >= 0 and "round"."probability_dont_flip" <= 1)),
	CONSTRAINT "round_confidence_range" CHECK("round"."confidence" is null or ("round"."confidence" >= 0 and "round"."confidence" <= 1)),
	CONSTRAINT "round_model_not_blank" CHECK("round"."model" is null or trim("round"."model") <> ''),
	CONSTRAINT "round_judging_at_matches_status" CHECK(("round"."judging_at" is null) = ("round"."status" = 'created')),
	CONSTRAINT "round_result_matches_status" CHECK(
    ("round"."status" = 'resolved') = (
      "round"."decision" is not null and "round"."probability_flip" is not null and "round"."probability_dont_flip" is not null
      and "round"."confidence" is not null and "round"."model" is not null and "round"."resolved_at" is not null
    )
    and ("round"."status" = 'resolved' or (
      "round"."decision" is null and "round"."probability_flip" is null and "round"."probability_dont_flip" is null
      and "round"."confidence" is null and "round"."model" is null and "round"."resolved_at" is null
    ))),
	CONSTRAINT "round_failure_matches_status" CHECK(
    ("round"."status" = 'failed') = ("round"."failure_code" is not null and "round"."failed_at" is not null)
    and ("round"."status" = 'failed' or ("round"."failure_code" is null and "round"."failed_at" is null)))
);
--> statement-breakpoint
CREATE INDEX `round_player_user_id_idx` ON `round` (`player_user_id`);--> statement-breakpoint
CREATE INDEX `round_opponent_user_id_idx` ON `round` (`opponent_user_id`);