import type { ROUND_FAILURE_CODES, ROUND_STATUSES } from "@/lib/db/game-schema";
import type { LeverDecision } from "@/lib/game/types";

/** created → judging → resolved | failed. Nothing moves backwards; resolved and failed are final. */
export type RoundStatus = (typeof ROUND_STATUSES)[number];

/** Why a round has no ruling. A category, never the provider's error. */
export type RoundFailureCode = (typeof ROUND_FAILURE_CODES)[number];

/** Written when the round is created and never changed: who was on the tracks and what each side said. */
interface RoundInputs {
  id: string;
  /** Pressed Judge; on the lower (main) track. */
  playerUserId: string;
  /** On the upper (diverted) track. */
  opponentUserId: string;
  /** What JEV weighed as `current_player_argument`. Today the player's standing defense at creation. */
  playerArgumentSnapshot: string;
  /** What JEV weighed as `opponent_standing_defense`, as it stood at creation. */
  opponentDefenseSnapshot: string;
  createdAt: Date;
}

export interface CreatedRound extends RoundInputs {
  status: "created";
}

/** Some request has claimed the round and is waiting on JEV. */
export interface JudgingRound extends RoundInputs {
  status: "judging";
  judgingAt: Date;
}

/** JEV's answer, exactly as it came back. */
export interface ResolvedRound extends RoundInputs {
  status: "resolved";
  judgingAt: Date;
  resolvedAt: Date;
  decision: LeverDecision;
  probabilityFlip: number;
  probabilityDontFlip: number;
  confidence: number;
  model: string;
}

/** No ruling was recorded. Final: a failed round is never judged again. */
export interface FailedRound extends RoundInputs {
  status: "failed";
  judgingAt: Date;
  failedAt: Date;
  failureCode: RoundFailureCode;
}

export type GameRound = CreatedRound | JudgingRound | ResolvedRound | FailedRound;

/** What the browser learns about a round's progress. No ids, no provider details. */
export type RoundOutcome =
  | { status: "created" | "judging" }
  | {
      status: "resolved";
      decision: LeverDecision;
      probabilities: Record<LeverDecision, number>;
      confidence: number;
      model: string;
    }
  | { status: "failed"; message: string };
