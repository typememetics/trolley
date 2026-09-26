import "server-only";
import { getOpponentDefense } from "@/lib/player/opponent";
import { getStandingDefense } from "@/lib/player/profile";
import { insertRound } from "./queries";

export type CreateRoundResult = { ok: true; roundId: string } | { ok: false; error: string };

/**
 * Snapshot a matchup into a new round, without asking JEV anything. Both arguments are
 * read here, from the database: whatever the browser shows may be stale and is never
 * trusted. From this point the round is judged on these snapshots, whatever either
 * player writes later. `playerUserId` must come from the session.
 */
export async function createRoundFor(playerUserId: string, opponentUserId: string): Promise<CreateRoundResult> {
  if (opponentUserId === playerUserId) return { ok: false, error: "You can't play against yourself." };

  // Today the player's argument is their standing defense, exactly what Phase 3 sent to JEV
  const [playerArgument, opponentDefense] = await Promise.all([
    getStandingDefense(playerUserId),
    getOpponentDefense(playerUserId, opponentUserId),
  ]);
  if (!playerArgument) return { ok: false, error: "Write your defense first." };
  if (!opponentDefense) return { ok: false, error: "Your opponent is no longer on the tracks. Draw a new one." };

  const created = await insertRound({
    playerUserId,
    opponentUserId,
    playerArgumentSnapshot: playerArgument,
    opponentDefenseSnapshot: opponentDefense,
  });
  return { ok: true, roundId: created.id };
}
