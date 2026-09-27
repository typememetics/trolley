import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const ELO_CHECKPOINT_STATUSES = ["building", "ready", "failed"] as const;

/** Disposable interpretation of all resolved rounds strictly BEFORE cutoffResolvedAt. */
export const eloCheckpoint = sqliteTable("elo_checkpoint", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  algorithmVersion: text("algorithm_version").notNull(),
  status: text("status", { enum: ELO_CHECKPOINT_STATUSES }).notNull(),
  cutoffResolvedAt: integer("cutoff_resolved_at", { mode: "timestamp_ms" }).notNull(),
  roundsProcessed: integer("rounds_processed").notNull().default(0),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  readyAt: integer("ready_at", { mode: "timestamp_ms" }),
  failedAt: integer("failed_at", { mode: "timestamp_ms" }),
}, table => [
  uniqueIndex("elo_checkpoint_one_building_per_version").on(table.algorithmVersion)
    .where(sql`${table.status} = 'building'`),
  index("elo_checkpoint_latest_ready_idx").on(table.algorithmVersion, table.cutoffResolvedAt, table.id)
    .where(sql`${table.status} = 'ready'`),
  check("elo_checkpoint_rounds_nonnegative", sql`${table.roundsProcessed} >= 0`),
  check("elo_checkpoint_status_timestamps", sql`
    (${table.status} = 'building' and ${table.readyAt} is null and ${table.failedAt} is null)
    or (${table.status} = 'ready' and ${table.readyAt} is not null and ${table.failedAt} is null)
    or (${table.status} = 'failed' and ${table.failedAt} is not null and ${table.readyAt} is null)`),
]);

export const eloCheckpointRating = sqliteTable("elo_checkpoint_rating", {
  checkpointId: text("checkpoint_id").notNull().references(() => eloCheckpoint.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  rating: real("rating").notNull(),
  games: integer("games").notNull(),
}, table => [
  primaryKey({ columns: [table.checkpointId, table.userId] }),
  check("elo_checkpoint_rating_games_nonnegative", sql`${table.games} >= 0`),
]);
