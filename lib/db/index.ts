import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function connect() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  return drizzle({ connection: { url, authToken: process.env.TURSO_AUTH_TOKEN }, schema });
}

type Database = ReturnType<typeof connect>;
let instance: Database | undefined;

/**
 * Connects on first use, not on import: `next build` imports the auth route while
 * collecting page data, and the build environment has no database credentials.
 */
export const db = new Proxy({} as Database, {
  get(_, prop) {
    instance ??= connect();
    const value: unknown = Reflect.get(instance, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
