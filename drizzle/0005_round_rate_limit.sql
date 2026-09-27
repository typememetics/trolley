-- IF [NOT] EXISTS: databases that ran an earlier draft of this migration already have the new index.
DROP INDEX IF EXISTS `round_player_user_id_idx`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `round_player_created_idx` ON `round` (`player_user_id`,`created_at`);
