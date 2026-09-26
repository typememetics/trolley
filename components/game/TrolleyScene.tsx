import type { RefObject } from "react";
import { SCENE_HEIGHT, SCENE_WIDTH } from "@/lib/game/paths";
import type { TrackDirection } from "@/lib/game/types";
import { faceOf, placeholderAvatar, type Face } from "./face";
import type { Matchup } from "./TrolleyGame";
import { Trolley, type TrolleyRefs } from "./Trolley";
import { Victim, type VictimRefs } from "./Victim";

export interface SceneRefs {
  trolley: TrolleyRefs;
  trailRails: RefObject<SVGPathElement | null>;
  trailSmear: RefObject<SVGPathElement | null>;
  trailDrops: RefObject<SVGGElement | null>;
  victims: Record<TrackDirection, VictimRefs>;
}

const NOBODY: Face = { src: placeholderAvatar("?"), label: "No opponent yet" };

/**
 * The illustration, laid out in the coordinate space of tracks.png (1448 × 1086).
 * Rendered once; everything that moves is driven by the trolley engine.
 */
export function TrolleyScene({ nodes: { trolley, trailRails, trailSmear, trailDrops, victims }, matchup }: {
  nodes: SceneRefs;
  matchup?: Matchup;
}) {
  const viewBox = `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`;
  return (
    <div className="scene">
      <img className="tracks" src="/images/tracks.png" alt="Railway track splitting into two branches"/>
      <svg className="trail trail-rails" viewBox={viewBox} aria-hidden="true"><path ref={trailRails}/></svg>
      <svg className="trail trail-smear" viewBox={viewBox} aria-hidden="true"><path ref={trailSmear}/><g ref={trailDrops} className="drops"/></svg>

      {/* The upper (diverted) branch: the opponent, or a placeholder stand-in until someone is eligible */}
      <Victim
        direction="up"
        nodes={victims.up}
        face={matchup && (matchup.opponent ? faceOf(matchup.opponent) : NOBODY)}
        tag={matchup && (matchup.opponent?.name ?? "Opponent")}
      />

      {/* The lower (main) branch, where the trolley goes unless the lever is pulled: the signed-in player */}
      <Victim direction="down" nodes={victims.down} face={matchup && faceOf(matchup.player)} tag={matchup && "You"}/>

      <Trolley nodes={trolley}/>
      <img className="operator" src="/images/operator.png" alt="A person standing at the lever that switches the tracks"/>
      {/* Whoever is at the lever: SVG, so the label scales with the scene */}
      <svg className="operator-face" viewBox="0 0 100 100" role="img" aria-label="AGI">
        <circle cx="50" cy="50" r="46"/>
        <text x="50" y="50" dy="0.35em">AGI</text>
      </svg>
    </div>
  );
}
