import type { RefObject } from "react";
import { VICTIM_POSITIONS } from "@/lib/game/paths";
import { ALIVE_SRC, DEAD_SRC } from "@/lib/game/trolley-engine";
import type { TrackDirection } from "@/lib/game/types";

export interface VictimRefs {
  body: RefObject<HTMLImageElement | null>;
  blood: RefObject<SVGSVGElement | null>;
  pool: RefObject<SVGGElement | null>;
  gore: RefObject<SVGGElement | null>;
}

/**
 * A person tied to one branch, plus the blood overlay the engine fills in when
 * they're hit. The overlay is clipped to the outline of dead2.png (1536 × 1024).
 */
export function Victim({ direction, nodes: { body, blood, pool, gore } }: { direction: TrackDirection; nodes: VictimRefs }) {
  const { left, top } = VICTIM_POSITIONS[direction];
  const position = { left: `${left}%`, top: `${top}%` };
  const maskId = `dead-shape-${direction}`;
  return (
    <>
      <img ref={body} className="person" src={ALIVE_SRC} alt="" style={position}/>
      <svg ref={blood} className="person-blood" viewBox="0 0 1536 1024" aria-hidden="true" style={position}>
        <defs>
          <mask id={maskId} style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024">
            <image href={DEAD_SRC} width="1536" height="1024"/>
          </mask>
        </defs>
        <g ref={pool} className="pool"/>
        <g ref={gore} className="gore" mask={`url(#${maskId})`}/>
      </svg>
    </>
  );
}
