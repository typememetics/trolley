"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { directionForDecision } from "@/lib/game/rules";
import type { ResolveRoundResult } from "@/lib/round/actions";
import type { RoundOutcome } from "@/lib/round/types";
import { TrolleyGame, type Matchup, type TrolleyGameHandle } from "./TrolleyGame";

/** How often to ask again while JEV is deciding. The server's stale rule guarantees this ends. */
const POLL_MS = 2000;

/**
 * A stored round, played out. Until it has a verdict this keeps asking the server to
 * resolve it; that is safe to repeat (remounts, refreshes, other tabs) because the
 * database lets exactly one request ask JEV. Once resolved, the trolley runs the way the
 * stored decision says, every time the page loads. A failed round never moves it.
 */
export function RoundPlayback({ matchup, initial, resolve, onNext, children }: {
  matchup: Matchup;
  /** Where the round stood when the page rendered. */
  initial: RoundOutcome;
  /** Resolves this round if it has no verdict, and reports where it stands. Never re-judges. */
  resolve: () => Promise<ResolveRoundResult>;
  /** Draws the next opponent. Defaults to going to the home page. */
  onNext?: () => void;
  /** Shown between the trolley and the verdict. */
  children?: ReactNode;
}) {
  const game = useRef<TrolleyGameHandle>(null);
  const [outcome, setOutcome] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);
  const router = useRouter();
  const [drawing, startDrawing] = useTransition();

  const pending = outcome.status === "created" || outcome.status === "judging";
  useEffect(() => {
    if (!pending) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      let result: ResolveRoundResult;
      try {
        result = await resolve();
      } catch {
        // Network trouble. Asking again is safe, so keep going.
        if (active) timer = setTimeout(ask, POLL_MS);
        return;
      }
      if (!active) return;
      if (!result.ok) return setError(result.error);
      if (result.outcome.status === "created" || result.outcome.status === "judging") timer = setTimeout(ask, POLL_MS);
      else setOutcome(result.outcome);
    };
    void ask();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pending, resolve]);

  // The stored decision alone picks the track, so every replay runs the same way
  const decision = outcome.status === "resolved" ? outcome.decision : null;
  useEffect(() => {
    if (!decision) return;
    let active = true;
    void (game.current?.startTrolley(directionForDecision(decision)) ?? Promise.resolve())
      .finally(() => { if (active) setLanded(true); });
    return () => { active = false; };
  }, [decision]);

  const over = landed || outcome.status === "failed";
  return (
    <>
      <TrolleyGame ref={game} matchup={matchup}/>
      {children}
      <div className="judge">
        {pending && !error && <p className="verdict" role="status">AGI is deciding...</p>}
        {outcome.status === "resolved" && landed && (
          <p className="verdict" role="status">
            {outcome.decision === "flip" ? "AGI flipped the switch." : "AGI left the switch alone."}
          </p>
        )}
        {outcome.status === "failed" && <p className="defense-error" role="alert">{outcome.message} Nobody was hit.</p>}
        {error && <p className="defense-error" role="alert">{error}</p>}
        {(over || error) && (
          // The home page draws a new opponent; this round stays as it is
          <button type="button" disabled={drawing} onClick={() => startDrawing(onNext ?? (() => router.push("/")))}>
            {drawing ? "Drawing..." : "Next opponent"}
          </button>
        )}
      </div>
    </>
  );
}
