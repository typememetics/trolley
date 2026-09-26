import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { playerProfile } from "@/lib/db/schema";

/** Idempotent: every Better Auth user gets exactly one profile, however often this runs. */
export async function ensurePlayerProfile(userId: string) {
  await db.insert(playerProfile).values({ userId }).onConflictDoNothing();
}

/** The player's defense, or null when there is none worth facing (same rule as opponent eligibility). */
export async function getStandingDefense(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ standingDefense: playerProfile.standingDefense })
    .from(playerProfile)
    .where(eq(playerProfile.userId, userId));
  return row?.standingDefense?.trim() || null;
}

/** `defense` must already be validated. Upserts in case the profile was never created. */
export async function saveStandingDefense(userId: string, defense: string) {
  await db
    .insert(playerProfile)
    .values({ userId, standingDefense: defense })
    .onConflictDoUpdate({
      target: playerProfile.userId,
      set: { standingDefense: defense, updatedAt: new Date() },
    });
}
