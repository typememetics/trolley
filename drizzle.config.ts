import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Same precedence as Next.js: .env.local overrides .env
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
