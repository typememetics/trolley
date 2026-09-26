// Randomised SVG gore, generated imperatively on impact. Browser-only (DOM), no React.
import { RAILS_END_X, sample } from "./paths";
import type { TrackPath, VictimElements } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
export const BLOOD_REDS = ["#A52F2F", "#8E2424", "#6E1717", "#B83A3A"];
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

// Restarts a CSS animation class on an element.
export function replay(el: Element, cls: string) {
  el.classList.remove(cls);
  void el.getBoundingClientRect();
  el.classList.add(cls);
}

// Areas of the trolley (in trolley.png pixels) that take the hit: the front face and the lower side.
function goreSpot() {
  return Math.random() < 0.6
    ? { x: rand(880, 1190), y: rand(520, 1050) }
    : { x: rand(110, 900), y: rand(560, 1010) };
}

// Covers the trolley in random blobs and running drips.
export function bloodyTrolley(trolleyBlood: SVGGElement, gore: SVGGElement) {
  gore.replaceChildren();
  for (let i = 0; i < 130; i++) {
    const { x, y } = goreSpot();
    gore.append(svgEl("ellipse", {
      cx: x, cy: y, rx: rand(8, 60), ry: rand(6, 40),
      transform: `rotate(${rand(-40, 40)} ${x} ${y})`,
      fill: BLOOD_REDS[i % BLOOD_REDS.length], opacity: rand(0.7, 1),
    }));
  }
  for (let i = 0; i < 50; i++) {
    const { x, y } = goreSpot();
    const drip = svgEl("path", {
      class: "drip", pathLength: 1,
      d: `M${x} ${y} q${rand(-6, 6)} ${rand(40, 90)} ${rand(-4, 4)} ${rand(60, 200)}`,
      stroke: BLOOD_REDS[i % BLOOD_REDS.length], "stroke-width": rand(10, 26),
    });
    drip.style.animationDelay = rand(0, 0.8) + "s";
    gore.append(drip);
  }
  trolleyBlood.classList.add("on");
}

export function cleanTrolley(trolleyBlood: SVGGElement, gore: SVGGElement) {
  trolleyBlood.classList.remove("on");
  gore.replaceChildren();
}

// Covers the viewport in splatter and specks, and shakes the scene.
export function goreScreen(screenGore: SVGSVGElement, shakeTarget: Element) {
  const { width: W, height: H } = screenGore.getBoundingClientRect(), k = Math.max(W, H) / 1200;
  screenGore.setAttribute("viewBox", `0 0 ${W} ${H}`);
  screenGore.replaceChildren(svgEl("rect", { class: "flash", x: -W, y: -H, width: 3 * W, height: 3 * H, fill: "#8B0000" }));

  for (let i = 0; i < 6; i++) {
    const scale = rand(0.35, 0.95) * k, x = rand(-0.1, 0.9) * W, y = rand(-0.1, 0.7) * H;
    const g = svgEl("g", { transform: `translate(${x} ${y}) rotate(${rand(-180, 180)}) scale(${scale})` });
    const splat = svgEl("use", { href: "#splatter", class: "slam" });
    splat.style.animationDelay = rand(0, 0.15) + "s";
    if (i % 2) splat.style.filter = "brightness(0.65)";   // darker, clotted layers
    g.append(splat);
    screenGore.append(g);
  }
  for (let i = 0; i < 70; i++) {
    const r = rand(3, 26) * k, x = rand(0, W), y = rand(0, H);
    const speck = svgEl("ellipse", {
      class: "slam", cx: x, cy: y, rx: r, ry: r * rand(0.5, 1),
      fill: BLOOD_REDS[i % BLOOD_REDS.length], opacity: rand(0.75, 1),
    });
    speck.style.animationDelay = rand(0, 0.2) + "s";
    screenGore.append(speck);
  }
  replay(screenGore, "on");
  replay(shakeTarget, "shake");
}

export function clearScreenGore(screenGore: SVGSVGElement, shakeTarget: Element) {
  screenGore.classList.remove("on");
  screenGore.replaceChildren();
  shakeTarget.classList.remove("shake");
}

// Pops the splash toward the viewer, then lets it drip and fade (SMIL from the CodePen).
export function splashBlood(splash: SVGSVGElement, animations: SVGAnimationElement[]) {
  replay(splash, "thrown");   // restart the CSS pop if it's already applied
  animations.forEach(a => a.beginElement());
}

export function clearSplash(splash: SVGSVGElement, animations: SVGAnimationElement[]) {
  splash.classList.remove("thrown");
  animations.forEach(a => a.endElement());
}

// The body in dead2.png runs from the feet (330, 860) up to the head (1000, 480).
function bodySpot(spread: number) {
  const t = Math.random(), off = (Math.random() - 0.5) * spread;
  return { x: 330 + 670 * t + off * 0.49, y: 860 - 380 * t + off * 0.87 };
}

export function bloodyBody({ pool, gore }: VictimElements) {
  pool.replaceChildren();
  gore.replaceChildren();
  // pool on the ground, lying along the body
  for (let i = 0; i < 9; i++) {
    const { x, y } = bodySpot(360);
    // the rotation lives on a wrapper so the CSS spread animation (a transform) can't override it
    const tilt = svgEl("g", { transform: `rotate(-30 ${x} ${y + 40})` });
    const el = svgEl("ellipse", {
      cx: x, cy: y + 40, rx: rand(160, 300), ry: rand(70, 130),
      fill: BLOOD_REDS[1 + i % 3], opacity: 0.85,
    });
    el.style.animationDelay = rand(0, 0.4) + "s";
    tilt.append(el);
    pool.append(tilt);
  }
  gore.append(svgEl("use", { href: "#splatter", transform: "translate(430 420) scale(0.65) rotate(-20)" }));
  for (let i = 0; i < 80; i++) {
    const { x, y } = bodySpot(220);
    gore.append(svgEl("ellipse", {
      cx: x, cy: y, rx: rand(8, 45), ry: rand(6, 30),
      transform: `rotate(${rand(-60, 20)} ${x} ${y})`,
      fill: BLOOD_REDS[i % BLOOD_REDS.length], opacity: rand(0.7, 1),
    }));
  }
  for (let i = 0; i < 18; i++) {
    const { x, y } = bodySpot(200);
    const drip = svgEl("path", {
      class: "drip", pathLength: 1,
      d: `M${x} ${y} q${rand(-5, 5)} ${rand(30, 60)} ${rand(-3, 3)} ${rand(50, 130)}`,
      stroke: BLOOD_REDS[i % BLOOD_REDS.length], "stroke-width": rand(8, 18),
    });
    drip.style.animationDelay = rand(0, 0.8) + "s";
    gore.append(drip);
  }
}

// Lays the trail along the track from distance `from` onward, hidden until drawTrail() reveals it.
export function resetTrail(trailPaths: SVGPathElement[], trailDrops: SVGGElement, path: TrackPath, from: number) {
  const pts = path.pts.filter(([x], i) => path.lengths[i] >= from && x <= RAILS_END_X);
  const d = pts.length ? "M" + pts.map(p => p.map(n => n.toFixed(1)).join(" ")).join("L") : "";
  trailPaths.forEach(el => {
    el.setAttribute("d", d);
    el.style.strokeDasharray = el.style.strokeDashoffset = String(path.total);
  });
  trailDrops.replaceChildren();
}

export function clearTrail(trailPaths: SVGPathElement[], trailDrops: SVGGElement) {
  trailPaths.forEach(el => {
    el.removeAttribute("d");
    el.style.strokeDasharray = el.style.strokeDashoffset = "";
  });
  trailDrops.replaceChildren();
}

// Reveals `length` of the trail and scatters drops along the newly bloodied stretch.
export function drawTrail(trailPaths: SVGPathElement[], trailDrops: SVGGElement, path: TrackPath, from: number, length: number) {
  trailPaths.forEach(el => el.style.strokeDashoffset = String(path.total - length));
  const dropsWanted = Math.floor(length / 22);
  for (let n = trailDrops.childElementCount; n < dropsWanted; n++) {
    const { x, y } = sample(path, from + n * 22 + Math.random() * 22);
    if (x > RAILS_END_X) break;
    trailDrops.append(svgEl("circle", {
      cx: x + (Math.random() - 0.5) * 70,
      cy: y + (Math.random() - 0.5) * 50,
      r: 3 + Math.random() * 9,
    }));
  }
}
