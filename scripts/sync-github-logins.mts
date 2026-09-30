// Fills player_profile.github_login from GitHub's API for players who signed in before it
// existed. Safe to re-run; --all refreshes everyone (picks up renames). Sign-in keeps it
// current afterwards. Unauthenticated: 60 lookups/hour, so set GITHUB_TOKEN for more.
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const { fetchGithubLogin, githubAccountsToSync, saveGithubLogin } = await import("../lib/player/github.ts");

const accounts = await githubAccountsToSync({ all: process.argv.includes("--all") });
let synced = 0;
for (const { userId, accountId } of accounts) {
  try {
    const login = await fetchGithubLogin(accountId, process.env.GITHUB_TOKEN);
    await saveGithubLogin(userId, login);
    synced++;
    console.log(`${userId} → ${login ?? "(no GitHub account)"}`);
  } catch (e) {
    console.error(`${userId}: ${e instanceof Error ? e.message : e}`);
    if (e instanceof Error && /\b(403|429)\b/.test(e.message)) break; // Rate limited; re-run later.
  }
}
console.log(`Synced ${synced} of ${accounts.length} GitHub logins.`);
