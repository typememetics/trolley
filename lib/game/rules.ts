import type { LeverDecision, TrackDirection } from "./types";

/** Longest standing defense a player may write, counted after trimming. */
export const MAX_DEFENSE_LENGTH = 140;

/**
 * The player waits on the lower (main) track, so flipping sends the trolley up into
 * the opponent and not flipping leaves it heading down into the player.
 */
export function directionForDecision(decision: LeverDecision): TrackDirection {
  return decision === "flip" ? "up" : "down";
}
