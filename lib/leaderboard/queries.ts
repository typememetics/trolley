import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentEloRatings } from "@/lib/elo/queries";
import type { LeaderboardEntry } from "./types";

interface Candidate {
  userId: string;
  elo: number;
  eloGames: number;
}

interface Row extends Candidate {
  name: string;
  image: string | null;
  rounds: number;
  survived: number;
  attackRounds: number;
  attackSurvived: number;
}

/** Competitive order comes from full-precision Elo; survival remains a SQL projection. */
export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError("Invalid leaderboard limit");
  if (limit === 0) return [];
  const ratings = await getCurrentEloRatings();
  const ordered = [...ratings].map(([userId, state]) => ({ userId, elo: state.rating, eloGames: state.games }))
    .sort((a, b) => b.elo - a.elo || b.eloGames - a.eloGames);
  // Include the entire boundary tie: SQLite uses canonical names and NOCASE to finish it.
  let end = Math.min(limit, ordered.length);
  while (end < ordered.length && ordered[end].elo === ordered[end - 1].elo && ordered[end].eloGames === ordered[end - 1].eloGames) end++;
  if (!end) return [];
  const rows = await db.all<Row>(leaderboardQuery(ordered.slice(0, end), limit));
  return rows.map(row => ({
    ...row,
    flattened: row.rounds - row.survived,
    survivalRate: row.rounds ? row.survived / row.rounds : 0,
    defenseRounds: row.rounds - row.attackRounds,
    defenseSurvived: row.survived - row.attackSurvived,
  }));
}

/**
 * One grouped query for the Elo candidates. JSON is one bound parameter even when
 * many players tie. Survival still uses the existing covering resolved-outcome index.
 * Name/id ordering and limit are applied BEFORE aggregation; there is no survival cutoff.
 */
export const leaderboardQuery = (candidates: readonly Candidate[], limit: number) => sql`
  with candidate as materialized (
    select user.id as userId, user.name, user.image,
      json_extract(value, '$.elo') as elo, json_extract(value, '$.eloGames') as eloGames
    from json_each(${JSON.stringify(candidates)})
    join user on user.id = json_extract(value, '$.userId')
    order by elo desc, eloGames desc, user.name collate nocase asc, user.id asc
    limit ${limit}
  ), outcome as (
    select player_user_id as user_id, 1 as attack, decision = 'flip' as survived
    from round indexed by round_resolved_outcome_idx
    where status = 'resolved' and player_user_id in (select userId from candidate)
    union all
    select opponent_user_id as user_id, 0 as attack, decision = 'dont_flip' as survived
    from round indexed by round_resolved_outcome_idx
    where status = 'resolved' and opponent_user_id in (select userId from candidate)
  ), record as (
    select user_id, count(*) as rounds, sum(survived) as survived,
      sum(attack) as attack_rounds, sum(attack and survived) as attack_survived
    from outcome group by user_id
  )
  select candidate.*, coalesce(record.rounds, 0) as rounds, coalesce(record.survived, 0) as survived,
    coalesce(record.attack_rounds, 0) as attackRounds, coalesce(record.attack_survived, 0) as attackSurvived
  from candidate left join record on record.user_id = candidate.userId
  order by elo desc, eloGames desc, name collate nocase asc, userId asc
`;
