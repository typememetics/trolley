import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getOpponentDefense } from "@/lib/player/opponent";
import { getStandingDefense } from "@/lib/player/profile";
import { evaluateRound, type JevDecision } from "./evaluate-round";

/** Everything the browser learns about a round. Failures carry a message, never service details. */
export type RoundResult = ({ ok: true } & JevDecision) | { ok: false; error: string };

const JEV_FAILED = "JEV could not decide this round.";

/**
 * One round against `opponentId`, which must come from the server (the page binds it
 * into the action), never from the browser. The browser supplies nothing else either:
 * the player, both defenses and the policy all come from here.
 */
export async function playRound(opponentId: string): Promise<RoundResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, error: "Sign in to play." };
  if (opponentId === session.user.id) return { ok: false, error: "You can't play against yourself." };

  try {
    // Both read fresh: the text on screen may be stale, and the browser's copy is never trusted.
    const [playerDefense, opponentDefense] = await Promise.all([
      getStandingDefense(session.user.id),
      getOpponentDefense(session.user.id, opponentId),
    ]);
    if (!playerDefense) return { ok: false, error: "Write your defense first." };
    if (!opponentDefense) return { ok: false, error: "Your opponent is no longer on the tracks. Draw a new one." };
    const ruling = await evaluateRound(playerDefense, opponentDefense);
    // Local debugging only: players never see the ruling beyond which way the trolley goes.
    if (process.env.NODE_ENV === "development") {
      console.info("JEV ruled", { you: playerDefense, them: opponentDefense, ...ruling });
    }
    return { ok: true, ...ruling };
  } catch (cause) {
    // Logged here, on the server; the browser only learns that there was no decision.
    console.error("JEV round failed", cause);
    return { ok: false, error: JEV_FAILED };
  }
}
