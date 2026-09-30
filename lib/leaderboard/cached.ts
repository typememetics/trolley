import "server-only";
import { unstable_cache } from "next/cache";
import { getArchenemies, getLeaderboard, getLeaderboardTotals } from "./queries";

/** The public board is identical for every viewer, so one database read serves everyone for this long. */
export const LEADERBOARD_CACHE_SECONDS = 15 * 60;

export const getCachedLeaderboard = unstable_cache(() => getLeaderboard(), ["leaderboard"], {
  revalidate: LEADERBOARD_CACHE_SECONDS,
  tags: ["leaderboard"],
});

export const getCachedLeaderboardTotals = unstable_cache(() => getLeaderboardTotals(), ["leaderboard-totals"], {
  revalidate: LEADERBOARD_CACHE_SECONDS,
  tags: ["leaderboard"],
});

/** Only flavours the opponent draw with a splash, so a few minutes stale is fine. */
export const getCachedArchenemies = (userId: string) =>
  unstable_cache(() => getArchenemies(userId), ["archenemies", userId], { revalidate: 10 * 60 })();
