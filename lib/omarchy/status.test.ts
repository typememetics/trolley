import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { session, user } from "@/lib/db/schema";

const dir = mkdtempSync(join(tmpdir(), "trolley-status-test-"));
const secret = "test-only-omarchy-secret-with-at-least-32-characters";
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.BETTER_AUTH_SECRET = secret;
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.GITHUB_CLIENT_ID = "test-client";
process.env.GITHUB_CLIENT_SECRET = "test-secret";
const { GET } = await import("@/app/api/omarchy/status/route");

before(async () => { await migrate(db, { migrationsFolder: "drizzle" }); });
after(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(async () => { await db.delete(session); await db.delete(user); });

function request(token?: string) {
  const headers = new Headers();
  if (token) {
    const signature = createHmac("sha256", secret).update(token).digest("base64");
    headers.set("cookie", `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`);
  }
  // A supplied user id must never choose the returned identity.
  return new Request("http://localhost:3000/api/omarchy/status?userId=someone-else", { headers });
}

async function seedSession(expiresAt: Date) {
  await db.insert(user).values({ id: "alice", name: "Alice", email: "alice@test.invalid" });
  await db.insert(session).values({ id: "s", token: "test-token", userId: "alice", expiresAt, updatedAt: new Date() });
}

function privateResponse(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie");
}

test("missing and unknown sessions are rejected without exposing a standing", async () => {
  for (const req of [request(), request("unknown")]) {
    const response = await GET(req);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { authenticated: false });
    privateResponse(response);
  }
});

test("a valid session selects its own player and exposes no session secrets", async () => {
  await seedSession(new Date(Date.now() + 86400000));
  const response = await GET(request("test-token"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true, name: "Alice", elo: 1500, rank: null });
  privateResponse(response);
});

test("expired sessions require login again", async () => {
  await seedSession(new Date(Date.now() - 1000));
  const response = await GET(request("test-token"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
  privateResponse(response);
});

test("a tampered cookie does not authenticate", async () => {
  await seedSession(new Date(Date.now() + 86400000));
  const req = request("test-token");
  req.headers.set("cookie", "better-auth.session_token=test-token.invalid");
  assert.equal((await GET(req)).status, 401);
});
