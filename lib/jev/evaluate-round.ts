import "server-only";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { LeverDecision } from "@/lib/game/types";
import { IDIOT_JEV_RATE, IDIOT_LEVER_QUESTION, JEV_MODEL, LEVER_QUESTION } from "./policy";

/** JEV's ruling on one round: the typed choice plus the distribution it came from. */
export interface JevDecision {
  decision: LeverDecision;
  probabilities: Record<LeverDecision, number>;
  confidence: number;
  /** The model that actually answered, as reported by the API. */
  model: string;
}

/** JEV answered, but with something that can't be a ruling. Distinct from JEV not answering. */
export class InvalidJevResultError extends Error {
  name = "InvalidJevResultError";
}

let client: TypeSafeClient | undefined;

/**
 * Created on the first round, not on import: the constructor throws without
 * TYPESAFE_API_KEY, and `next build` has no credentials.
 */
const typesafe = () => (client ??= new TypeSafeClient());

const isUnit = (n: unknown): n is number => typeof n === "number" && n >= 0 && n <= 1;

/**
 * Ask JEV whether to flip, weighing the current player's defense against their
 * opponent's. Throws on blank input or any service failure; there is no fallback
 * decision, because a failed call means there was no referee. `signal` bounds the
 * whole call, SDK retries included.
 */
export async function evaluateRound(
  playerDefense: string,
  opponentDefense: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<JevDecision> {
  const argument = playerDefense.trim();
  const defense = opponentDefense.trim();
  if (!argument || !defense) throw new Error("Both players need a standing defense");

  // Most rounds get JEV; about one in twenty gets idiot JEV instead.
  const question = Math.random() < IDIOT_JEV_RATE ? IDIOT_LEVER_QUESTION : LEVER_QUESTION;

  // Only the two arguments. No names, avatars or ids: JEV judges what was said, not who said it.
  const { model, answers: { lever } } = await typesafe().systemOne({
    model: JEV_MODEL,
    state: {
      current_player_argument: argument,
      opponent_standing_defense: defense,
    },
    questions: { lever: question },
  }, { signal });

  // The SDK types this already; check anyway, since this value decides who the trolley hits
  // and is kept for good.
  if (lever.choice !== "flip" && lever.choice !== "dont_flip") {
    throw new InvalidJevResultError(`JEV returned an unknown choice: ${String(lever.choice)}`);
  }
  const { flip, dont_flip } = lever.probabilities;
  if (!isUnit(flip) || !isUnit(dont_flip) || !isUnit(lever.confidence)) {
    throw new InvalidJevResultError("JEV returned probabilities or confidence outside [0, 1]");
  }
  if (typeof model !== "string" || !model.trim()) throw new InvalidJevResultError("JEV did not report its model");
  return {
    decision: lever.choice,
    probabilities: { flip, dont_flip },
    confidence: lever.confidence,
    model,
  };
}
