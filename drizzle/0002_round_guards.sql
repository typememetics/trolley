-- Guards drizzle-kit can't express. A round is history: what was on the tracks never
-- changes, and its status only ever moves forward along created → judging → resolved | failed.

-- The inputs JEV judged, and the moment judging began, are written once.
CREATE TRIGGER `round_inputs_immutable`
BEFORE UPDATE ON `round`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`player_user_id` IS NOT OLD.`player_user_id`
  OR NEW.`opponent_user_id` IS NOT OLD.`opponent_user_id`
  OR NEW.`player_argument_snapshot` IS NOT OLD.`player_argument_snapshot`
  OR NEW.`opponent_defense_snapshot` IS NOT OLD.`opponent_defense_snapshot`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR (OLD.`judging_at` IS NOT NULL AND NEW.`judging_at` IS NOT OLD.`judging_at`)
BEGIN
  SELECT RAISE(ABORT, 'round inputs are immutable');
END;
--> statement-breakpoint
-- Every update is exactly one forward transition, so resolved and failed rounds are final.
CREATE TRIGGER `round_status_transition`
BEFORE UPDATE ON `round`
FOR EACH ROW
WHEN NOT (
  (OLD.`status` = 'created' AND NEW.`status` = 'judging')
  OR (OLD.`status` = 'judging' AND NEW.`status` IN ('resolved', 'failed'))
)
BEGIN
  SELECT RAISE(ABORT, 'invalid round status transition');
END;
