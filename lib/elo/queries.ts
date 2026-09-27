import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ELO_ALGORITHM_VERSION } from "./algorithm";
import { replayElo } from "./replay";
import type { EloMatch, EloRatings } from "./types";

export const databaseNow = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export async function getDatabaseNow(): Promise<number> {
  const [row] = await db.all<{ now: number }>(sql`select ${databaseNow} as now`);
  return row.now;
}

export interface CheckpointState {
  id: string;
  cutoff: number;
  roundsProcessed: number;
  readyAt: number;
  ratings: EloRatings;
}

/**
 * Select the ready checkpoint AND its rows in one statement. Retention cannot delete
 * the selected snapshot between a metadata query and a separate ratings query.
 */
export async function loadLatestEloCheckpoint(): Promise<CheckpointState | null> {
  const rows = await db.all<{
    id: string; cutoff: number; roundsProcessed: number; readyAt: number;
    userId: string | null; rating: number | null; games: number | null;
  }>(sql`
    select c.id, c.cutoff_resolved_at as cutoff, c.rounds_processed as roundsProcessed,
      c.ready_at as readyAt, r.user_id as userId, r.rating, r.games
    from (
      select id, cutoff_resolved_at, rounds_processed, ready_at from elo_checkpoint
      where algorithm_version = ${ELO_ALGORITHM_VERSION} and status = 'ready'
      order by cutoff_resolved_at desc, id desc limit 1
    ) c
    left join elo_checkpoint_rating r on r.checkpoint_id = c.id
  `);
  if (!rows.length) return null;
  const ratings: EloRatings = new Map();
  for (const row of rows) {
    if (row.userId !== null && row.rating !== null && row.games !== null) {
      ratings.set(row.userId, { rating: row.rating, games: row.games });
    }
  }
  const { id, cutoff, roundsProcessed, readyAt } = rows[0];
  return { id, cutoff, roundsProcessed, readyAt, ratings };
}

/** Half-open [from, before). No lower bound means ALL history, including pre-epoch rows. */
export const eloHistoryWhere = (from?: number, before?: number) => sql`
  status = 'resolved'
  ${from === undefined ? sql`` : sql`and resolved_at >= ${from}`}
  ${before === undefined ? sql`` : sql`and resolved_at < ${before}`}
`;

export const eloHistoryQuery = (from?: number, before?: number) => sql`
  select id, player_user_id as playerUserId, opponent_user_id as opponentUserId,
    decision, resolved_at as resolvedAt
  from round where ${eloHistoryWhere(from, before)}
  order by resolved_at asc, id asc
`;

export async function loadEloMatches(from?: number, before?: number): Promise<EloMatch[]> {
  const rows = await db.all<Omit<EloMatch, "resolvedAt"> & { resolvedAt: number }>(eloHistoryQuery(from, before));
  return rows.map(row => ({ ...row, resolvedAt: new Date(row.resolvedAt) }));
}

/** Independent diagnostic rebuild; deliberately ignores every checkpoint. */
export async function rebuildEloFromHistory(): Promise<EloRatings> {
  return replayElo(new Map(), await loadEloMatches());
}

export async function getCurrentEloRatings(): Promise<EloRatings> {
  const checkpoint = await loadLatestEloCheckpoint();
  const matches = await loadEloMatches(checkpoint?.cutoff);
  if (!checkpoint && matches.length >= 50_000) {
    console.warn("Elo full history fallback", { algorithmVersion: ELO_ALGORITHM_VERSION, rounds: matches.length });
  }
  return replayElo(checkpoint?.ratings ?? new Map(), matches);
}
