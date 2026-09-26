import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createRoundFor, type CreateRoundResult } from "./create-round";
import { resolveRoundFor, toRoundOutcome } from "./resolve-round";
import type { RoundOutcome } from "./types";

// The session-bound entry points. Pages bind their arguments into inline server actions,
// so the browser can't choose them; whose round it is always comes from the session here.

export type ResolveRoundResult = { ok: true; outcome: RoundOutcome } | { ok: false; error: string };

const currentUserId = async () => (await auth.api.getSession({ headers: await headers() }))?.user.id ?? null;

/** Start a round against `opponentUserId`, which must come from the server. Does not call JEV. */
export async function createRound(opponentUserId: string): Promise<CreateRoundResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in to play." };
  try {
    return await createRoundFor(userId, opponentUserId);
  } catch (cause) {
    console.error("Round creation failed", cause);
    return { ok: false, error: "The round could not be started. Try again." };
  }
}

/** Resolve the current player's round `roundId` if it has no verdict yet, and report where it stands. */
export async function resolveRound(roundId: string): Promise<ResolveRoundResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in to play." };
  try {
    const round = await resolveRoundFor(userId, roundId);
    return round ? { ok: true, outcome: toRoundOutcome(round) } : { ok: false, error: "This round isn't yours." };
  } catch (cause) {
    console.error("Round resolution failed", { round: roundId }, cause);
    return { ok: false, error: "The round could not be loaded. Try again." };
  }
}
