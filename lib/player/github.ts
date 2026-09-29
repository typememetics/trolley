import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { account, playerProfile } from "@/lib/db/schema";

/**
 * GitHub's current username for a numeric account id (Better Auth's `account.accountId`).
 * The id never changes; the login can, so this is what we re-resolve. Null when the
 * account no longer exists. Unauthenticated calls get 60 requests/hour per IP.
 */
export async function fetchGithubLogin(accountId: string, token?: string | null): Promise<string | null> {
  if (!/^\d+$/.test(accountId)) throw new Error(`Not a GitHub account id: ${accountId}`);
  const res = await fetch(`https://api.github.com/user/${accountId}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub user lookup failed: ${res.status}`);
  const { login } = await res.json() as { login?: unknown };
  return typeof login === "string" && /^[A-Za-z0-9-]+$/.test(login) ? login : null;
}

export async function saveGithubLogin(userId: string, githubLogin: string | null) {
  await db
    .insert(playerProfile)
    .values({ userId, githubLogin })
    .onConflictDoUpdate({
      target: playerProfile.userId,
      set: { githubLogin, updatedAt: new Date() },
    });
}

/** Players with a GitHub account whose login hasn't been fetched yet (or ever, with `all`). */
export async function githubAccountsToSync({ all = false } = {}) {
  return db
    .select({ userId: account.userId, accountId: account.accountId })
    .from(account)
    .leftJoin(playerProfile, eq(playerProfile.userId, account.userId))
    .where(and(eq(account.providerId, "github"), all ? undefined : isNull(playerProfile.githubLogin)));
}
