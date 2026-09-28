import { BlueskyIcon, HackerNewsIcon, LinkedInIcon, XIcon } from "./icons";

const SITE_URL = "https://trolley.typememetics.institute/";

/** What a player brags about: their Elo and, once they've been judged, their place on the board. */
export interface Standing {
  elo: number;
  rank: number | null;
}

/** `handle` is how typememetics is named: an @mention where the network links one. */
function brag({ elo, rank }: Standing, handle: string) {
  const place = rank === null ? "" : ` (#${rank} on the leaderboard)`;
  return `My Elo in The Trolley Problem is ${Math.round(elo)}${place}. `
    + `It's a stupid game made by ${handle} where an AGI decides who gets flattened. Everyone should play:`;
}

/** Icon buttons that open X's, LinkedIn's, Bluesky's or Hacker News' composer with the player's Elo and an invite to play. */
export function ShareLinks({ standing }: { standing: Standing }) {
  const x = `https://x.com/intent/post?${new URLSearchParams({ text: brag(standing, "@typememetics"), url: SITE_URL })}`;
  // Both take the link inside the text, spaces as %20 rather than +
  const withLink = (handle: string) => encodeURIComponent(`${brag(standing, handle)} ${SITE_URL}`);
  // LinkedIn's documented share-offsite link drops any text; its feed composer takes it
  const linkedIn = `https://www.linkedin.com/feed/?shareActive=true&text=${withLink("typememetics")}`;
  // Bluesky allows 300 characters: room for the brag and the link
  const bluesky = `https://bsky.app/intent/compose?text=${withLink("@typememetics")}`;
  // Hacker News takes only a title, capped at 80 characters: the Elo, then what the game is
  const hackerNews = `https://news.ycombinator.com/submitlink?${new URLSearchParams({
    u: SITE_URL,
    t: `My Elo is ${Math.round(standing.elo)} in The Trolley Problem, where AGI decides who gets flattened`,
  })}`;
  return (
    <>
      <a className="btn btn-icon" href={x} target="_blank" rel="noopener noreferrer" aria-label="Share your Elo on X" title="Share your Elo on X">
        <XIcon/>
      </a>
      <a className="btn btn-icon" href={linkedIn} target="_blank" rel="noopener noreferrer" aria-label="Share your Elo on LinkedIn" title="Share your Elo on LinkedIn">
        <LinkedInIcon/>
      </a>
      <a className="btn btn-icon" href={bluesky} target="_blank" rel="noopener noreferrer" aria-label="Share your Elo on Bluesky" title="Share your Elo on Bluesky">
        <BlueskyIcon/>
      </a>
      <a className="btn btn-icon" href={hackerNews} target="_blank" rel="noopener noreferrer" aria-label="Share your Elo on Hacker News" title="Share your Elo on Hacker News">
        <HackerNewsIcon/>
      </a>
    </>
  );
}
