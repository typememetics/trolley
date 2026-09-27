/**
 * One player's record, derived on every read from resolved rounds. Nothing here is stored:
 * drop it and the next query rebuilds it exactly.
 *
 * Attack is the lower (main) track, where the player who pressed Judge sits: they survive
 * when JEV flips. Defense is the upper (diverted) track, where the opponent's standing
 * defense sits: they survive when JEV doesn't flip.
 */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  image: string | null;

  /** Raw Elo, rounded only by the UI. */
  elo: number;
  eloGames: number;

  rounds: number;
  survived: number;
  flattened: number;

  /** survived / rounds; every entry has at least one round. */
  survivalRate: number;

  attackRounds: number;
  attackSurvived: number;

  defenseRounds: number;
  defenseSurvived: number;
}
