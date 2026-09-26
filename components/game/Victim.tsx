import type { RefObject } from "react";
import { VICTIM_POSITIONS } from "@/lib/game/paths";
import { ALIVE_SRC, DEAD_SRC } from "@/lib/game/trolley-engine";
import type { TrackDirection } from "@/lib/game/types";
import { placeholderAvatar, type Face } from "./face";

export interface VictimRefs {
  body: RefObject<HTMLImageElement | null>;
  blood: RefObject<SVGSVGElement | null>;
  pool: RefObject<SVGGElement | null>;
  gore: RefObject<SVGGElement | null>;
}

/** A face that fails to load becomes the placeholder, so the victim never turns anonymous. */
function fallBack(img: HTMLImageElement, label: string) {
  const placeholder = placeholderAvatar(label);
  if (img.getAttribute("src") !== placeholder) img.src = placeholder;
}

/**
 * A person tied to one branch, plus the blood overlay the engine fills in when
 * they're hit. The overlay is clipped to the outline of dead2.png (1536 × 1024).
 */
export function Victim({ direction, nodes: { body, blood, pool, gore }, face, tag }: {
  direction: TrackDirection;
  nodes: VictimRefs;
  /** A picture pasted over the head. It follows the engine's .person.dead swap through CSS alone. */
  face?: Face;
  /** A short caption above the victim saying who they are. */
  tag?: string;
}) {
  const { left, top } = VICTIM_POSITIONS[direction];
  const position = { left: `${left}%`, top: `${top}%` };
  const maskId = `dead-shape-${direction}`;
  return (
    <>
      <img ref={body} className="person" src={ALIVE_SRC} alt="" style={position}/>
      {face && (
        <img
          key={face.src}
          className="victim-avatar"
          src={face.src}
          alt={face.label}
          title={face.label}
          referrerPolicy="no-referrer"
          style={position}
          // an error that fired before hydration is caught by the ref instead of onError
          ref={img => { if (img?.complete && img.naturalWidth === 0) fallBack(img, face.label); }}
          onError={e => fallBack(e.currentTarget, face.label)}
        />
      )}
      {tag && <span className="victim-tag" style={position}>{tag}</span>}
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
