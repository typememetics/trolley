import { sql, type SQL } from "drizzle-orm";
import { eloCheckpoint, eloCheckpointRating } from "@/lib/db/schema";
import { ELO_ALGORITHM_VERSION, ELO_INITIAL_RATING } from "@/lib/elo/algorithm";

/** Rating gap at which a pairing is about 0.61× as likely as an even one; 400 is ~0.14×, 600 ~0.01×. */
export const MATCHMAKING_SIGMA = 200;
/** No gap makes a pairing impossible, so small pools never lock anyone into one opponent. */
export const MATCHMAKING_FLOOR = 0.02;

/** Same selection as `loadLatestEloCheckpoint`; SQLite evaluates it once per statement. */
const latestCheckpoint = sql`(
  select ${eloCheckpoint.id} from ${eloCheckpoint}
  where ${eloCheckpoint.algorithmVersion} = ${ELO_ALGORITHM_VERSION} and ${eloCheckpoint.status} = 'ready'
  order by ${eloCheckpoint.cutoffResolvedAt} desc, ${eloCheckpoint.id} desc limit 1
)`;

/** Rating in the latest ready checkpoint; unrated players and an empty history count as new. */
const checkpointRatingOf = (userId: SQL | string) => sql`coalesce((
  select ${eloCheckpointRating.rating} from ${eloCheckpointRating}
  where ${eloCheckpointRating.checkpointId} = ${latestCheckpoint} and ${eloCheckpointRating.userId} = ${userId}
), ${ELO_INITIAL_RATING}) * 1.0`;

/**
 * An ORDER BY key whose smallest row is a draw weighted by `max(FLOOR, exp(-(Δ/σ)²/2))`,
 * Δ being the rating gap to `currentUserId` (Efraimidis–Spirakis: -ln(u) / weight).
 *
 * Ratings come from the latest checkpoint, not a tail replay, so the whole draw is one
 * statement. They lag by at most a day, which is close enough to pick a neighbourhood.
 */
export function closeRatingFirst(currentUserId: string, opponentUserId: SQL): SQL {
  const z = sql`((${checkpointRatingOf(currentUserId)} - ${checkpointRatingOf(opponentUserId)}) / ${MATCHMAKING_SIGMA})`;
  const weight = sql`max(${MATCHMAKING_FLOOR}, exp(-0.5 * ${z} * ${z}))`;
  // u in (0, 1): random() is a signed 64-bit integer, and ln(0) would be null
  const u = sql`((abs(random() % 1000000000) + 1) / 1000000001.0)`;
  return sql`-ln(${u}) / ${weight}`;
}
