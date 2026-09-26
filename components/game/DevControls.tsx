import type { TrolleyGameHandle } from "./TrolleyGame";

/** Phase 0 test harness for both branches. Not part of the game; rendered in development only. */
export function DevControls({ game }: { game: TrolleyGameHandle }) {
  return (
    <div className="dev-controls" aria-label="Development controls">
      <button type="button" onClick={() => game.startTrolley("up")}>Run upper track</button>
      <button type="button" onClick={() => game.startTrolley("down")}>Run lower track</button>
      <button type="button" onClick={() => game.reset()}>Reset</button>
    </div>
  );
}
