import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { round, user } from "./schema";

test("Elo migration upgrades existing history without changing rounds or their immutable guards", async () => {
  const dir = mkdtempSync(join(tmpdir(), "trolley-migration-test-"));
  const client = createClient({ url: `file:${join(dir, "upgrade.db")}` });
  const database = drizzle(client);
  try {
    const prior = join(dir, "prior");
    mkdirSync(join(prior, "meta"), { recursive: true });
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 4);
    writeFileSync(join(prior, "meta/_journal.json"), JSON.stringify(journal));
    for (const entry of journal.entries) cpSync(`drizzle/${entry.tag}.sql`, join(prior, `${entry.tag}.sql`));
    await migrate(database, { migrationsFolder: prior });
    await database.insert(user).values(["a", "b"].map(id => ({ id, name: id, email: `${id}@test.invalid` })));
    const base = { playerUserId: "a", opponentUserId: "b", playerArgumentSnapshot: "original argument", opponentDefenseSnapshot: "original defense" };
    const at = new Date(1750000000000);
    await database.insert(round).values([
      { ...base, id: "created", status: "created" },
      { ...base, id: "judging", status: "judging", judgingAt: at },
      { ...base, id: "failed", status: "failed", judgingAt: at, failedAt: at, failureCode: "jev_failed" },
      { ...base, id: "resolved", status: "resolved", judgingAt: at, resolvedAt: at, decision: "flip", probabilityFlip: 0.7, probabilityDontFlip: 0.3, confidence: 0.8, model: "original-model" },
    ]);
    const original = await database.select().from(round).orderBy(round.id);
    await migrate(database, { migrationsFolder: "drizzle" });
    assert.deepEqual(await database.select().from(round).orderBy(round.id), original);
    await assert.rejects(database.run(sql`update round set decision = 'dont_flip' where id = 'resolved'`));
    assert.deepEqual(await database.all(sql`pragma foreign_key_check`), []);
    const tables = await database.all<{ name: string }>(sql`select name from sqlite_master where type = 'table' and name like 'elo_%'`);
    assert.deepEqual(tables.map(t => t.name).sort(), ["elo_checkpoint", "elo_checkpoint_rating"]);
    await migrate(database, { migrationsFolder: "drizzle" }); // Deployment retries are harmless.
    assert.deepEqual(await database.select().from(round).orderBy(round.id), original);
  } finally {
    client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
