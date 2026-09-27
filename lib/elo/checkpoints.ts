import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { eloCheckpoint, eloCheckpointRating } from "@/lib/db/schema";
import { ELO_ALGORITHM_VERSION } from "./algorithm";
import { databaseNow, eloHistoryWhere, getDatabaseNow, loadEloMatches, loadLatestEloCheckpoint } from "./queries";
import { replayElo } from "./replay";

export const ELO_CHECKPOINT_BUILD_TIMEOUT_MS = 15 * 60_000;
export const ELO_CHECKPOINT_SAFETY_WINDOW_MS = 60_000;
export const ELO_CHECKPOINT_MIN_NEW_ROUNDS = 5_000;
export const ELO_CHECKPOINT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const ELO_CHECKPOINT_RETENTION = 3;

export type CheckpointResult =
  | { status: "built"; checkpointId: string; rounds: number }
  | { status: "not_needed" }
  | { status: "already_building" };

const isBusy = (cause: unknown): boolean => cause instanceof Error && (
  ("code" in cause && cause.code === "SQLITE_BUSY") || isBusy(cause.cause)
);

/** Scheduled/CLI maintenance only. Never called by round creation or resolution. */
export async function buildEloCheckpointIfNeeded({ force = false }: { force?: boolean } = {}): Promise<CheckpointResult> {
  const started = performance.now();
  const version = ELO_ALGORITHM_VERSION;
  const log = (result: string, fields: Record<string, unknown> = {}) => console.info(`Elo checkpoint ${result}`, {
    algorithmVersion: version, ...fields, durationMs: Math.round(performance.now() - started),
  });
  const activeBuilder = async () => (await db.select({ id: eloCheckpoint.id }).from(eloCheckpoint)
    .where(and(eq(eloCheckpoint.algorithmVersion, version), eq(eloCheckpoint.status, "building"))).limit(1))[0];
  const contended = (): CheckpointResult => {
    log("already building");
    return { status: "already_building" };
  };
  // Avoid acquiring a write lock just to expire zero rows on ordinary concurrent calls.
  const [building] = await db.all<{ stale: number }>(sql`
    select started_at < ${databaseNow} - ${ELO_CHECKPOINT_BUILD_TIMEOUT_MS} as stale
    from elo_checkpoint where algorithm_version = ${version} and status = 'building'
  `);
  if (building && !building.stale) return contended();
  if (building) {
    try {
      await db.update(eloCheckpoint).set({ status: "failed", failedAt: databaseNow }).where(and(
        eq(eloCheckpoint.algorithmVersion, version), eq(eloCheckpoint.status, "building"),
        lt(eloCheckpoint.startedAt, sql`${databaseNow} - ${ELO_CHECKPOINT_BUILD_TIMEOUT_MS}`),
      ));
    } catch (cause) {
      if (isBusy(cause) && await activeBuilder()) return contended();
      throw cause;
    }
  }

  // Cheap preflight: no rating snapshot or match rows loaded on ordinary hourly skips.
  const latest = await db.all<{ cutoff: number; readyAt: number }>(sql`
    select cutoff_resolved_at as cutoff, ready_at as readyAt from elo_checkpoint
    where algorithm_version = ${version} and status = 'ready'
    order by cutoff_resolved_at desc, id desc limit 1
  `);
  const assess = async (source?: { cutoff: number; readyAt: number }) => {
    const now = await getDatabaseNow();
    const cutoff = now - ELO_CHECKPOINT_SAFETY_WINDOW_MS;
    const [count] = await db.all<{ rounds: number }>(sql`
      select count(*) as rounds from round where ${eloHistoryWhere(source?.cutoff, cutoff)}
    `);
    const age = source ? now - source.readyAt : null;
    return {
      cutoff, deltaRounds: count.rounds, age,
      needed: (!source || cutoff > source.cutoff) && count.rounds > 0
        && (force || !source || count.rounds >= ELO_CHECKPOINT_MIN_NEW_ROUNDS || (age !== null && age >= ELO_CHECKPOINT_MAX_AGE_MS)),
    };
  };
  const candidate = await assess(latest[0]);
  if (!candidate.needed) {
    log("not needed", candidate);
    return { status: "not_needed" };
  }

  // Drizzle's SQLite onConflictDoNothing places `where` after DO NOTHING; a partial
  // conflict target needs it before DO NOTHING. Keep this one statement explicit.
  let claim: { id: string } | undefined;
  try {
    [claim] = await db.all<{ id: string }>(sql`
      insert into elo_checkpoint (id, algorithm_version, status, cutoff_resolved_at)
      values (${crypto.randomUUID()}, ${version}, 'building', ${candidate.cutoff})
      on conflict (algorithm_version) where status = 'building' do nothing
      returning id
    `);
  } catch (cause) {
    // Local SQLite can report a busy writer before evaluating the unique constraint.
    // Only classify that as contention when a durable build claim actually exists.
    if (isBusy(cause) && await activeBuilder()) return contended();
    throw cause;
  }
  if (!claim) return contended();
  const ownsClaim = and(eq(eloCheckpoint.id, claim.id), eq(eloCheckpoint.algorithmVersion, version), eq(eloCheckpoint.status, "building"));
  try {
    // Re-read AFTER ownership: another builder could have finished during preflight.
    const source = await loadLatestEloCheckpoint();
    const assessment = await assess(source ?? undefined);
    if (!assessment.needed) {
      await db.delete(eloCheckpoint).where(ownsClaim);
      log("not needed", assessment);
      return { status: "not_needed" };
    }
    const { cutoff } = assessment;
    const matches = await loadEloMatches(source?.cutoff, cutoff);
    if (matches.length !== assessment.deltaRounds) throw new Error("Elo historical interval changed during build");
    const ratings = replayElo(source?.ratings ?? new Map(), matches);
    const roundsProcessed = (source?.roundsProcessed ?? 0) + matches.length;
    const rows = [...ratings].map(([userId, state]) => ({ checkpointId: claim.id, userId, ...state }));

    // Short write transaction, after computation. Fence expired owners before inserting.
    // Publishing all rows and the ready flag together also rolls back partial insert failures.
    await db.transaction(async tx => {
      const owned = await tx.update(eloCheckpoint).set({ cutoffResolvedAt: new Date(cutoff), roundsProcessed })
        .where(and(ownsClaim, sql`${eloCheckpoint.startedAt} >= ${databaseNow} - ${ELO_CHECKPOINT_BUILD_TIMEOUT_MS}`))
        .returning({ id: eloCheckpoint.id });
      if (!owned.length) throw new Error("Elo checkpoint build ownership expired");
      // Four parameters per row: stays below even SQLite's older 999-variable limit.
      for (let i = 0; i < rows.length; i += 200) {
        await tx.insert(eloCheckpointRating).values(rows.slice(i, i + 200));
      }
      await tx.update(eloCheckpoint).set({ status: "ready", readyAt: databaseNow }).where(ownsClaim);

      // One statement selects AND deletes the oldest ready snapshots; other versions survive.
      await tx.run(sql`
        delete from elo_checkpoint where algorithm_version = ${version} and status = 'ready'
        and id not in (
          select id from elo_checkpoint where algorithm_version = ${version} and status = 'ready'
          order by cutoff_resolved_at desc, id desc limit ${ELO_CHECKPOINT_RETENTION}
        )
      `);
    });
    log("ready", {
      checkpointId: claim.id, sourceCheckpointId: source?.id ?? null,
      oldCutoff: source?.cutoff ?? null, newCutoff: cutoff, deltaRounds: matches.length,
      roundsProcessed, players: ratings.size,
    });
    return { status: "built", checkpointId: claim.id, rounds: matches.length };
  } catch (cause) {
    // If storage itself is unavailable, timeout recovery will release the claim later.
    await db.update(eloCheckpoint).set({ status: "failed", failedAt: databaseNow }).where(ownsClaim).catch(() => {});
    log("failed", { checkpointId: claim.id });
    throw cause;
  }
}
