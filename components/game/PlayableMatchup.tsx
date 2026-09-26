"use client";

import { useState, useTransition, type ReactNode } from "react";
import { StandingDefenseForm } from "@/components/player/StandingDefenseForm";
import { TrolleyGame, type Matchup } from "./TrolleyGame";

/**
 * A drawn matchup before it becomes a round: the trolley, their defense against yours,
 * and the button that records the round. Judging and the trolley run happen on the
 * round's own page. Mount a fresh one (new `key`) for each draw.
 */
export function PlayableMatchup({ matchup, judge, theirs, defense, children }: {
  matchup: Matchup;
  /**
   * Records a round against the opponent the server drew and navigates to it, or returns
   * why it couldn't. Null while there is no opponent.
   */
  judge: (() => Promise<string | undefined>) | null;
  /** The opponent's side, rendered on the server. */
  theirs: ReactNode;
  /** The player's saved standing defense. */
  defense: string | null;
  /** Shown between the trolley and the matchup. */
  children?: ReactNode;
}) {
  // A saved defense is showing (not missing, not mid-edit): there is something to judge.
  const [ready, setReady] = useState(defense !== null);
  const [error, setError] = useState<string | null>(null);
  // Stays pending through the navigation to the round, so the button can't record a second one
  const [starting, startRound] = useTransition();

  function onJudge() {
    if (!judge) return;
    setError(null);
    startRound(async () => {
      try {
        const failure = await judge();
        if (failure) setError(failure);
      } catch {
        // Network failure or a page left open across a deploy
        setError("The round could not be started. Try again.");
      }
    });
  }

  return (
    <>
      <TrolleyGame matchup={matchup}/>
      {children}
      <div className="matchup">
        {theirs}
        <StandingDefenseForm defense={defense} onReadyChange={setReady}/>
      </div>
      {judge && (
        <div className="judge">
          <button type="button" disabled={!ready || starting} onClick={onJudge}>
            {starting ? "Judging..." : "Judge"}
          </button>
          {error && <p className="defense-error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
