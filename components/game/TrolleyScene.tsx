import type { RefObject } from "react";
import { SCENE_HEIGHT, SCENE_WIDTH } from "@/lib/game/paths";
import type { TrackDirection } from "@/lib/game/types";
import { Trolley, type TrolleyRefs } from "./Trolley";
import { Victim, type VictimRefs } from "./Victim";

export interface SceneRefs {
  trolley: TrolleyRefs;
  trailRails: RefObject<SVGPathElement | null>;
  trailSmear: RefObject<SVGPathElement | null>;
  trailDrops: RefObject<SVGGElement | null>;
  victims: Record<TrackDirection, VictimRefs>;
}

/**
 * The illustration, laid out in the coordinate space of tracks.png (1448 × 1086).
 * Rendered once; everything that moves is driven by the trolley engine.
 */
export function TrolleyScene({ nodes: { trolley, trailRails, trailSmear, trailDrops, victims } }: { nodes: SceneRefs }) {
  const viewBox = `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`;
  return (
    <div className="scene">
      <img className="tracks" src="/images/tracks.png" alt="Railway track splitting into two branches"/>
      <svg className="trail trail-rails" viewBox={viewBox} aria-hidden="true"><path ref={trailRails}/></svg>
      <svg className="trail trail-smear" viewBox={viewBox} aria-hidden="true"><path ref={trailSmear}/><g ref={trailDrops} className="drops"/></svg>

      {/* One person tied to the upper (diverted) branch */}
      <Victim direction="up" nodes={victims.up}/>

      {/* One person tied to the lower (main) branch */}
      <Victim direction="down" nodes={victims.down}/>

      <Trolley nodes={trolley}/>
      <img className="operator" src="/images/operator.png" alt="A person standing at the lever that switches the tracks"/>
    </div>
  );
}
