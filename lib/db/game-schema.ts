import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});
