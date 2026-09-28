# Elo v1

Resolved rounds are competitive history. Elo is a deterministic interpretation of
that history. Checkpoints are disposable caches: deleting every checkpoint loses
no competitive truth. Gameplay never writes Elo; matchmaking reads the latest ready
checkpoint (no tail replay) inside its single opponent query to favour players
rated near you (`lib/player/matchmaking.ts`). With no checkpoint the draw is uniform.

## Rating and replay

`elo-v1-base1500-k32-scale400` starts participants at 1500, uses K=32 and scale=400,
and stores JavaScript numbers without rounding. `flip` awards the active player
a win; `dont_flip` awards the opponent a win. Judge variants have equal weight.
Only resolved rounds count, ordered by `resolved_at ASC, id ASC`.

A ready checkpoint at T contains **only `resolved_at < T`**. Reconstruction adds
**`resolved_at >= T`**. A subsequent checkpoint replays **`oldT <= resolved_at < newT`**.
The cutoff comes from SQLite's millisecond clock minus 60 seconds. No random UUID
is used as a checkpoint cursor. Normal resolution already uses that database
clock. Historical imports/backdating or deletions require invalidating checkpoints
and rebuilding; they must not silently change already-checkpointed history.

`getCurrentEloRatings()` loads the latest ready snapshot for the exact algorithm
version and replays its tail. Without a snapshot it replays all history, warning
at 50,000 rounds. `rebuildEloFromHistory()` always ignores checkpoints and is useful
for diagnostics. Tests compare both paths within 1e-9, including after deleting
all checkpoints. A version change automatically falls back to full reconstruction.
Any change to rating semantics must change the algorithm version too.

## Checkpoints

An hourly authenticated cron checks for 5,000 eligible new rounds, or a ready
checkpoint at least 24 hours old with at least one new eligible round. The first
checkpoint builds whenever eligible history exists. The one-minute safety window
is excluded from eligible counts. At 12,000 games/day this normally gives 2–3
checkpoints/day and roughly 5,000–5,500 rounds in the tail between cron checks.

A partial unique index permits one building row per version. Builds older than
15 minutes become failed. Each builder re-reads the latest ready state after
acquiring its claim, and publication checks that the original claim is still
building and unexpired. Snapshot inserts (200 rows per statement), ready status,
and retention commit in one transaction. A failure rolls back publication and
leaves the previous ready checkpoint usable. Recovery is safe after process death.
The newest three ready checkpoints per version remain; other versions and failed
rows are retained. Failed rows have no rating snapshots after transaction rollback.

Readers load checkpoint metadata and all its ratings in a single SQL statement,
so retention cannot remove a snapshot between those reads. Readers ignore building
and failed checkpoints. Elo reconstruction costs O(players + recent matches),
plus sorting players for the leaderboard. Survival remains a grouped SQL projection
of historical outcomes using the existing covering index; it is not cached as Elo.
The identity/stats query selects Elo candidates, includes all boundary ties, and
sorts raw Elo, game count, canonical name with SQLite NOCASE, then user id.

## Deploy and operate

Use the repository's Nix shell and existing migration workflow:

```sh
nix develop
pnpm install
pnpm db:generate
pnpm db:check
pnpm db:migrate
pnpm elo:checkpoint
```

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for the target environment via
`.env.local`/`.env` or deployment variables. Apply migrations before serving the
new leaderboard. The build itself needs no database credentials. For an empty
history, the builder does nothing; the first game is rated immediately by replay.

`pnpm elo:checkpoint --force` bypasses cadence, **not** the safety window, ownership,
or nonempty-history requirements. It uses the same builder as production. For a
large initial history, run the CLI before enabling regular traffic; it is not
limited by the cron function's 300-second budget, but the 15-minute lease still
applies. Do not delete round history to reset/rebuild a cache.

In Vercel production, configure `CRON_SECRET` (for example, `openssl rand -hex 32`).
Vercel sends `Authorization: Bearer <CRON_SECRET>` to
`GET /api/cron/elo-checkpoint`. Missing or wrong authorization returns 401 without
accessing Elo storage; errors return a small 500 response without internal details.
The endpoint is never called from the browser. `vercel.json` checks hourly in UTC.
The project's Pro plan supports this cadence. See Vercel's
[cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
and [plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Structured server logs report version, result, checkpoint ids, cutoffs, delta and
cumulative round counts, player count, and duration. They exclude arguments,
secrets and sessions. If checkpoint generation stops for six hours, users can
still play and ratings remain correct; the tail simply grows. A leaderboard
reconstruction failure displays an unavailable message with a link back to play.

## Existing retention caveat

Better Auth user deletion currently cascades into historical rounds. Account
deletion is not enabled in the current auth configuration, but administrative or
seed-user deletion has the same cascade. Exact historical reconstruction assumes
those rounds remain present. This change does not redesign account deletion.

If any historical round is deleted (including a user cascade), invalidate **all**
Elo checkpoints and rebuild from the remaining history before trusting cached
ratings. Removing only the deleted user's rating rows is insufficient: their
matches influenced other players. Keep history backups if original competition
history must survive user deletion. Checkpoint deletion alone never deletes rounds.

## Verification

`pnpm test` uses the existing Node test runner and temporary libSQL databases.
It exercises the generated migrations on fresh and pre-Elo databases, immutable
round guards, replay equivalence, boundaries, versions, contention, stale-owner
fencing, failed publication, retention, cron authentication, query plans, and
leaderboard ordering. Existing round/JEV tests continue unchanged.

Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` as well. To validate an actual
deployment, apply the migration to its database, set the cron secret, deploy,
check the authenticated leaderboard and stored-round playback, and inspect the
cron result/logs. A successful local build is not evidence of a remote deployment.
