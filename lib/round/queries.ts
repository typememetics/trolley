import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { round, user } from "@/lib/db/schema";
import type { JevDecision } from "@/lib/jev/evaluate-round";
import type { GameRound, JudgingRound, RoundFailureCode } from "./types";

/**
 * How long a round may sit in `judging` before it is written off as `judging_timeout`.
 * Longer than the JEV budget in resolve-round.ts, so a live call always finishes
 * (or gives up) before its round can expire underneath it.
 */
export const JUDGING_TIMEOUT_MS = 2 * 60_000;

type RoundRow = typeof round.$inferSelect;

/** Every timestamp comes from the database's clock, so staleness never depends on which server asks. */
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** A stored round that breaks its own status's invariants. Never turned into a trolley direction. */
export class MalformedRoundError extends Error {
  name = "MalformedRoundError";
  constructor(id: string, problem: string) {
    super(`Round ${id} is malformed: ${problem}`);
  }
}

/** The only way a row becomes a GameRound: each status gets exactly its fields, or this throws. */
export function toGameRound(row: RoundRow): GameRound {
  const present = <T>(value: T | null, field: string): T => {
    if (value === null) throw new MalformedRoundError(row.id, `${row.status} round has no ${field}`);
    return value;
  };
  const inputs = {
    id: row.id,
    playerUserId: row.playerUserId,
    opponentUserId: row.opponentUserId,
    playerArgumentSnapshot: row.playerArgumentSnapshot,
    opponentDefenseSnapshot: row.opponentDefenseSnapshot,
    createdAt: row.createdAt,
  };
  const status: string = row.status;
  switch (row.status) {
    case "created":
      return { ...inputs, status: row.status };
    case "judging":
      return { ...inputs, status: row.status, judgingAt: present(row.judgingAt, "judgingAt") };
    case "resolved": {
      const decision = present(row.decision, "decision");
      if (decision !== "flip" && decision !== "dont_flip") {
        throw new MalformedRoundError(row.id, `unknown decision ${String(decision)}`);
      }
      return {
        ...inputs,
        status: row.status,
        judgingAt: present(row.judgingAt, "judgingAt"),
        resolvedAt: present(row.resolvedAt, "resolvedAt"),
        decision,
        probabilityFlip: present(row.probabilityFlip, "probabilityFlip"),
        probabilityDontFlip: present(row.probabilityDontFlip, "probabilityDontFlip"),
        confidence: present(row.confidence, "confidence"),
        model: present(row.model, "model"),
      };
    }
    case "failed":
      return {
        ...inputs,
        status: row.status,
        judgingAt: present(row.judgingAt, "judgingAt"),
        failedAt: present(row.failedAt, "failedAt"),
        failureCode: present(row.failureCode, "failureCode"),
      };
    default:
      throw new MalformedRoundError(row.id, `unknown status ${status}`);
  }
}

const first = (rows: RoundRow[]) => (rows[0] ? toGameRound(rows[0]) : null);

export async function findRound(id: string): Promise<GameRound | null> {
  return first(await db.select().from(round).where(eq(round.id, id)));
}

/** A new round in `created`. Its inputs are final from here on. */
export async function insertRound(inputs: {
  playerUserId: string;
  opponentUserId: string;
  playerArgumentSnapshot: string;
  opponentDefenseSnapshot: string;
}): Promise<GameRound> {
  const [row] = await db.insert(round).values(inputs).returning();
  return toGameRound(row);
}

/**
 * created → judging, atomically. Returns the round only to the one caller whose update
 * matched; everyone else gets null. That caller, and only that caller, may ask JEV.
 */
export async function claimRound(id: string): Promise<JudgingRound | null> {
  const claimed = first(await db
    .update(round)
    .set({ status: "judging", judgingAt: now })
    .where(and(eq(round.id, id), eq(round.status, "created")))
    .returning());
  if (claimed && claimed.status !== "judging") throw new MalformedRoundError(id, "claim did not produce a judging round");
  return claimed;
}

/** judging → resolved with JEV's answer as returned. Null if the round is no longer judging. */
export async function completeRound(id: string, ruling: JevDecision): Promise<GameRound | null> {
  return first(await db
    .update(round)
    .set({
      status: "resolved",
      decision: ruling.decision,
      probabilityFlip: ruling.probabilities.flip,
      probabilityDontFlip: ruling.probabilities.dont_flip,
      confidence: ruling.confidence,
      model: ruling.model,
      resolvedAt: now,
    })
    .where(and(eq(round.id, id), eq(round.status, "judging")))
    .returning());
}

/** judging → failed. Null if the round is no longer judging. */
export async function failRound(id: string, failureCode: RoundFailureCode): Promise<GameRound | null> {
  return first(await db
    .update(round)
    .set({ status: "failed", failureCode, failedAt: now })
    .where(and(eq(round.id, id), eq(round.status, "judging")))
    .returning());
}

/**
 * judging → failed(judging_timeout) once the claim is older than JUDGING_TIMEOUT_MS: the
 * request that claimed it died or lost its result. Never re-asks JEV, which may have
 * answered a request nobody recorded; the player draws a new round instead.
 */
export async function expireStaleRound(id: string): Promise<GameRound | null> {
  return first(await db
    .update(round)
    .set({ status: "failed", failureCode: "judging_timeout", failedAt: now })
    .where(and(
      eq(round.id, id),
      eq(round.status, "judging"),
      lt(round.judgingAt, sql`${now} - ${JUDGING_TIMEOUT_MS}`),
    ))
    .returning());
}

/**
 * The round if `playerUserId` is the player who created it, with a stale claim written
 * off first. Null for missing rounds and other people's alike, so ids reveal nothing.
 */
export async function findPlayerRound(id: string, playerUserId: string): Promise<GameRound | null> {
  const found = await findRound(id);
  if (!found || found.playerUserId !== playerUserId) return null;
  if (found.status !== "judging") return found;
  return (await expireStaleRound(id)) ?? (await findRound(id));
}

/** Name and avatar of both sides, as they are now. Identity isn't snapshotted; arguments are. */
export async function findRoundPlayers({ playerUserId, opponentUserId }: GameRound) {
  const rows = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, [playerUserId, opponentUserId]));
  const identity = (id: string) => {
    const found = rows.find(row => row.id === id);
    // Rounds cascade with their users, so both exist unless one was deleted mid-request
    return found ? { name: found.name, image: found.image } : { name: "A former player", image: null };
  };
  return { player: identity(playerUserId), opponent: identity(opponentUserId) };
}
