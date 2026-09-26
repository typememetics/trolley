import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { LeaderboardEntry } from "./types";

interface Row {
  userId: string;
  name: string;
  image: string | null;
  rounds: number;
  survived: number;
  attackRounds: number;
  attackSurvived: number;
}

/**
 * Who survives JEV most often, as a query over resolved rounds. Each resolved round is
 * two outcomes: the player on attack survives a flip, the opponent on defense survives a
 * dont_flip. Created, judging and failed rounds count for no one.
 *
 * Ranked by survival rate, then survivals, then rounds played, then name (and id, so equal
 * names still sort the same way every time).
 */
export async function getLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  const rows = await db.all<Row>(leaderboardQuery(limit));
  return rows.map(row => ({
    userId: row.userId,
    name: row.name,
    image: row.image,
    rounds: row.rounds,
    survived: row.survived,
    flattened: row.rounds - row.survived,
    survivalRate: row.survived / row.rounds,
    attackRounds: row.attackRounds,
    attackSurvived: row.attackSurvived,
    defenseRounds: row.rounds - row.attackRounds,
    defenseSurvived: row.survived - row.attackSurvived,
  }));
}

/**
 * The aggregation, all in the database. Both halves read only round_resolved_outcome_idx,
 * never the round rows with their snapshots. Exported for the query-plan test.
 */
export const leaderboardQuery = (limit: number) => sql`
  with outcome as (
    select player_user_id as user_id, 1 as attack, decision = 'flip' as survived
    from round where status = 'resolved'
    union all
    select opponent_user_id as user_id, 0 as attack, decision = 'dont_flip' as survived
    from round where status = 'resolved'
  ),
  record as (
    select
      user_id,
      count(*) as rounds,
      sum(survived) as survived,
      sum(attack) as attack_rounds,
      sum(attack and survived) as attack_survived
    from outcome
    group by user_id
  )
  select
    user.id as userId,
    user.name as name,
    user.image as image,
    record.rounds as rounds,
    record.survived as survived,
    record.attack_rounds as attackRounds,
    record.attack_survived as attackSurvived
  from record
  join user on user.id = record.user_id
  order by
    cast(record.survived as real) / record.rounds desc,
    record.survived desc,
    record.rounds desc,
    user.name collate nocase asc,
    user.id asc
  limit ${limit}
`;
