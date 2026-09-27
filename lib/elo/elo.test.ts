import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test, type TestContext } from "node:test";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { eloCheckpoint, eloCheckpointRating, round, user } from "@/lib/db/schema";
import { GET } from "@/app/api/cron/elo-checkpoint/route";
import { ELO_ALGORITHM_VERSION, updateElo } from "./algorithm";
import {
  buildEloCheckpointIfNeeded, ELO_CHECKPOINT_BUILD_TIMEOUT_MS, ELO_CHECKPOINT_MAX_AGE_MS,
  ELO_CHECKPOINT_MIN_NEW_ROUNDS, ELO_CHECKPOINT_SAFETY_WINDOW_MS,
} from "./checkpoints";
import { eloHistoryQuery, getCurrentEloRatings, getDatabaseNow, loadEloMatches, loadLatestEloCheckpoint, rebuildEloFromHistory } from "./queries";
import { replayElo } from "./replay";
import type { EloMatch, EloRatings } from "./types";

const dir = mkdtempSync(join(tmpdir(), "trolley-elo-test-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;
const T = 1_750_000_000_000;
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function sameRatings(a: EloRatings, b: EloRatings) {
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort());
  for (const [id, state] of a) {
    near(state.rating, b.get(id)!.rating);
    assert.equal(state.games, b.get(id)!.games, id);
  }
}
const match = (id: string, decision: EloMatch["decision"] = "flip", time = T): EloMatch => ({
  id, playerUserId: "a", opponentUserId: "b", decision, resolvedAt: new Date(time),
});
const history = (count: number, time = T): EloMatch[] => Array.from({ length: count }, (_, i) => ({
  id: String(i).padStart(8, "0"), playerUserId: String(i % 17), opponentUserId: String((i * 7 + 1) % 17 === i % 17 ? (i + 1) % 17 : (i * 7 + 1) % 17),
  decision: i % 3 === 0 ? "dont_flip" : "flip", resolvedAt: new Date(time + Math.floor(i / 4)),
}));

async function addUsers(ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    await db.insert(user).values(ids.slice(i, i + 100).map(id => ({ id, name: id, email: `${id}@test.invalid` }))).onConflictDoNothing();
  }
}
async function insertMatches(matches: EloMatch[]) {
  await addUsers([...new Set(matches.flatMap(m => [m.playerUserId, m.opponentUserId]))]);
  for (let i = 0; i < matches.length; i += 50) {
    await db.insert(round).values(matches.slice(i, i + 50).map(m => ({
      ...m, status: "resolved" as const, playerArgumentSnapshot: "a", opponentDefenseSnapshot: "b",
      probabilityFlip: 0.5, probabilityDontFlip: 0.5, confidence: 0.5, model: "test", judgingAt: m.resolvedAt,
    })));
  }
}
async function snapshot(id: string, cutoff: number, ratings: EloRatings, options: {
  version?: string; status?: "ready" | "building" | "failed"; readyAt?: number; startedAt?: number; rounds?: number;
} = {}) {
  const status = options.status ?? "ready";
  await db.insert(eloCheckpoint).values({
    id, algorithmVersion: options.version ?? ELO_ALGORITHM_VERSION, status,
    cutoffResolvedAt: new Date(cutoff), roundsProcessed: options.rounds ?? [...ratings.values()].reduce((n, s) => n + s.games, 0) / 2,
    readyAt: status === "ready" ? new Date(options.readyAt ?? await getDatabaseNow()) : null,
    failedAt: status === "failed" ? new Date() : null,
    ...(options.startedAt === undefined ? {} : { startedAt: new Date(options.startedAt) }),
  });
  if (ratings.size) await db.insert(eloCheckpointRating).values([...ratings].map(([userId, state]) => ({ checkpointId: id, userId, ...state })));
}

/** Pause exactly one claim statement to exercise races without sleeps or clock guesses. */
function pauseClaim(t: TestContext, afterInsert: boolean) {
  const reached = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const execute = db.$client.execute.bind(db.$client);
  let paused = false;
  t.mock.method(db.$client, "execute", async (...args: Parameters<typeof execute>) => {
    // execute has both (string, args) and ({ sql, args }) overloads.
    const input = args[0] as string | { sql: string };
    const statement = typeof input === "string" ? input : input.sql;
    if (!paused && statement.includes("insert into elo_checkpoint (")) {
      paused = true;
      const result = afterInsert ? await execute(...args) : undefined;
      reached.resolve();
      await resume.promise;
      return result ?? execute(...args);
    }
    return execute(...args);
  });
  return { reached: reached.promise, resume: () => resume.resolve() };
}

before(async () => { await migrate(db, { migrationsFolder: "drizzle" }); });
after(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(async () => {
  await db.delete(eloCheckpoint);
  await db.delete(round);
  await db.delete(user);
});

describe("pure Elo v1", () => {
  test("equal ratings and reverse outcome", () => {
    assert.deepEqual(updateElo(1500, 1500, 1), { player: 1516, opponent: 1484 });
    assert.deepEqual(updateElo(1500, 1500, 0), { player: 1484, opponent: 1516 });
  });
  test("conserves rating over many asymmetric games without rounding", () => {
    let a = 1321.123, b = 1789.987;
    for (let i = 0; i < 1000; i++) {
      const next = updateElo(a, b, i % 3 === 0 ? 1 : 0);
      near(next.player - a + next.opponent - b, 0);
      a = next.player; b = next.opponent;
    }
    near(a + b, 1321.123 + 1789.987);
    assert.notEqual(a, Math.round(a));
  });
  test("upsets gain more, favorite wins gain little", () => {
    assert.ok(updateElo(1200, 1800, 1).player - 1200 > 16);
    assert.ok(updateElo(1800, 1200, 1).player - 1800 < 1);
  });
  test("persisted flip/dont_flip map to the correct winner", () => {
    assert.deepEqual(replayElo(new Map(), [match("1")]), new Map([
      ["a", { rating: 1516, games: 1 }], ["b", { rating: 1484, games: 1 }],
    ]));
    assert.deepEqual(replayElo(new Map(), [match("1", "dont_flip")]), new Map([
      ["a", { rating: 1484, games: 1 }], ["b", { rating: 1516, games: 1 }],
    ]));
  });
  test("same timestamps order by id, earlier timestamps take precedence; inputs stay untouched", () => {
    const a = match("a"), b = match("b", "dont_flip"), earlier = match("z", "dont_flip", T - 1);
    const input = [b, a, earlier];
    const initial: EloRatings = new Map([["a", { rating: 1600.12, games: 10 }]]);
    const saved = structuredClone(initial);
    const state = replayElo(initial, input);
    const expected = replayElo(replayElo(replayElo(initial, [earlier]), [a]), [b]);
    assert.deepEqual(state, expected);
    assert.deepEqual(replayElo(initial, input), state);
    assert.deepEqual(initial, saved);
    assert.deepEqual(input, [b, a, earlier]);
    state.get("a")!.games++;
    assert.deepEqual(initial, saved);
  });
  test("full replay equals checkpoint plus tail, including equality, and chained checkpoints", () => {
    const all = history(2000);
    const T1 = T + 101, T2 = T + 233;
    const A = replayElo(new Map(), all.filter(m => +m.resolvedAt < T1));
    const B = replayElo(A, all.filter(m => +m.resolvedAt >= T1 && +m.resolvedAt < T2));
    sameRatings(B, replayElo(new Map(), all.filter(m => +m.resolvedAt < T2)));
    sameRatings(replayElo(B, all.filter(m => +m.resolvedAt >= T2)), replayElo(new Map(), all));
  });
});

describe("history and checkpoint reads", () => {
  test("database order, half-open boundary and deleting every checkpoint", async () => {
    await insertMatches([match("z", "flip", T - 1), match("c", "dont_flip", T), match("a", "flip", T), match("x", "flip", T + 1)]);
    const prefix = await loadEloMatches(undefined, T);
    const tail = await loadEloMatches(T);
    assert.deepEqual(prefix.map(m => m.id), ["z"]);
    assert.deepEqual(tail.map(m => m.id), ["a", "c", "x"]);
    await snapshot("ready", T, replayElo(new Map(), prefix));
    const full = await rebuildEloFromHistory();
    sameRatings(await getCurrentEloRatings(), full);
    await db.delete(eloCheckpoint);
    assert.equal((await db.select().from(eloCheckpointRating)).length, 0);
    sameRatings(await getCurrentEloRatings(), full);
  });
  test("created, judging and failed rounds have no Elo meaning", async () => {
    await insertMatches([match("resolved")]);
    const base = { playerUserId: "a", opponentUserId: "b", playerArgumentSnapshot: "a", opponentDefenseSnapshot: "b" };
    await db.insert(round).values([
      { ...base, status: "created" },
      { ...base, status: "judging", judgingAt: new Date(T) },
      { ...base, status: "failed", judgingAt: new Date(T), failedAt: new Date(T), failureCode: "jev_failed" },
    ]);
    assert.equal((await loadEloMatches()).length, 1);
    sameRatings(await getCurrentEloRatings(), replayElo(new Map(), [match("resolved")]));
  });
  test("ignores old algorithms, building and failed snapshots even with newer cutoffs", async () => {
    await insertMatches(history(100));
    const full = await rebuildEloFromHistory();
    await snapshot("old", T + 100, new Map(), { version: "elo-old" });
    sameRatings(await getCurrentEloRatings(), full);
    await snapshot("ready", T + 10, replayElo(new Map(), await loadEloMatches(undefined, T + 10)));
    await snapshot("building", T + 200, new Map(), { status: "building" });
    await snapshot("failed", T + 300, new Map(), { status: "failed" });
    assert.equal((await loadLatestEloCheckpoint())?.id, "ready");
    sameRatings(await getCurrentEloRatings(), full);
  });
  test("chronological queries use the covering Elo index without a sort", async () => {
    for (const query of [eloHistoryQuery(), eloHistoryQuery(T), eloHistoryQuery(T, T + 10)]) {
      const plan = await db.all<{ detail: string }>(sql`explain query plan ${query}`);
      assert.ok(plan.some(r => r.detail.includes("round_elo_replay_idx")), JSON.stringify(plan));
      assert.ok(plan.every(r => !r.detail.includes("TEMP B-TREE")), JSON.stringify(plan));
    }
  });
});

describe("checkpoint construction", () => {
  test("initial build, cumulative delta, safety window, and full precision round trip", async () => {
    await insertMatches(history(250));
    const first = await buildEloCheckpointIfNeeded();
    assert.equal(first.status, "built");
    const A = (await loadLatestEloCheckpoint())!;
    assert.equal(A.roundsProcessed, 250);
    assert.ok(A.cutoff <= await getDatabaseNow() - ELO_CHECKPOINT_SAFETY_WINDOW_MS);
    sameRatings(A.ratings, await rebuildEloFromHistory());
    assert.ok([...A.ratings.values()].some(s => s.rating !== Math.round(s.rating)));
    await insertMatches([match("tail", "dont_flip", A.cutoff), match("live", "flip", await getDatabaseNow())]);
    assert.deepEqual(await buildEloCheckpointIfNeeded(), { status: "not_needed" });
    const second = await buildEloCheckpointIfNeeded({ force: true });
    assert.equal(second.status, "built");
    const B = (await loadLatestEloCheckpoint())!;
    assert.equal(B.roundsProcessed, 251);
    assert.equal((await loadEloMatches(B.cutoff)).length, 1);
    sameRatings(await getCurrentEloRatings(), await rebuildEloFromHistory());
  });
  test("never produces an empty checkpoint, even with force or expired age", async () => {
    assert.deepEqual(await buildEloCheckpointIfNeeded({ force: true }), { status: "not_needed" });
    await insertMatches([match("recent", "flip", await getDatabaseNow())]);
    assert.deepEqual(await buildEloCheckpointIfNeeded(), { status: "not_needed" });
    assert.equal((await db.select().from(eloCheckpoint)).length, 0);
    await snapshot("empty-old", T, new Map(), { readyAt: T });
    assert.deepEqual(await buildEloCheckpointIfNeeded(), { status: "not_needed" });
  });
  test("threshold is 5000 eligible rounds, and age permits a smaller delta", async () => {
    const all = history(ELO_CHECKPOINT_MIN_NEW_ROUNDS - 1);
    await insertMatches(all);
    await snapshot("baseline", T, new Map());
    assert.deepEqual(await buildEloCheckpointIfNeeded(), { status: "not_needed" });
    await insertMatches([match("extra", "flip", T)]);
    const built = await buildEloCheckpointIfNeeded();
    assert.equal(built.status, "built");
    assert.equal((await loadLatestEloCheckpoint())?.roundsProcessed, ELO_CHECKPOINT_MIN_NEW_ROUNDS);
    const cutoff = (await loadLatestEloCheckpoint())!.cutoff;
    await insertMatches([match("low-traffic", "flip", cutoff)]);
    await db.update(eloCheckpoint).set({ readyAt: new Date(await getDatabaseNow() - ELO_CHECKPOINT_MAX_AGE_MS - 1) })
      .where(eq(eloCheckpoint.status, "ready"));
    assert.equal((await buildEloCheckpointIfNeeded()).status, "built");
    assert.equal((await loadLatestEloCheckpoint())?.roundsProcessed, ELO_CHECKPOINT_MIN_NEW_ROUNDS + 1);
    sameRatings(await getCurrentEloRatings(), await rebuildEloFromHistory());
  });
  test("two concurrent builders produce one ready checkpoint", async () => {
    await insertMatches(history(100));
    const results = await Promise.all([buildEloCheckpointIfNeeded(), buildEloCheckpointIfNeeded()]);
    assert.deepEqual(results.map(r => r.status).sort(), ["already_building", "built"]);
    assert.equal((await db.select().from(eloCheckpoint)).length, 1);
  });
  test("stale builders expire only for the current version", async () => {
    await insertMatches([match("1")]);
    const startedAt = await getDatabaseNow() - ELO_CHECKPOINT_BUILD_TIMEOUT_MS - 1;
    await snapshot("stale", T, new Map(), { status: "building", startedAt });
    await snapshot("old-version", T, new Map(), { version: "old", status: "building", startedAt });
    assert.equal((await buildEloCheckpointIfNeeded()).status, "built");
    const checkpoints = await db.select().from(eloCheckpoint);
    assert.equal(checkpoints.find(c => c.id === "stale")?.status, "failed");
    assert.ok(checkpoints.find(c => c.id === "stale")?.failedAt);
    assert.equal(checkpoints.find(c => c.id === "old-version")?.status, "building");
  });
  test("a build completed between preflight and claim is re-read, and the unnecessary claim is removed", async t => {
    await insertMatches(history(50));
    const gate = pauseClaim(t, false);
    const delayed = buildEloCheckpointIfNeeded({ force: true });
    await gate.reached;
    try {
      assert.equal((await buildEloCheckpointIfNeeded()).status, "built");
    } finally { gate.resume(); }
    assert.deepEqual(await delayed, { status: "not_needed" });
    assert.equal((await db.select().from(eloCheckpoint)).length, 1);
    sameRatings(await getCurrentEloRatings(), await rebuildEloFromHistory());
  });
  test("an expired owner cannot publish after a replacement acquired its own claim", async t => {
    await insertMatches(history(50));
    const gate = pauseClaim(t, true);
    const delayed = buildEloCheckpointIfNeeded({ force: true });
    await gate.reached;
    const [old] = await db.select().from(eloCheckpoint);
    // Another invocation recovers this lease while the original function is suspended.
    await db.update(eloCheckpoint).set({ startedAt: new Date(await getDatabaseNow() - ELO_CHECKPOINT_BUILD_TIMEOUT_MS - 1) })
      .where(eq(eloCheckpoint.id, old.id));
    const replacement = await buildEloCheckpointIfNeeded();
    assert.equal(replacement.status, "built");
    // New eligible history makes the original reach its fenced publication attempt.
    await insertMatches([match("later", "flip", (await loadLatestEloCheckpoint())!.cutoff)]);
    gate.resume();
    await assert.rejects(delayed, /ownership expired/);
    const checkpoints = await db.select().from(eloCheckpoint);
    assert.equal(checkpoints.find(c => c.id === old.id)?.status, "failed");
    assert.equal(checkpoints.filter(c => c.status === "ready").length, 1);
    assert.equal((await db.select().from(eloCheckpointRating).where(eq(eloCheckpointRating.checkpointId, old.id))).length, 0);
    sameRatings(await getCurrentEloRatings(), await rebuildEloFromHistory());
  });
  test("publication failure rolls back every rating row and leaves history and previous ready state usable", async () => {
    const all = Array.from({ length: 210 }, (_, i) => ({ ...match(String(i)), playerUserId: `p${i}` }));
    await insertMatches(all);
    await snapshot("previous", T, new Map());
    const beforeRounds = await db.select().from(round);
    // Fail after the first 200-player batch was inserted into the transaction.
    await db.run(sql`create trigger reject_elo_rating before insert on elo_checkpoint_rating
      when NEW.user_id = 'p209' begin select raise(abort, 'simulated publication failure'); end`);
    try {
      await assert.rejects(buildEloCheckpointIfNeeded({ force: true }));
    } finally {
      await db.run(sql`drop trigger reject_elo_rating`);
    }
    const checkpoints = await db.select().from(eloCheckpoint);
    assert.equal(checkpoints.filter(c => c.status === "ready").length, 1);
    assert.equal(checkpoints.filter(c => c.status === "failed").length, 1);
    assert.equal((await db.select().from(eloCheckpointRating)).length, 0);
    assert.equal((await loadLatestEloCheckpoint())?.id, "previous");
    assert.deepEqual(await db.select().from(round), beforeRounds);
    sameRatings(await getCurrentEloRatings(), await rebuildEloFromHistory());
  });
  test("retains three ready snapshots, cascading old ratings and preserving other versions", async () => {
    await insertMatches([match("0", "flip", T - 1)]);
    const state = await rebuildEloFromHistory();
    await snapshot("other-version", T, state, { version: "old" });
    await snapshot("unrelated-building", T, new Map(), { version: "other", status: "building" });
    await snapshot("A", T, state);
    await snapshot("B", T + 1, state);
    await snapshot("C", T + 2, state);
    await insertMatches([match("new", "flip", T + 3)]);
    assert.equal((await buildEloCheckpointIfNeeded({ force: true })).status, "built");
    const checkpoints = await db.select().from(eloCheckpoint);
    assert.equal(checkpoints.filter(c => c.status === "ready" && c.algorithmVersion === ELO_ALGORITHM_VERSION).length, 3);
    assert.ok(!checkpoints.some(c => c.id === "A"));
    for (const id of ["B", "C", "other-version", "unrelated-building"]) assert.ok(checkpoints.some(c => c.id === id));
    assert.equal((await db.select().from(eloCheckpointRating).where(eq(eloCheckpointRating.checkpointId, "A"))).length, 0);
    sameRatings(await getCurrentEloRatings(), await rebuildEloFromHistory());
  });
  test("DB guards reject invalid timestamps, duplicate builders and negative games; negative ratings are valid", async () => {
    await addUsers(["a"]);
    await snapshot("claim", T, new Map(), { status: "building" });
    await assert.rejects(snapshot("duplicate", T, new Map(), { status: "building" }));
    await assert.rejects(db.update(eloCheckpoint).set({ status: "ready" }).where(eq(eloCheckpoint.id, "claim")));
    await assert.rejects(db.insert(eloCheckpointRating).values({ checkpointId: "claim", userId: "a", rating: 1500, games: -1 }));
    await db.insert(eloCheckpointRating).values({ checkpointId: "claim", userId: "a", rating: -1.1234, games: 0 });
  });
});

describe("authenticated cron", () => {
  test("missing or wrong secret is rejected before any builder work", async () => {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request("http://localhost/api/cron/elo-checkpoint"))).status, 401);
    process.env.CRON_SECRET = "test-secret";
    assert.equal((await GET(new Request("http://localhost/api/cron/elo-checkpoint", { headers: { authorization: "Bearer wrong" } }))).status, 401);
    assert.equal((await db.select().from(eloCheckpoint)).length, 0);
    const response = await GET(new Request("http://localhost/api/cron/elo-checkpoint", { headers: { authorization: "Bearer test-secret" } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "not_needed" });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    delete process.env.CRON_SECRET;
  });
});
