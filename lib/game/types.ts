export type TrackDirection = "up" | "down";

/** [x, y] in tracks.png pixel space. */
export type Point = readonly [number, number];

/** A smoothed track: dense polyline plus cumulative distance at each point. */
export interface TrackPath {
  pts: Point[];
  lengths: number[];
  total: number;
}

export interface PathSample {
  x: number;
  y: number;
  angle: number;
}

/** The DOM the engine animates. React renders it; the engine only mutates it. */
export interface VictimElements {
  body: HTMLImageElement;
  blood: SVGSVGElement;
  pool: SVGGElement;
  gore: SVGGElement;
}

export interface SceneElements {
  /** Shaken on impact. */
  figure: HTMLElement;
  trolley: SVGSVGElement;
  trolleyBlood: SVGGElement;
  trolleyGore: SVGGElement;
  trailPaths: SVGPathElement[];
  trailDrops: SVGGElement;
  victims: Record<TrackDirection, VictimElements>;
  splash: SVGSVGElement;
  splashAnimations: SVGAnimationElement[];
  screenGore: SVGSVGElement;
}
