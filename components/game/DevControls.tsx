import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { TrolleyGameHandle } from "./TrolleyGame";

/** Phase 0 test harness for both branches. Not part of the game; rendered in development only. */
export function DevControls({ game, children }: { game: TrolleyGameHandle; children?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="dev-controls" aria-label="Development controls">
      <button type="button" onClick={() => game.startTrolley("up")}>Run upper track</button>
      <button type="button" onClick={() => game.startTrolley("down")}>Run lower track</button>
      {/* A new round: revive both victims, then re-render the page on the server to draw a fresh opponent */}
      <button type="button" onClick={() => { game.reset(); router.refresh(); }}>Reset</button>
      {children}
    </div>
  );
}
