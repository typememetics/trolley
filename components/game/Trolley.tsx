import type { RefObject } from "react";

export interface TrolleyRefs {
  trolley: RefObject<SVGSVGElement | null>;
  blood: RefObject<SVGGElement | null>;
  gore: RefObject<SVGGElement | null>;
}

// Blood painted onto the trolley is masked to the outline of trolley.png (1254 × 1254).
export function Trolley({ nodes: { trolley, blood, gore } }: { nodes: TrolleyRefs }) {
  return (
    <svg ref={trolley} className="trolley" viewBox="0 0 1254 1254" role="img" aria-label="A trolley heading towards the fork">
      <defs>
        <mask id="trolley-shape" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
          <image href="/images/trolley.png" width="1254" height="1254"/>
        </mask>
      </defs>
      <image href="/images/trolley.png" width="1254" height="1254"/>
      <g ref={blood} className="trolley-blood" mask="url(#trolley-shape)">
        <use href="#splatter" transform="translate(830 560) scale(0.5)"/>
        <use href="#splatter" transform="translate(900 800) scale(0.4) rotate(12)"/>
        <use href="#splatter" transform="translate(230 650) scale(0.6) rotate(-8)"/>
        <use href="#splatter" transform="translate(520 520) scale(0.55) rotate(20)"/>
        <use href="#splatter" transform="translate(860 380) scale(0.45) rotate(-15)"/>
        {/* soaked bottom edge along the front and side */}
        <path d="M120 790 L420 900 L700 1000 L900 1060 L1180 960" fill="none" stroke="#8E2424" strokeWidth="120" strokeLinejoin="round"/>
        <g ref={gore} className="gore"/>
      </g>
    </svg>
  );
}
