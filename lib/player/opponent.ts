import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { playerProfile, user } from "@/lib/db/schema";
import { closeRatingFirst } from "./matchmaking";

export interface Opponent {
  userId: string;
  name: string;
  image: string | null;
  standingDefense: string;
}

/** What the current player sees of their opponent: who they are and the case they're making. No ids. */
export type OpponentView = Pick<Opponent, "name" | "image" | "standingDefense">;

export const toOpponentView = ({ name, image, standingDefense }: Opponent): OpponentView => ({ name, image, standingDefense });

/** Who `currentUserId` can face: anyone else with a non-blank defense. */
const eligibleOpponentOf = (currentUserId: string) => and(
  ne(playerProfile.userId, currentUserId),
  isNotNull(playerProfile.standingDefense),
  ne(sql`trim(${playerProfile.standingDefense})`, ""),
);

/**
 * A random other player with a written defense, or null if nobody qualifies yet.
 * Your own defense decides whether others can draw you, never whether you get an opponent.
 *
 * The draw favours players rated near `currentUserId`. A uniform draw let frequent players
 * farm the average of the pool while idle defenses were drawn mostly by those same
 * frequent (and stronger) players, so Elo rewarded volume as much as quality.
 */
export async function findRandomOpponent(currentUserId: string): Promise<Opponent | null> {
  const [row] = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      standingDefense: playerProfile.standingDefense,
    })
    .from(playerProfile)
    .innerJoin(user, eq(user.id, playerProfile.userId))
    .where(eligibleOpponentOf(currentUserId))
    .orderBy(closeRatingFirst(currentUserId, sql`${playerProfile.userId}`))
    .limit(1);
  return row ? { ...row, standingDefense: row.standingDefense! } : null;
}

/**
 * The opponent's defense as stored right now, or null if they are no longer someone
 * `currentUserId` can face. The authoritative text for a round, never the browser's copy.
 */
export async function getOpponentDefense(currentUserId: string, opponentId: string): Promise<string | null> {
  const [row] = await db
    .select({ standingDefense: playerProfile.standingDefense })
    .from(playerProfile)
    .where(and(eq(playerProfile.userId, opponentId), eligibleOpponentOf(currentUserId)));
  return row?.standingDefense?.trim() || null;
}
