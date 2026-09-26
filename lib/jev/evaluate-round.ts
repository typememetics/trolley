import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { LeverDecision } from "@/lib/game/types";
import { JEV_MODEL, LEVER_QUESTION } from "./policy";

/** JEV's ruling on one round: the typed choice plus the distribution it came from. */
export interface JevDecision {
  decision: LeverDecision;
  probabilities: Record<LeverDecision, number>;
  confidence: number;
  /** The model that actually answered, as reported by the API. */
  model: string;
}

let client: TypeSafeClient | undefined;

/**
 * Created on the first round, not on import: the constructor throws without
 * TYPESAFE_API_KEY, and `next build` has no credentials.
 */
const typesafe = () => (client ??= new TypeSafeClient());

/**
 * Ask JEV whether to flip, weighing the current player's defense against their
 * opponent's. Throws on blank input or any service failure; there is no fallback
 * decision, because a failed call means there was no referee.
 */
export async function evaluateRound(playerDefense: string, opponentDefense: string): Promise<JevDecision> {
  const argument = playerDefense.trim();
  const defense = opponentDefense.trim();
  if (!argument || !defense) throw new Error("Both players need a standing defense");

  // Only the two arguments. No names, avatars or ids: JEV judges what was said, not who said it.
  const { model, answers: { lever } } = await typesafe().systemOne({
    model: JEV_MODEL,
    state: {
      current_player_argument: argument,
      opponent_standing_defense: defense,
    },
    questions: { lever: LEVER_QUESTION },
  });

  // The SDK types this already; check anyway, since this value decides who the trolley hits.
  if (lever.choice !== "flip" && lever.choice !== "dont_flip") {
    throw new Error(`JEV returned an unknown choice: ${String(lever.choice)}`);
  }
  return {
    decision: lever.choice,
    probabilities: { flip: lever.probabilities.flip, dont_flip: lever.probabilities.dont_flip },
    confidence: lever.confidence,
    model,
  };
}
