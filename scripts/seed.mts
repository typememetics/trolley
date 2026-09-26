// Joke opponents for development, so the upper track isn't empty before real players arrive.
// They have no GitHub account row, so nobody can sign in as them. Safe to re-run.
// Remove them with: DELETE FROM user WHERE id LIKE 'seed-%'  (their profiles cascade)
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const JOKE_PLAYERS = [
  ["null-pointer-nancy", "Null Pointer Nancy", "I'm the only one who knows why the prod server still runs on a laptop under my desk."],
  ["force-push-frank", "Force Push Frank", "Kill me and my last force push to main becomes the only surviving copy of the codebase."],
  ["tabs-not-spaces-tina", "Tabs-Not-Spaces Tina", "I've never started a flame war. I've only finished them."],
  ["works-on-my-machine-walt", "Works-On-My-Machine Walt", "It works on my machine. If I die, it works on no machine."],
  ["regex-rachel", "Regex Rachel", "I wrote the email validation regex. Nobody else can read it. Nobody else ever will."],
  ["yaml-yusuf", "YAML Yusuf", "I am the only person alive who knows which indentation the CI config actually wants."],
  ["todo-later-lars", "TODO-Later Lars", "I have 4,000 TODO comments in production. Let me live and I'll get to them. Eventually."],
  ["dependency-dana", "Dependency Dana", "I maintain a 3-line npm package with 40 million weekly downloads. Choose wisely."],
] as const;

const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });

await db.batch(JOKE_PLAYERS.flatMap(([handle, name, defense]) => [
  {
    sql: "INSERT INTO user (id, name, email) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name",
    args: [`seed-${handle}`, name, `${handle}@seed.invalid`],
  },
  {
    sql: `INSERT INTO player_profile (user_id, standing_defense) VALUES (?, ?)
          ON CONFLICT (user_id) DO UPDATE SET standing_defense = excluded.standing_defense`,
    args: [`seed-${handle}`, defense],
  },
]), "write");

console.log(`Seeded ${JOKE_PLAYERS.length} joke players.`);
