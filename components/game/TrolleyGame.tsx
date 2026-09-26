"use client";

import "./trolley-game.css";
import { createRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref, type RefObject } from "react";
import { createTrolleyEngine, type TrolleyEngine } from "@/lib/game/trolley-engine";
import type { TrackDirection, VictimElements } from "@/lib/game/types";
import { DevControls } from "./DevControls";
import { GoreEffects } from "./GoreEffects";
import { TrolleyScene } from "./TrolleyScene";
import type { VictimRefs } from "./Victim";

/** What the rest of the app can do with the trolley. */
export interface TrolleyGameHandle {
  startTrolley(direction: TrackDirection): Promise<void>;
  reset(): void;
}

/** Who is tied to the upper track. Deliberately not an auth session: just what the scene draws. */
export interface PlayerIdentity {
  name: string;
  image: string | null;
}

interface TrolleyGameProps {
  ref?: Ref<TrolleyGameHandle>;
  player?: PlayerIdentity;
}

const SHOW_DEV_CONTROLS = process.env.NODE_ENV === "development";

const createVictimRefs = (): VictimRefs => ({
  body: createRef<HTMLImageElement>(),
  blood: createRef<SVGSVGElement>(),
  pool: createRef<SVGGElement>(),
  gore: createRef<SVGGElement>(),
});

// Every element the engine drives, created once per mounted game.
const createGameRefs = () => ({
  figure: createRef<HTMLElement>(),
  scene: {
    trolley: { trolley: createRef<SVGSVGElement>(), blood: createRef<SVGGElement>(), gore: createRef<SVGGElement>() },
    trailRails: createRef<SVGPathElement>(),
    trailSmear: createRef<SVGPathElement>(),
    trailDrops: createRef<SVGGElement>(),
    victims: { up: createVictimRefs(), down: createVictimRefs() },
  },
  gore: {
    splash: createRef<SVGSVGElement>(),
    fade: createRef<SVGAnimationElement>(),
    dripA: createRef<SVGAnimationElement>(),
    dripB: createRef<SVGAnimationElement>(),
    screenGore: createRef<SVGSVGElement>(),
  },
});

function must<T>(ref: RefObject<T | null>): T {
  if (!ref.current) throw new Error("Trolley scene element not mounted");
  return ref.current;
}

function victimElements(nodes: VictimRefs): VictimElements {
  return { body: must(nodes.body), blood: must(nodes.blood), pool: must(nodes.pool), gore: must(nodes.gore) };
}

export function TrolleyGame({ ref, player }: TrolleyGameProps) {
  const [{ figure, scene, gore }] = useState(createGameRefs);
  const engine = useRef<TrolleyEngine>(null);

  // React owns the lifecycle; the engine owns every frame after mount.
  useEffect(() => {
    const created = createTrolleyEngine({
      figure: must(figure),
      trolley: must(scene.trolley.trolley),
      trolleyBlood: must(scene.trolley.blood),
      trolleyGore: must(scene.trolley.gore),
      trailPaths: [must(scene.trailRails), must(scene.trailSmear)],
      trailDrops: must(scene.trailDrops),
      victims: { up: victimElements(scene.victims.up), down: victimElements(scene.victims.down) },
      splash: must(gore.splash),
      splashAnimations: [must(gore.fade), must(gore.dripA), must(gore.dripB)],
      screenGore: must(gore.screenGore),
    });
    engine.current = created;
    return () => {
      created.destroy();
      engine.current = null;
    };
  }, [figure, scene, gore]);

  const handle = useMemo<TrolleyGameHandle>(() => ({
    startTrolley: direction => engine.current
      ? engine.current.startTrolley(direction)
      : Promise.reject(new Error("Trolley engine is not ready")),
    reset: () => engine.current?.reset(),
  }), []);
  useImperativeHandle(ref, () => handle, [handle]);

  return (
    <>
      <figure ref={figure}>
        <TrolleyScene nodes={scene} player={player}/>
        <figcaption>Do you pull the lever?</figcaption>
      </figure>
      <GoreEffects nodes={gore}/>
      {SHOW_DEV_CONTROLS && <DevControls game={handle}/>}
    </>
  );
}
