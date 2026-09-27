import { config } from "dotenv";
import { buildEloCheckpointIfNeeded } from "../lib/elo/checkpoints";

config({ path: [".env.local", ".env"], quiet: true });
const args = process.argv.slice(2).filter(arg => arg !== "--");
if (args.some(arg => arg !== "--force")) throw new Error("Usage: pnpm elo:checkpoint [--force]");
console.log(await buildEloCheckpointIfNeeded({ force: args.includes("--force") }));
