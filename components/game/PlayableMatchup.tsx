"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StandingDefenseForm } from "@/components/player/StandingDefenseForm";
import { directionForDecision } from "@/lib/game/rules";
import type { RoundResult } from "@/lib/jev/play-round";
import { TrolleyGame, type Matchup, type TrolleyGameHandle } from "./TrolleyGame";

/**
 * One round: the trolley, their defense against yours, and the button that hands both
 * to JEV. React orchestrates (ask JEV, then run the trolley once); the engine owns the
 * animation, and the trolley is the only verdict shown. Mount a fresh one (new `key`)
 * for each round.
 */
export function PlayableMatchup({ matchup, play, theirs, defense, children }: {
  matchup: Matchup;
  /** Judges this round against the opponent the server drew; null while there is none. */
  play: (() => Promise<RoundResult>) | null;
  /** The opponent's side, rendered on the server. */
  theirs: ReactNode;
  /** The player's saved standing defense. */
  defense: string | null;
  /** Shown between the trolley and the matchup. */
  children?: ReactNode;
}) {
  const game = useRef<TrolleyGameHandle>(null);
  // A saved defense is showing (not missing, not mid-edit): there is something to judge.
  const [ready, setReady] = useState(defense !== null);
  // Set once JEV has ruled; from then on this round is over, whatever happens next.
  const [decided, setDecided] = useState(false);
  const [landed, setLanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [judging, startJudging] = useTransition();
  const router = useRouter();
  const [drawing, startDrawing] = useTransition();

  async function runRound(): Promise<string | null> {
    if (!play || decided) return null;
    let result: RoundResult;
    try {
      result = await play();
    } catch {
      // Network failure or a page left open across a deploy. No ruling, so no trolley.
      return "JEV could not be reached. Try again.";
    }
    if (!result.ok) return result.error;

    setDecided(true);
    try {
      await game.current?.startTrolley(directionForDecision(result.decision));
    } finally {
      setLanded(true);
    }
    return null;
  }

  return (
    <>
      <TrolleyGame ref={game} matchup={matchup}/>
      {children}
      <div className="matchup">
        {theirs}
        <StandingDefenseForm defense={defense} onReadyChange={setReady}/>
      </div>
      {play && (
        <div className="judge">
          {landed
            // Re-renders the page on the server, which draws a new opponent and remounts this round
            ? <button type="button" disabled={drawing} onClick={() => startDrawing(() => router.refresh())}>
                {drawing ? "Drawing..." : "Next opponent"}
              </button>
            : <button type="button" disabled={!ready || judging || decided} onClick={() => startJudging(async () => setError(await runRound()))}>
                {judging || decided ? "Judging..." : "Judge"}
              </button>}
          {error && <p className="defense-error" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
