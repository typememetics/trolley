"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StandingDefenseForm } from "@/components/player/StandingDefenseForm";
import type { CreateRoundResult } from "@/lib/round/create-round";
import { TrolleyGame, type Matchup } from "./TrolleyGame";

/**
 * A drawn matchup before it becomes a round: the trolley, their defense against yours,
 * and the button that records the round. Judging and the trolley run happen on the
 * round's own page. Mount a fresh one (new `key`) for each draw.
 */
export function PlayableMatchup({ matchup, judge, theirs, defense, children }: {
  matchup: Matchup;
  /** Records a round against the opponent the server drew. Null while there is no opponent. */
  judge: (() => Promise<CreateRoundResult>) | null;
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
  const router = useRouter();

  function onJudge() {
    if (!judge) return;
    setError(null);
    startRound(async () => {
      let created: CreateRoundResult;
      try {
        created = await judge();
      } catch {
        // Network failure or a page left open across a deploy
        return setError("The round could not be started. Try again.");
      }
      if (!created.ok) return setError(created.error);
      router.push(`/round/${created.roundId}`);
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
