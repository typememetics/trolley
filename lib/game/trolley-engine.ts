// Drives the trolley frame by frame. React renders the scene once; this mutates it
// directly so the animation never goes through React state.
import {
  bloodyBody, bloodyTrolley, clearScreenGore, clearSplash, clearTrail, cleanTrolley,
  drawTrail, goreScreen, resetTrail, splashBlood,
} from "./gore";
import {
  SCENE_WIDTH, TILT, TRACK_DIRECTIONS, TRACK_PATHS, VICTIM_POSITIONS,
  durationFor, easing, sample, trolleyPlacement,
} from "./paths";
import type { SceneElements, TrackDirection, VictimElements } from "./types";

export const ALIVE_SRC = "/images/person-cutout.png";
export const DEAD_SRC = "/images/dead2.png";

// Rattles the phone on impact. The API can't set intensity, only timing: long buzzes with barely any rest
// read as stronger, uneven stutters as angrier. Opponent (up): a slam, a stutter, a long grind.
// You (down): two furious bursts and a longer grind.
const IMPACT_VIBRATION: Record<TrackDirection, number[]> = {
  up: [500, 40, 120, 30, 120, 30, 250, 40, 900],
  down: [400, 30, 90, 25, 90, 25, 400, 30, 90, 25, 90, 25, 1200],
};
// Unsupported on iOS Safari and desktop; browsers also ignore it before the user has touched the page.
const vibrate = (pattern: number | number[]) => navigator.vibrate?.(pattern);

export interface TrolleyEngine {
  /** Drive the trolley from the start to the end of the chosen branch. Resolves when it arrives (or is interrupted). */
  startTrolley(direction: TrackDirection): Promise<void>;
  /** Stop, put everyone back alive, clean the trolley and return it to its starting spot. */
  reset(): void;
  destroy(): void;
}

export function createTrolleyEngine(el: SceneElements): TrolleyEngine {
  new Image().src = DEAD_SRC;   // preload so the swap is instant
  let running: number | null = null;
  let settle: (() => void) | null = null;

  const isDead = (v: VictimElements) => v.body.classList.contains("dead");

  function setDead(victim: VictimElements, dead: boolean) {
    victim.body.src = dead ? DEAD_SRC : ALIVE_SRC;
    victim.body.classList.toggle("dead", dead);
    if (dead) bloodyBody(victim);
    victim.blood.classList.toggle("on", dead);
  }

  function placeTrolley(x: number, y: number, rotateDeg: number) {
    const { left, top } = trolleyPlacement(x, y);
    el.trolley.style.left = left + "%";
    el.trolley.style.top = top + "%";
    el.trolley.style.transform = `rotate(${rotateDeg}deg)`;
  }

  function stop() {
    if (running !== null) cancelAnimationFrame(running);
    running = null;
    settle?.();
    settle = null;
  }

  function startTrolley(direction: TrackDirection) {
    if (!TRACK_DIRECTIONS.includes(direction)) throw new Error(`direction must be "up" or "down", got "${direction}"`);
    stop();

    const path = TRACK_PATHS[direction];
    const startAngle = sample(path, 0).angle;
    const ease = easing(direction);
    const duration = durationFor(direction);

    TRACK_DIRECTIONS.forEach(d => setDead(el.victims[d], false));
    cleanTrolley(el.trolleyBlood, el.trolleyGore);
    const victim = el.victims[direction];
    const victimX = VICTIM_POSITIONS[direction].left / 100 * SCENE_WIDTH;
    // the trail starts just behind the person's body
    const trailFrom = path.lengths[path.pts.findIndex(([x]) => x >= victimX - 90)];
    resetTrail(el.trailPaths, el.trailDrops, path, trailFrom);

    return new Promise<void>(resolve => {
      settle = resolve;
      const t0 = performance.now();
      const frame = (now: number) => {
        const t = Math.min((now - t0) / duration, 1);
        const dist = ease(t) * path.total;
        const p = sample(path, dist);
        placeTrolley(p.x, p.y, (p.angle - startAngle) * TILT * 180 / Math.PI);
        // the trolley's front is well ahead of its wheel point, so it covers the person here
        if (p.x >= victimX - 40 && !isDead(victim)) {
          setDead(victim, true);
          vibrate(IMPACT_VIBRATION[direction]);
          splashBlood(el.splash, el.splashAnimations);
          goreScreen(el.screenGore, el.figure);
          bloodyTrolley(el.trolleyBlood, el.trolleyGore);
        }
        if (isDead(victim)) drawTrail(el.trailPaths, el.trailDrops, path, trailFrom, dist - trailFrom);
        if (t < 1) running = requestAnimationFrame(frame);
        else { running = null; settle = null; resolve(); }
      };
      running = requestAnimationFrame(frame);
    });
  }

  function reset() {
    stop();
    vibrate(0);   // cut off a rattle that's still going
    TRACK_DIRECTIONS.forEach(d => {
      const victim = el.victims[d];
      setDead(victim, false);
      victim.pool.replaceChildren();
      victim.gore.replaceChildren();
    });
    cleanTrolley(el.trolleyBlood, el.trolleyGore);
    clearTrail(el.trailPaths, el.trailDrops);
    clearSplash(el.splash, el.splashAnimations);
    clearScreenGore(el.screenGore, el.figure);
    // hand the trolley back to its resting CSS position
    el.trolley.style.left = el.trolley.style.top = el.trolley.style.transform = "";
  }

  return { startTrolley, reset, destroy: stop };
}
