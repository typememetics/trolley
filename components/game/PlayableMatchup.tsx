"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StandingDefenseForm } from "@/components/player/StandingDefenseForm";
import type { ResolveRoundResult } from "@/lib/round/actions";
import type { CreateRoundResult } from "@/lib/round/create-round";
import { ArchenemySplash, type Rivalry } from "./ArchenemySplash";
import { RoundPlayback } from "./RoundPlayback";
import { TrolleyGame, type Matchup } from "./TrolleyGame";

/** The round this matchup became, once Judge has recorded it. */
interface StartedRound {
  id: string;
  playerArgument: string;
}

/**
 * A drawn matchup and, once Judge records it, its round played out in place: the trolley,
 * their defense against yours, and the verdict. Mount a fresh one (new `key`) for each draw.
 */
export function PlayableMatchup({ matchup, rivalry = null, judge, resolve, theirs, defense, children }: {
  matchup: Matchup;
  /** Set when the drawn opponent is one of the player's archenemies: the matchup opens with a splash. */
  rivalry?: Rivalry | null;
  /** Records a round against the opponent the server drew. Null while there is no opponent. */
  judge: (() => Promise<CreateRoundResult>) | null;
  /** Resolves one of the player's rounds if it has no verdict, and reports where it stands. */
  resolve: (roundId: string) => Promise<ResolveRoundResult>;
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
  const [round, setRound] = useState<StartedRound | null>(null);
  const [starting, startRound] = useTransition();
  const router = useRouter();
  // Once per draw: a fresh key remounts this component, and with it the splash
  const [splash, setSplash] = useState<Rivalry | null>(matchup.opponent ? rivalry : null);
  const dismissSplash = useCallback(() => setSplash(null), []);

  // Stable per round, so the playback's polling effect doesn't restart on every render
  const resolveThis = useMemo(() => round && (() => resolve(round.id)), [round, resolve]);

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
      setRound({ id: created.roundId, playerArgument: created.playerArgument });
    });
  }

  const splashScreen = splash && (
    <ArchenemySplash
      player={matchup.player}
      enemy={matchup.opponent ?? { name: "Your Nemesis", image: null }}
      rivalry={splash}
      onDone={dismissSplash}
    />
  );

  if (round && resolveThis) {
    return (
      // Refreshing re-renders the home page, which draws a new opponent and a new key
      <RoundPlayback matchup={matchup} initial={{ status: "created" }} resolve={resolveThis} onNext={() => router.refresh()}>
        {children}
        <div className="matchup">
          {theirs}
          <section className="defense">
            <h2>Your defense</h2>
            <p className="defense-who">As you wrote it for this round</p>
            <blockquote>{round.playerArgument}</blockquote>
          </section>
        </div>
      </RoundPlayback>
    );
  }

  return (
    <>
      {splashScreen}
      <TrolleyGame
        matchup={matchup}
        devControls={
          // Stats are made up when the draw isn't really an archenemy
          <button type="button" onClick={() => setSplash(rivalry ?? { rank: 1, losses: 7, wins: 2 })}>Archenemy splash</button>
        }
      />
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
