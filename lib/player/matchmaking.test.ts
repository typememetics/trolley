import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { eloCheckpoint, eloCheckpointRating, playerProfile, user } from "@/lib/db/schema";
import { ELO_ALGORITHM_VERSION } from "@/lib/elo/algorithm";
import { findRandomOpponent } from "./opponent";

// A throwaway SQLite file, migrated exactly as Turso is. `db` connects on first use.
const dir = mkdtempSync(join(tmpdir(), "trolley-matchmaking-test-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;

const DRAWS = 3000;

async function players(...ids: string[]) {
  await db.insert(user).values(ids.map(id => ({ id, name: id, email: `${id}@test.invalid` })));
  await db.insert(playerProfile).values(ids.map(userId => ({ userId, standingDefense: `${userId}'s case` })));
}

async function checkpoint(id: string, ratings: Record<string, number>, { version = ELO_ALGORITHM_VERSION, cutoff = 1 } = {}) {
  await db.insert(eloCheckpoint).values({
    id, algorithmVersion: version, status: "ready", cutoffResolvedAt: new Date(cutoff), readyAt: new Date(cutoff),
  });
  await db.insert(eloCheckpointRating).values(Object.entries(ratings).map(([userId, rating]) => ({ checkpointId: id, userId, rating, games: 1 })));
}

async function draw(playerId: string) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < DRAWS; i++) {
    const found = await findRandomOpponent(playerId);
    assert.ok(found);
    counts[found.userId] = (counts[found.userId] ?? 0) + 1;
  }
  return counts;
}

before(async () => { await migrate(db, { migrationsFolder: "drizzle" }); });
beforeEach(async () => {
  await db.run(sql`delete from elo_checkpoint`);
  await db.run(sql`delete from user`);
});
after(() => rmSync(dir, { recursive: true, force: true }));

describe("findRandomOpponent", () => {
  test("returns null when nobody else has a defense", async () => {
    await players("me");
    assert.equal(await findRandomOpponent("me"), null);
  });

  test("favours close ratings without excluding distant ones", async () => {
    await players("me", "near", "mid", "far");
    await checkpoint("c", { me: 1500, near: 1520, mid: 1750, far: 2200 });
    const counts = await draw("me");
    // Weights ≈ 0.995 : 0.46 : 0.02 of 1.475
    assert.ok(counts.near > counts.mid * 1.6, JSON.stringify(counts));
    assert.ok(counts.mid > counts.far * 8, JSON.stringify(counts));
    assert.ok(counts.far > 0, JSON.stringify(counts));
  });

  test("is roughly uniform without a checkpoint", async () => {
    await players("me", "a", "b", "c");
    const counts = await draw("me");
    for (const id of ["a", "b", "c"]) assert.ok(Math.abs(counts[id] - DRAWS / 3) < DRAWS / 10, JSON.stringify(counts));
  });

  test("reads only the latest checkpoint of the current version", async () => {
    await players("me", "a", "b");
    await checkpoint("old", { me: 1500, a: 2500, b: 1500 }, { cutoff: 1 });
    await checkpoint("other", { me: 1500, a: 2500, b: 1500 }, { cutoff: 3, version: "elo-v0" });
    await checkpoint("new", { me: 1500, a: 1500, b: 2500 }, { cutoff: 2 });
    const counts = await draw("me");
    assert.ok(counts.a > counts.b * 10, JSON.stringify(counts));
  });

  test("rates unrated players as new", async () => {
    await players("me", "fresh", "veteran");
    await checkpoint("c", { me: 2100, veteran: 2100 });
    const counts = await draw("me");
    assert.ok(counts.veteran > counts.fresh * 10, JSON.stringify(counts));
  });
});
