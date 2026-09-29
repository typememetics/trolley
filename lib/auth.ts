import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { fetchGithubLogin, saveGithubLogin } from "@/lib/player/github";
import { ensurePlayerProfile } from "@/lib/player/profile";

/** Keeps the leaderboard's GitHub link current across renames. Never blocks sign-in. */
async function syncGithubLogin(account: { providerId: string; accountId: string; userId: string; accessToken?: string | null }) {
  if (account.providerId !== "github") return;
  try {
    await saveGithubLogin(account.userId, await fetchGithubLogin(account.accountId, account.accessToken));
  } catch (e) {
    console.error("GitHub login sync failed", e);
  }
}

// Database-backed: users, accounts and sessions live in Turso. Better Auth's `user.id`
// is the application's identity; game state hangs off it in player_profile.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  socialProviders: {
    // Default scopes (read:user, user:email): Better Auth refuses a sign-in without an
    // email, and many GitHub users keep theirs private. Nothing here can write to GitHub.
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async user => { await ensurePlayerProfile(user.id); },
      },
    },
    account: {
      // Created on first sign-in; updated with fresh tokens on every later one.
      create: { after: syncGithubLogin },
      update: { after: syncGithubLogin },
    },
  },
});
