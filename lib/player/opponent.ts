import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { playerProfile, user } from "@/lib/db/schema";

export interface Opponent {
  userId: string;
  name: string;
  image: string | null;
  standingDefense: string;
}

/** What the current player sees of their opponent: who they are and the case they're making. No ids. */
export type OpponentView = Pick<Opponent, "name" | "image" | "standingDefense">;

export const toOpponentView = ({ name, image, standingDefense }: Opponent): OpponentView => ({ name, image, standingDefense });

/**
 * A random other player with a written defense, or null if nobody qualifies yet.
 * Your own defense decides whether others can draw you, never whether you get an opponent.
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
    .where(and(
      ne(playerProfile.userId, currentUserId),
      isNotNull(playerProfile.standingDefense),
      ne(sql`trim(${playerProfile.standingDefense})`, ""),
    ))
    .orderBy(sql`random()`)
    .limit(1);
  return row ? { ...row, standingDefense: row.standingDefense! } : null;
}
