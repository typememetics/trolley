import "server-only";
import { evaluateRound, InvalidJevResultError } from "@/lib/jev/evaluate-round";
import { claimRound, completeRound, failRound, findPlayerRound, findRound, JUDGING_TIMEOUT_MS } from "./queries";
import type { GameRound, RoundFailureCode, RoundOutcome } from "./types";

/**
 * The most one JEV call may take, SDK retries included. Well inside JUDGING_TIMEOUT_MS,
 * so the request that claimed a round always records an answer or a failure before
 * anyone else may write the round off as stale.
 */
const JEV_BUDGET_MS = JUDGING_TIMEOUT_MS / 2;

export type Judge = typeof evaluateRound;

/**
 * Bring `roundId` to a verdict if it has none, and report where it stands. Safe to call
 * any number of times, concurrently, from any number of tabs: the database decides who
 * asks JEV.
 *
 * - created: try to claim it. Only the winning claim calls JEV, on the stored snapshots.
 * - judging: someone else is asking JEV. Returned as is; the caller waits and asks again.
 * - resolved / failed: final. Returned as stored; JEV is not called.
 *
 * Null if the round doesn't exist or `playerUserId` (from the session) didn't create it.
 * `judge` is replaceable for tests only.
 */
export async function resolveRoundFor(
  playerUserId: string,
  roundId: string,
  judge: Judge = evaluateRound,
): Promise<GameRound | null> {
  const found = await findPlayerRound(roundId, playerUserId);
  if (found?.status !== "created") return found;

  const claimed = await claimRound(roundId);
  // Another request won the claim between our read and our update
  if (!claimed) return findRound(roundId);

  let failure: RoundFailureCode;
  try {
    const ruling = await judge(claimed.playerArgumentSnapshot, claimed.opponentDefenseSnapshot, {
      signal: AbortSignal.timeout(JEV_BUDGET_MS),
    });
    if (process.env.NODE_ENV === "development") console.info("JEV ruled", { round: roundId, ...ruling });
    // Null only if the round stopped being ours to resolve; then the stored state stands
    return (await completeRound(roundId, ruling)) ?? findRound(roundId);
  } catch (cause) {
    // Details stay in the server log; the round keeps only the category
    console.error("JEV round failed", { round: roundId }, cause);
    failure = cause instanceof InvalidJevResultError ? "invalid_jev_result" : "jev_failed";
  }
  return (await failRound(roundId, failure)) ?? findRound(roundId);
}

const FAILURE_MESSAGES: Record<RoundFailureCode, string> = {
  jev_failed: "JEV could not decide this round.",
  invalid_jev_result: "JEV could not decide this round.",
  judging_timeout: "JEV never finished deciding this round.",
};

/** What the browser may know about a round's progress. */
export function toRoundOutcome(round: GameRound): RoundOutcome {
  switch (round.status) {
    case "created":
    case "judging":
      return { status: round.status };
    case "resolved":
      return {
        status: round.status,
        decision: round.decision,
        probabilities: { flip: round.probabilityFlip, dont_flip: round.probabilityDontFlip },
        confidence: round.confidence,
        model: round.model,
      };
    case "failed":
      return { status: round.status, message: FAILURE_MESSAGES[round.failureCode] };
  }
}
