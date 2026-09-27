// Any change to rating semantics requires a NEW version and a replay from history.
export const ELO_ALGORITHM_VERSION = "elo-v1-base1500-k32-scale400";
export const ELO_INITIAL_RATING = 1500;
export const ELO_K_FACTOR = 32;
export const ELO_SCALE = 400;

export interface RatingPair {
  player: number;
  opponent: number;
}

export function updateElo(playerRating: number, opponentRating: number, playerScore: 0 | 1): RatingPair {
  const expectedPlayer = 1 / (1 + 10 ** ((opponentRating - playerRating) / ELO_SCALE));
  const expectedOpponent = 1 - expectedPlayer;
  return {
    player: playerRating + ELO_K_FACTOR * (playerScore - expectedPlayer),
    opponent: opponentRating + ELO_K_FACTOR * ((1 - playerScore) - expectedOpponent),
  };
}
