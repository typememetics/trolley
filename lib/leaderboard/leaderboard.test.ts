import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "@/lib/db";
import { round, user } from "@/lib/db/schema";
import type { LeverDecision } from "@/lib/game/types";
import { getLeaderboard, leaderboardQuery } from "./queries";
import type { LeaderboardEntry } from "./types";

// A throwaway SQLite file, migrated exactly as Turso is. `db` connects on first use.
const dir = mkdtempSync(join(tmpdir(), "trolley-leaderboard-test-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "test.db")}`;
delete process.env.TURSO_AUTH_TOKEN;

let sequence = 0;
const at = new Date("2026-01-01T00:00:00Z");

async function users(...names: string[]) {
  await db.insert(user).values(names.map(name => ({ id: name.toLowerCase(), name, email: `${name}@test.invalid` })));
}

const inputs = (player: string, opponent: string) => ({
  playerUserId: player,
  opponentUserId: opponent,
  playerArgumentSnapshot: `${player}'s case`,
  opponentDefenseSnapshot: `${opponent}'s case`,
});

/** A round JEV has ruled on, written as completeRound leaves it. */
async function resolved(player: string, opponent: string, decision: LeverDecision) {
  await db.insert(round).values({
    ...inputs(player, opponent),
    id: String(++sequence).padStart(8, "0"),
    status: "resolved",
    decision,
    probabilityFlip: decision === "flip" ? 0.9 : 0.1,
    probabilityDontFlip: decision === "flip" ? 0.1 : 0.9,
    confidence: 0.8,
    model: "jev-test",
    judgingAt: at,
    resolvedAt: at,
  });
}

const entry = (board: LeaderboardEntry[], userId: string) => board.find(e => e.userId === userId);

/** Every count at once, so a wrong field can't hide behind a right one. */
const record = (e: LeaderboardEntry | undefined) => e && {
  rounds: e.rounds,
  survived: e.survived,
  flattened: e.flattened,
  survivalRate: e.survivalRate,
  attackRounds: e.attackRounds,
  attackSurvived: e.attackSurvived,
  defenseRounds: e.defenseRounds,
  defenseSurvived: e.defenseSurvived,
};

before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
});

after(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(async () => {
  await db.delete(round);
  await db.delete(user);
});

describe("getLeaderboard", () => {
  test("flip: the player on attack survives, the opponent on defense is flattened", async () => {
    await users("Alice", "Bob");
    await resolved("alice", "bob", "flip");
    const board = await getLeaderboard();

    assert.deepEqual(record(entry(board, "alice")), {
      rounds: 1, survived: 1, flattened: 0, survivalRate: 1,
      attackRounds: 1, attackSurvived: 1, defenseRounds: 0, defenseSurvived: 0,
    });
    assert.deepEqual(record(entry(board, "bob")), {
      rounds: 1, survived: 0, flattened: 1, survivalRate: 0,
      attackRounds: 0, attackSurvived: 0, defenseRounds: 1, defenseSurvived: 0,
    });
  });

  test("dont_flip: the player on attack is flattened, the opponent on defense survives", async () => {
    await users("Alice", "Bob");
    await resolved("alice", "bob", "dont_flip");
    const board = await getLeaderboard();

    assert.deepEqual(record(entry(board, "alice")), {
      rounds: 1, survived: 0, flattened: 1, survivalRate: 0,
      attackRounds: 1, attackSurvived: 0, defenseRounds: 0, defenseSurvived: 0,
    });
    assert.deepEqual(record(entry(board, "bob")), {
      rounds: 1, survived: 1, flattened: 0, survivalRate: 1,
      attackRounds: 0, attackSurvived: 0, defenseRounds: 1, defenseSurvived: 1,
    });
  });

  test("only resolved rounds count: created, judging and failed contribute nothing", async () => {
    await users("Alice", "Bob", "Carol");
    await db.insert(round).values([
      { ...inputs("alice", "bob"), status: "created" },
      { ...inputs("alice", "bob"), status: "judging", judgingAt: at },
      { ...inputs("alice", "carol"), status: "failed", judgingAt: at, failedAt: at, failureCode: "jev_failed" },
      { ...inputs("bob", "carol"), status: "failed", judgingAt: at, failedAt: at, failureCode: "judging_timeout" },
    ]);
    assert.deepEqual(await getLeaderboard(), []);

    await resolved("alice", "bob", "flip");
    const board = await getLeaderboard();
    assert.deepEqual(board.map(e => e.userId), ["alice", "bob"]);
    assert.equal(entry(board, "alice")?.rounds, 1);
    assert.equal(entry(board, "bob")?.rounds, 1);
  });

  test("attack and defense rounds add up into one entry per player", async () => {
    await users("Alice", "Bob");
    await resolved("alice", "bob", "flip"); // alice attack survives, bob defense flattened
    await resolved("bob", "alice", "flip"); // bob attack survives, alice defense flattened
    await resolved("alice", "bob", "dont_flip"); // alice attack flattened, bob defense survives
    const board = await getLeaderboard();

    assert.equal(board.length, 2);
    assert.deepEqual(record(entry(board, "alice")), {
      rounds: 3, survived: 1, flattened: 2, survivalRate: 1 / 3,
      attackRounds: 2, attackSurvived: 1, defenseRounds: 1, defenseSurvived: 0,
    });
    assert.deepEqual(record(entry(board, "bob")), {
      rounds: 3, survived: 2, flattened: 1, survivalRate: 2 / 3,
      attackRounds: 1, attackSurvived: 1, defenseRounds: 2, defenseSurvived: 1,
    });
  });

  test("Elo outranks survival percentage and candidates are chosen before survival stats", async () => {
    await users("Expert", "Novice", "Opponent", "Other");
    for (let i = 0; i < 8; i++) await resolved("expert", "opponent", "flip");
    await resolved("expert", "opponent", "dont_flip");
    await resolved("novice", "other", "flip");
    const board = await getLeaderboard(1);
    assert.equal(board[0].userId, "expert");
    assert.equal(board[0].survivalRate, 8 / 9);
    assert.equal(board[0].eloGames, 9);
    assert.ok(board[0].elo > 1516);
    assert.equal(board[0].image, null); // Seed players need no avatar to compete.
  });

  test("name NOCASE and user id break exact Elo/game ties, including at the limit", async () => {
    await users("Zed", "ann", "Bea", "x", "y", "z");
    await resolved("zed", "x", "flip");
    await resolved("ann", "y", "flip");
    await resolved("bea", "z", "flip");
    assert.deepEqual((await getLeaderboard(2)).map(e => e.userId), ["ann", "bea"]);
    await db.run(sql`update user set name = 'ANN' where id = 'zed'`);
    assert.deepEqual((await getLeaderboard(2)).map(e => e.userId), ["ann", "zed"]);
  });

  test("raw rating precedes games, and games precede canonical name", async () => {
    await users("Alice", "Bob", "Carol");
    const rows = await db.all<{ userId: string }>(leaderboardQuery([
      { userId: "alice", elo: 1516.1, eloGames: 20 },
      { userId: "bob", elo: 1516.2, eloGames: 1 },
      { userId: "carol", elo: 1516.1, eloGames: 30 },
    ], 3));
    assert.deepEqual(rows.map(e => e.userId), ["bob", "carol", "alice"]);
  });

  test("limit keeps the top of the ranking", async () => {
    await users("Alice", "Bob", "Carol");
    await resolved("alice", "bob", "flip");
    await resolved("carol", "bob", "dont_flip");
    assert.deepEqual((await getLeaderboard(1)).map(e => e.userId), ["alice"]);
  });

  test("an empty history is an empty leaderboard", async () => {
    await users("Alice");
    assert.deepEqual(await getLeaderboard(), []);
  });

  test("aggregates from the resolved-round index, never the round rows", async () => {
    const plan = await db.all<{ detail: string }>(sql`explain query plan ${leaderboardQuery([{ userId: "alice", elo: 1516, eloGames: 1 }], 100)}`);
    const details = plan.map(row => row.detail);
    assert.equal(details.filter(d => d.includes("COVERING INDEX round_resolved_outcome_idx")).length, 2, details.join("\n"));
  });
});
