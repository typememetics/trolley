import { ELO_INITIAL_RATING, updateElo } from "./algorithm";
import type { EloMatch, EloRatings } from "./types";

/** Neither input is mutated. UUIDs use binary lexical order, matching SQLite's id ordering. */
export function replayElo(initial: EloRatings, matches: readonly EloMatch[]): EloRatings {
  const ratings: EloRatings = new Map([...initial].map(([id, state]) => [id, { ...state }]));
  const ordered = [...matches].sort((a, b) =>
    a.resolvedAt.getTime() - b.resolvedAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const match of ordered) {
    const player = ratings.get(match.playerUserId) ?? { rating: ELO_INITIAL_RATING, games: 0 };
    const opponent = ratings.get(match.opponentUserId) ?? { rating: ELO_INITIAL_RATING, games: 0 };
    const next = updateElo(player.rating, opponent.rating, match.decision === "flip" ? 1 : 0);
    ratings.set(match.playerUserId, { rating: next.player, games: player.games + 1 });
    ratings.set(match.opponentUserId, { rating: next.opponent, games: opponent.games + 1 });
  }
  return ratings;
}
