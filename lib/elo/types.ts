export interface EloMatch {
  id: string;
  playerUserId: string;
  opponentUserId: string;
  decision: "flip" | "dont_flip";
  resolvedAt: Date;
}

export interface EloPlayerState {
  rating: number;
  games: number;
}

export type EloRatings = Map<string, EloPlayerState>;
