import type { PathSample, Point, TrackDirection, TrackPath } from "./types";

// Track centre lines in tracks.png pixel space (1448 × 1086).
export const SCENE_WIDTH = 1448;
export const SCENE_HEIGHT = 1086;

export const TRACK_POINTS = {
  up: [[175, 403], [460, 488], [520, 491], [600, 468], [700, 417], [780, 385],
       [850, 374], [1000, 381], [1200, 412], [1410, 447], [1750, 504]],
  down: [[175, 403], [460, 487], [650, 559], [850, 635], [1000, 680],
         [1200, 724], [1270, 739]],
} satisfies Record<TrackDirection, readonly Point[]>;

export const TRACK_DIRECTIONS = ["up", "down"] as const satisfies readonly TrackDirection[];

/** Where each person is tied down, as a percentage of the scene. */
export const VICTIM_POSITIONS = {
  up: { left: 84, top: 38.9 },
  down: { left: 66, top: 61.4 },
} satisfies Record<TrackDirection, { left: number; top: number }>;

// Trolley's resting box (matches the .trolley CSS) and the track point under its wheels.
export const TROLLEY_BOX = { left: 0.01 * SCENE_WIDTH, top: 0.17 * SCENE_HEIGHT };
export const [START_X, START_Y] = TRACK_POINTS.down[0];
export const TILT = 0.5;          // how much the trolley rotates with the track (1 = fully)
export const DURATION = 1800;     // ms for the lower branch; other paths keep the same speed
// Branches whose trolley leaves the frame keep accelerating instead of braking.
export const EXITS_FRAME: Record<TrackDirection, boolean> = { up: true, down: false };
export const RAILS_END_X = 1410;  // where the rails stop in tracks.png

// Smooth the control points with a Catmull-Rom spline into a dense polyline.
export function smooth(points: readonly Point[], steps = 24): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i], p1 = points[i],
          p2 = points[i + 1], p3 = points[i + 2] || p2;
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const at = (k: 0 | 1) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function buildPath(points: readonly Point[]): TrackPath {
  const pts = smooth(points), lengths = [0];
  for (let i = 1; i < pts.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, lengths, total: lengths[lengths.length - 1] };
}

// Position and track angle at distance d along the path.
export function sample({ pts, lengths }: TrackPath, d: number): PathSample {
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i++;
  const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
  const t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: Math.atan2(by - ay, bx - ax) };
}

export const TRACK_PATHS: Record<TrackDirection, TrackPath> = {
  up: buildPath(TRACK_POINTS.up),
  down: buildPath(TRACK_POINTS.down),
};

/** Easing per branch: the one that leaves the frame speeds up and keeps going. */
export function easing(direction: TrackDirection): (t: number) => number {
  return EXITS_FRAME[direction]
    ? t => t * t                       // speed up and keep going
    : t => t * t * (3 - 2 * t);        // gentle start and stop
}

/** Animation length for a branch, keeping the lower branch's speed. */
export function durationFor(direction: TrackDirection): number {
  return DURATION * TRACK_PATHS[direction].total / TRACK_PATHS.down.total;
}

/** Trolley box position (as % of the scene) for a wheel point on the track. */
export function trolleyPlacement(x: number, y: number) {
  return {
    left: (TROLLEY_BOX.left + x - START_X) / SCENE_WIDTH * 100,
    top: (TROLLEY_BOX.top + y - START_Y) / SCENE_HEIGHT * 100,
  };
}
