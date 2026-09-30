import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentEloRatings, getCurrentEloState } from "@/lib/elo/queries";
import { ELO_INITIAL_RATING } from "@/lib/elo/algorithm";
import type { Archenemy, LeaderboardEntry } from "./types";

interface Candidate {
  userId: string;
  elo: number;
  eloGames: number;
}

interface Row extends Candidate {
  name: string;
  image: string | null;
  githubLogin: string | null;
  rounds: number;
  survived: number;
  attackRounds: number;
  attackSurvived: number;
}

/**
 * Global position with exactly the leaderboard's tie-breakers, without its top-100 limit.
 * Rank is counted from the ratings already in memory; SQL only orders exact (elo, games)
 * ties, by NOCASE name then id.
 */
export async function getPlayerStanding(userId: string): Promise<{ elo: number; rank: number | null }> {
  const ratings = await getCurrentEloRatings();
  const candidates = [...ratings].map(([id, state]) => ({ userId: id, elo: state.rating, eloGames: state.games }));
  return playerStanding(candidates, userId);
}

const SNAPSHOT_TTL_MS = 60_000;
let snapshot: { at: number; candidates: Promise<Candidate[]> } | undefined;

/**
 * Same answer as getPlayerStanding from an Elo snapshot shared for a minute per server
 * instance (the in-flight promise is shared too), so polling widgets don't each replay the tail.
 */
export async function getCachedPlayerStanding(userId: string): Promise<{ elo: number; rank: number | null }> {
  if (!snapshot || Date.now() - snapshot.at > SNAPSHOT_TTL_MS) {
    const candidates = getCurrentEloRatings().then(ratings =>
      [...ratings].map(([id, state]) => ({ userId: id, elo: state.rating, eloGames: state.games })));
    const entry = { at: Date.now(), candidates };
    snapshot = entry;
    candidates.catch(() => { if (snapshot === entry) snapshot = undefined; });
  }
  return playerStanding(await snapshot.candidates, userId);
}

export async function playerStanding(candidates: readonly Candidate[], userId: string): Promise<{ elo: number; rank: number | null }> {
  const me = candidates.find(c => c.userId === userId);
  if (!me) return { elo: ELO_INITIAL_RATING, rank: null };
  let ahead = 0;
  const tied: string[] = [];
  for (const c of candidates) {
    if (c.elo > me.elo || (c.elo === me.elo && c.eloGames > me.eloGames)) ahead++;
    else if (c.elo === me.elo && c.eloGames === me.eloGames && c.userId !== userId) tied.push(c.userId);
  }
  if (tied.length) {
    const [row] = await db.all<{ before: number }>(sql`
      select count(*) as before from user, (select name, id from user where id = ${userId}) me
      where user.id in (select value from json_each(${JSON.stringify(tied)}))
        and (user.name collate nocase < me.name collate nocase
          or (user.name collate nocase = me.name collate nocase and user.id < me.id))
    `);
    ahead += row.before;
  }
  return { elo: me.elo, rank: ahead + 1 };
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
 * many players tie. Survival seeks the covering resolved-outcome indexes (player side, opponent side).
 * Name/id ordering and limit are applied BEFORE aggregation; there is no survival cutoff.
 */
export const leaderboardQuery = (candidates: readonly Candidate[], limit: number) => sql`
  with candidate as materialized (
    select user.id as userId, user.name, user.image, player_profile.github_login as githubLogin,
      json_extract(value, '$.elo') as elo, json_extract(value, '$.eloGames') as eloGames
    from json_each(${JSON.stringify(candidates)})
    join user on user.id = json_extract(value, '$.userId')
    left join player_profile on player_profile.user_id = user.id
    order by elo desc, eloGames desc, user.name collate nocase asc, user.id asc
    limit ${limit}
  ), outcome as (
    select player_user_id as user_id, 1 as attack, decision = 'flip' as survived
    from round indexed by round_resolved_outcome_idx
    where status = 'resolved' and player_user_id in (select userId from candidate)
    union all
    select opponent_user_id as user_id, 0 as attack, decision = 'dont_flip' as survived
    from round indexed by round_resolved_by_opponent_idx
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

export interface LeaderboardTotals {
  /** Distinct players with at least one resolved round, on either track. */
  players: number;
  /** Resolved rounds; each has exactly two players. */
  rounds: number;
}

/** Whole-history totals, independent of the leaderboard limit. Derived from the Elo state; no round scan. */
export async function getLeaderboardTotals(): Promise<LeaderboardTotals> {
  const { ratings, rounds } = await getCurrentEloState();
  return { players: ratings.size, rounds };
}

/** The players `userId` has lost to most, head-to-head. Ties go to the fewer wins, then name. */
export async function getArchenemies(userId: string, limit = 5): Promise<Archenemy[]> {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError("Invalid archenemy limit");
  if (limit === 0) return [];
  return db.all<Archenemy>(archenemiesQuery(userId, limit));
}

/** Attack loses on dont_flip, defense loses on flip. Reads only the resolved-outcome indexes, seeking on each side. */
export const archenemiesQuery = (userId: string, limit: number) => sql`
  with game as (
    select opponent_user_id as enemy, decision = 'dont_flip' as lost
    from round indexed by round_resolved_outcome_idx
    where status = 'resolved' and player_user_id = ${userId}
    union all
    select player_user_id as enemy, decision = 'flip' as lost
    from round indexed by round_resolved_by_opponent_idx
    where status = 'resolved' and opponent_user_id = ${userId}
  ), rivalry as (
    select enemy, sum(lost) as losses, count(*) - sum(lost) as wins
    from game group by enemy having sum(lost) > 0
  )
  select user.id as userId, user.name, user.image, rivalry.losses, rivalry.wins
  from rivalry join user on user.id = rivalry.enemy
  order by rivalry.losses desc, rivalry.wins asc, user.name collate nocase asc, user.id asc
  limit ${limit}
`;
