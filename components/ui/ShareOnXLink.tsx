import { XIcon } from "./icons";

const SITE_URL = "https://trolley.typememetics.institute/";

/** What a player brags about: their Elo and, once they've been judged, their place on the board. */
export interface Standing {
  elo: number;
  rank: number | null;
}

/** Opens X's composer with the player's Elo and an invite. `compact` draws the icon alone. */
export function ShareOnXLink({ standing, className = "btn", compact = false }: {
  standing: Standing;
  className?: string;
  compact?: boolean;
}) {
  const place = standing.rank === null ? "" : ` (#${standing.rank} on the leaderboard)`;
  const text = `My Elo in The Trolley Problem is ${Math.round(standing.elo)}${place}. `
    + "It's a stupid game made by @typememetics where an AGI decides who gets flattened. Everyone should play:";
  const href = `https://x.com/intent/post?${new URLSearchParams({ text, url: SITE_URL })}`;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={compact ? "Share your Elo on X" : undefined}
      title="Share your Elo on X"
    >
      <XIcon/>{!compact && " Share on X"}
    </a>
  );
}
