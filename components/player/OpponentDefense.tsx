import type { OpponentView } from "@/lib/player/opponent";

/** The argument the current player is up against, as the opponent wrote it. */
export function OpponentDefense({ opponent }: { opponent: OpponentView }) {
  return (
    <section className="defense">
      <h2>Their defense</h2>
      <p className="defense-who">{opponent.name}, on the upper track</p>
      <blockquote>{opponent.standingDefense}</blockquote>
    </section>
  );
}
