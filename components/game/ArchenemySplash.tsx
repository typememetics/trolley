"use client";

import "./archenemy-splash.css";
import { useEffect } from "react";
import { faceOf } from "./face";
import type { PlayerIdentity } from "./TrolleyGame";

/** How the drawn opponent ranks among the player's archenemies. No ids: just what the splash says. */
export interface Rivalry {
  /** 1-based place in the player's archenemies. */
  rank: number;
  losses: number;
  wins: number;
}

const HOLD_MS = 4200;

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/** The full-screen "you vs them" announcement when the draw is an archenemy. Click, Escape or wait to dismiss. */
export function ArchenemySplash({ player, enemy, rivalry, onDone }: {
  player: PlayerIdentity;
  enemy: PlayerIdentity;
  rivalry: Rivalry;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, HOLD_MS);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);

  const you = faceOf(player);
  const them = faceOf(enemy);
  return (
    <div className="archenemy-splash" role="alertdialog" aria-label={`Archenemy: ${enemy.name}`} onClick={onDone}>
      {/* Oversized, so the shake never shows the page at the edges; the overlay itself never moves */}
      <div className="archenemy-stage">
        {/* Two halves meeting on a jagged seam; VS sits on the seam */}
        <div className="archenemy-half you" aria-hidden="true"/>
        <div className="archenemy-half seam" aria-hidden="true"/>
        <div className="archenemy-half them" aria-hidden="true"/>
        <div className="archenemy-flash" aria-hidden="true"/>
        <p className="archenemy-kicker">Archenemy</p>
        <div className="archenemy-faceoff">
          <div className="archenemy-side you">
            <img src={you.src} alt=""/>
            <span>{player.name}</span>
          </div>
          <span className="archenemy-vs" aria-hidden="true">VS</span>
          <div className="archenemy-side them">
            <img src={them.src} alt=""/>
            <span>{enemy.name}</span>
          </div>
        </div>
        <p className="archenemy-record">
          They&apos;ve flattened you {times(rivalry.losses)}.{" "}
          {rivalry.wins ? `You've flattened them ${times(rivalry.wins)}.` : "You've never beaten them."}
        </p>
        <button type="button" className="archenemy-go" autoFocus onClick={onDone}>Settle it</button>
      </div>
    </div>
  );
}
