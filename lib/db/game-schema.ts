import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { LeverDecision } from "../game/types";
import { user } from "./auth-schema";

/**
 * Application-owned state for a Better Auth user. Identity (name, avatar, email,
 * GitHub account) stays in Better Auth's tables; `user.id` is the only link.
 *
 * A player is opponent-eligible when `standingDefense` has non-blank text — derived,
 * never stored, so it can't drift.
 */
export const playerProfile = sqliteTable("player_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  standingDefense: text("standing_defense"),
  // Current GitHub username, looked up by the account's stable numeric id. Null until fetched.
  githubLogin: text("github_login"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const ROUND_STATUSES = ["created", "judging", "resolved", "failed"] as const;
export const LEVER_DECISIONS = ["flip", "dont_flip"] as const satisfies readonly LeverDecision[];
export const ROUND_FAILURE_CODES = ["jev_failed", "invalid_jev_result", "judging_timeout"] as const;

const inList = (values: readonly string[]) => sql.raw(values.map(v => `'${v}'`).join(", "));
const unitInterval = (column: AnySQLiteColumn) => sql`${column} is null or (${column} >= 0 and ${column} <= 1)`;

/**
 * One judged matchup: who was on which track, exactly what each side said, and exactly
 * what JEV answered. The inputs are written once on insert and never change (a trigger
 * in the migration enforces it); the judgment fields fill in as the round moves
 * created → judging → resolved | failed. Checks below keep each status's fields coherent,
 * so a row can't claim to be resolved without a decision.
 */
export const round = sqliteTable("round", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),

  // The player who pressed Judge, on the lower (main) track, and their opponent on the upper one
  playerUserId: text("player_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  opponentUserId: text("opponent_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // What JEV judged, copied from player_profile when the round was created
  playerArgumentSnapshot: text("player_argument_snapshot").notNull(),
  opponentDefenseSnapshot: text("opponent_defense_snapshot").notNull(),

  status: text("status", { enum: ROUND_STATUSES }).notNull().default("created"),

  // JEV's answer, exactly as returned; set together on resolve
  decision: text("decision", { enum: LEVER_DECISIONS }),
  probabilityFlip: real("probability_flip"),
  probabilityDontFlip: real("probability_dont_flip"),
  confidence: real("confidence"),
  model: text("model"),

  // A safe category only; diagnostics stay in the server logs
  failureCode: text("failure_code", { enum: ROUND_FAILURE_CODES }),

  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  judgingAt: integer("judging_at", { mode: "timestamp_ms" }),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  failedAt: integer("failed_at", { mode: "timestamp_ms" }),
}, table => [
  // Also covers the player's recent rounds, for the rate limits in queries.ts
  index("round_player_created_idx").on(table.playerUserId, table.createdAt),
  index("round_opponent_user_id_idx").on(table.opponentUserId),
  // Covers the leaderboard: every resolved round's two sides and verdict, without reading the snapshots
  index("round_resolved_outcome_idx")
    .on(table.playerUserId, table.opponentUserId, table.decision)
    .where(sql`${table.status} = 'resolved'`),
  index("round_elo_replay_idx")
    .on(table.resolvedAt, table.id, table.playerUserId, table.opponentUserId, table.decision)
    .where(sql`${table.status} = 'resolved'`),

  check("round_distinct_players", sql`${table.playerUserId} <> ${table.opponentUserId}`),
  check("round_player_argument_not_blank", sql`trim(${table.playerArgumentSnapshot}) <> ''`),
  check("round_opponent_defense_not_blank", sql`trim(${table.opponentDefenseSnapshot}) <> ''`),

  check("round_status_valid", sql`${table.status} in (${inList(ROUND_STATUSES)})`),
  check("round_decision_valid", sql`${table.decision} is null or ${table.decision} in (${inList(LEVER_DECISIONS)})`),
  check("round_failure_code_valid", sql`${table.failureCode} is null or ${table.failureCode} in (${inList(ROUND_FAILURE_CODES)})`),
  check("round_probability_flip_range", unitInterval(table.probabilityFlip)),
  check("round_probability_dont_flip_range", unitInterval(table.probabilityDontFlip)),
  check("round_confidence_range", unitInterval(table.confidence)),
  check("round_model_not_blank", sql`${table.model} is null or trim(${table.model}) <> ''`),

  // Which fields each status carries. Every state past `created` went through judging.
  check("round_judging_at_matches_status", sql`(${table.judgingAt} is null) = (${table.status} = 'created')`),
  check("round_result_matches_status", sql`
    (${table.status} = 'resolved') = (
      ${table.decision} is not null and ${table.probabilityFlip} is not null and ${table.probabilityDontFlip} is not null
      and ${table.confidence} is not null and ${table.model} is not null and ${table.resolvedAt} is not null
    )
    and (${table.status} = 'resolved' or (
      ${table.decision} is null and ${table.probabilityFlip} is null and ${table.probabilityDontFlip} is null
      and ${table.confidence} is null and ${table.model} is null and ${table.resolvedAt} is null
    ))`),
  check("round_failure_matches_status", sql`
    (${table.status} = 'failed') = (${table.failureCode} is not null and ${table.failedAt} is not null)
    and (${table.status} = 'failed' or (${table.failureCode} is null and ${table.failedAt} is null))`),
]);
