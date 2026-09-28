import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { playerProfile, round, user } from "@/lib/db/schema";
import { InvalidJevResultError, type JevDecision } from "@/lib/jev/evaluate-round";
import { saveStandingDefense } from "@/lib/player/profile";
import { createRoundFor } from "./create-round";
import { ROUND_INTERVAL_MS, ROUNDS_PER_DAY } from "@/lib/game/rules";
import { JUDGING_TIMEOUT_MS } from "./queries";
import { resolveRoundFor, type Judge } from "./resolve-round";

// A throwaway SQLite file, migrated exactly as Turso is. `db` connects on first use.
const dir = mkdtempSync(join(tmpdir(), "trolley-round-test-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;

const RULING: JevDecision = {
  decision: "flip",
  probabilities: { flip: 0.782, dont_flip: 0.218 },
  confidence: 0.61,
  model: "jev-1.13.0-reported",
};

/** A stand-in for JEV that records every call and answers only when told to. */
function fakeJudge(answer: () => Promise<JevDecision> = async () => RULING) {
  const calls: [string, string][] = [];
  const judge: Judge = async (player, opponent) => {
    calls.push([player, opponent]);
    return answer();
  };
  return { judge, calls };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

async function newRound() {
  const created = await createRoundFor("alice", "bob");
  assert.ok(created.ok);
  return created.roundId;
}

before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});

after(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  await db.delete(round);
  await db.delete(user);
  await db.insert(user).values(["alice", "bob", "carol"].map(id => ({ id, name: id, email: `${id}@test.invalid` })));
  await db.insert(playerProfile).values([
    { userId: "alice", standingDefense: "I run an animal sanctuary." },
    { userId: "bob", standingDefense: "I maintain the production database." },
    { userId: "carol", standingDefense: null },
  ]);
});

describe("createRoundFor", () => {
  test("snapshots both defenses without asking JEV", async () => {
    const roundId = await newRound();
    const [row] = await db.select().from(round).where(eq(round.id, roundId));
    assert.equal(row.status, "created");
    assert.equal(row.playerUserId, "alice");
    assert.equal(row.opponentUserId, "bob");
    assert.equal(row.playerArgumentSnapshot, "I run an animal sanctuary.");
    assert.equal(row.opponentDefenseSnapshot, "I maintain the production database.");
    assert.equal(row.judgingAt, null);
  });

  test("refuses ineligible matchups and records nothing", async () => {
    assert.deepEqual(await createRoundFor("alice", "alice"), { ok: false, error: "You can't play against yourself." });
    assert.deepEqual(await createRoundFor("carol", "bob"), { ok: false, error: "Write your defense first." });
    assert.equal((await createRoundFor("alice", "carol")).ok, false);
    assert.equal((await createRoundFor("alice", "nobody")).ok, false);
    assert.equal((await db.select().from(round)).length, 0);
  });
});

/** Rounds Alice played `ago` ms back, written directly: created_at can't be backdated later. */
async function pastRounds(count: number, ago: number) {
  const createdAt = new Date(Date.now() - ago);
  await db.insert(round).values(Array.from({ length: count }, () => ({
    playerUserId: "alice",
    opponentUserId: "bob",
    playerArgumentSnapshot: "earlier argument",
    opponentDefenseSnapshot: "earlier defense",
    createdAt,
  })));
}

describe("createRoundFor limits", () => {
  test("one round every five seconds, saying how long to wait", async () => {
    await newRound();
    const again = await createRoundFor("alice", "bob");
    assert.equal(again.ok, false);
    const limited = again.ok ? undefined : again.limited;
    assert.equal(limited?.limit, "too_soon");
    assert.ok(limited?.limit === "too_soon" && limited.retryInMs > 0 && limited.retryInMs <= ROUND_INTERVAL_MS);
    assert.equal((await db.select().from(round)).length, 1);

    // Someone else isn't held up by Alice's round
    assert.ok((await createRoundFor("bob", "alice")).ok);
  });

  test("a round older than the interval doesn't hold the next one up", async () => {
    await pastRounds(1, ROUND_INTERVAL_MS + 1_000);
    assert.ok((await createRoundFor("alice", "bob")).ok);
  });

  test("a simultaneous burst creates exactly one round", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => createRoundFor("alice", "bob")));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal((await db.select().from(round)).length, 1);
  });

  test(`${ROUNDS_PER_DAY} rounds a day, counted over the last 24 hours`, async () => {
    await pastRounds(ROUNDS_PER_DAY, 60 * 60_000);
    const blocked = await createRoundFor("alice", "bob");
    assert.deepEqual(blocked.ok ? undefined : blocked.limited, { limit: "daily_limit" });

    // Yesterday's rounds have aged out
    await db.delete(round);
    await pastRounds(ROUNDS_PER_DAY - 1, 60 * 60_000);
    await pastRounds(1, 25 * 60 * 60_000);
    assert.ok((await createRoundFor("alice", "bob")).ok);
  });
});

describe("resolveRoundFor", () => {
  test("concurrent requests: one claims and calls JEV, the other sees judging", async () => {
    const roundId = await newRound();
    const answer = deferred<JevDecision>();
    const { judge, calls } = fakeJudge(() => answer.promise);

    const a = resolveRoundFor("alice", roundId, judge);
    const b = resolveRoundFor("alice", roundId, judge);
    // Whichever lost the claim returns at once, while the winner is still waiting on JEV
    assert.equal((await Promise.race([a, b]))?.status, "judging");
    answer.resolve(RULING);
    const [ra, rb] = await Promise.all([a, b]);
    assert.deepEqual([ra?.status, rb?.status].sort(), ["judging", "resolved"]);
    assert.equal(calls.length, 1);

    const resolved = ra?.status === "resolved" ? ra : rb;
    assert.equal(resolved?.status, "resolved");
    assert.equal(resolved.decision, "flip");
    assert.equal(resolved.probabilityFlip, 0.782);
    assert.equal(resolved.probabilityDontFlip, 0.218);
    assert.equal(resolved.confidence, 0.61);
    // The model JEV reported, not the one we asked for
    assert.equal(resolved.model, "jev-1.13.0-reported");

    // Request C, after resolution: the stored verdict, no JEV
    const c = await resolveRoundFor("alice", roundId, judge);
    assert.deepEqual(c, resolved);
    assert.equal(calls.length, 1);
  });

  test("a burst of simultaneous requests calls JEV once", async () => {
    const roundId = await newRound();
    const { judge, calls } = fakeJudge();
    const results = await Promise.all(Array.from({ length: 20 }, () => resolveRoundFor("alice", roundId, judge)));
    assert.equal(calls.length, 1);
    assert.equal(results.filter(r => r?.status === "resolved").length >= 1, true);
    assert.equal((await resolveRoundFor("alice", roundId, judge))?.status, "resolved");
  });

  test("judges the snapshots, not the profiles as edited since", async () => {
    const roundId = await newRound();
    await saveStandingDefense("bob", "I rescue 40 million insects.");
    await saveStandingDefense("alice", "Something else entirely.");
    const { judge, calls } = fakeJudge();
    const resolved = await resolveRoundFor("alice", roundId, judge);
    assert.deepEqual(calls, [["I run an animal sanctuary.", "I maintain the production database."]]);
    assert.equal(resolved?.opponentDefenseSnapshot, "I maintain the production database.");

    // The next round sees the new text; the old one keeps the old. Bob starts it, since
    // Alice has just played and must wait out the interval.
    const next = await createRoundFor("bob", "alice");
    assert.ok(next.ok);
    const [row] = await db.select().from(round).where(eq(round.id, next.roundId));
    assert.equal(row.playerArgumentSnapshot, "I rescue 40 million insects.");
    assert.equal(row.opponentDefenseSnapshot, "Something else entirely.");
  });

  test("a JEV failure fails the round for good", async () => {
    const roundId = await newRound();
    const failing = fakeJudge(() => Promise.reject(new Error("401 invalid key, secret-ish details")));
    const failed = await resolveRoundFor("alice", roundId, failing.judge);
    assert.equal(failed?.status, "failed");
    assert.equal(failed.failureCode, "jev_failed");

    const [row] = await db.select().from(round).where(eq(round.id, roundId));
    assert.equal(row.decision, null);
    assert.equal(JSON.stringify(row).includes("secret-ish"), false);

    const again = fakeJudge();
    assert.equal((await resolveRoundFor("alice", roundId, again.judge))?.status, "failed");
    assert.equal(again.calls.length, 0);
  });

  test("an invalid JEV answer is recorded as invalid_jev_result", async () => {
    const roundId = await newRound();
    const { judge } = fakeJudge(() => Promise.reject(new InvalidJevResultError("bad choice")));
    const failed = await resolveRoundFor("alice", roundId, judge);
    assert.equal(failed?.status === "failed" && failed.failureCode, "invalid_jev_result");
  });

  test("a stale judging round times out without calling JEV", async () => {
    await db.insert(round).values({
      id: "stale",
      playerUserId: "alice",
      opponentUserId: "bob",
      playerArgumentSnapshot: "a",
      opponentDefenseSnapshot: "b",
      status: "judging",
      judgingAt: new Date(Date.now() - JUDGING_TIMEOUT_MS - 1000),
    });
    const { judge, calls } = fakeJudge();
    const expired = await resolveRoundFor("alice", "stale", judge);
    assert.equal(expired?.status === "failed" && expired.failureCode, "judging_timeout");
    assert.equal(calls.length, 0);
  });

  test("a fresh judging round is left alone", async () => {
    await db.insert(round).values({
      id: "fresh",
      playerUserId: "alice",
      opponentUserId: "bob",
      playerArgumentSnapshot: "a",
      opponentDefenseSnapshot: "b",
      status: "judging",
      judgingAt: new Date(),
    });
    const { judge, calls } = fakeJudge();
    assert.equal((await resolveRoundFor("alice", "fresh", judge))?.status, "judging");
    assert.equal(calls.length, 0);
  });

  test("only the player who created the round can resolve it", async () => {
    const roundId = await newRound();
    const { judge, calls } = fakeJudge();
    assert.equal(await resolveRoundFor("bob", roundId, judge), null);
    assert.equal(await resolveRoundFor("carol", roundId, judge), null);
    assert.equal(await resolveRoundFor("alice", "no-such-round", judge), null);
    assert.equal(calls.length, 0);
    assert.equal((await db.select().from(round).where(eq(round.id, roundId)))[0].status, "created");
  });
});

describe("database guards", () => {
  test("round inputs can't be rewritten", async () => {
    const roundId = await newRound();
    await resolveRoundFor("alice", roundId, fakeJudge().judge);
    await assert.rejects(db.update(round).set({ opponentDefenseSnapshot: "edited" }).where(eq(round.id, roundId)));
    await assert.rejects(db.update(round).set({ decision: "dont_flip" }).where(eq(round.id, roundId)));
  });

  test("a resolved round needs its whole verdict", async () => {
    await assert.rejects(db.run(sql`
      insert into round (id, player_user_id, opponent_user_id, player_argument_snapshot, opponent_defense_snapshot, status, judging_at, resolved_at)
      values ('broken', 'alice', 'bob', 'a', 'b', 'resolved', 1, 2)`));
  });
});
