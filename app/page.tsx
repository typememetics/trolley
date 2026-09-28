import { headers } from "next/headers";
import { CornerBar } from "@/components/auth/CornerBar";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { PlayableMatchup } from "@/components/game/PlayableMatchup";
import { TrolleyGame, type Matchup } from "@/components/game/TrolleyGame";
import { OpponentDefense } from "@/components/player/OpponentDefense";
import { auth } from "@/lib/auth";
import { getArchenemies, getPlayerStanding } from "@/lib/leaderboard/queries";
import { findRandomOpponent, toOpponentView } from "@/lib/player/opponent";
import { getStandingDefense } from "@/lib/player/profile";
import { createRound, resolveRound } from "@/lib/round/actions";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return (
      <>
        <CornerBar/>
        <TrolleyGame/>
        <section className="cta">
          <h2>Your name isn&apos;t on the tracks. Yet.</h2>
          <p>
            A runaway trolley. An AI with its hand on the lever. Two developers, one paragraph
            each, explaining why they deserve to live. Sign in and make your case before
            someone else makes theirs.
          </p>
          <GitHubSignInButton/>
          <p className="cta-fineprint">
            No developers were harmed in the making of this game. Several were flattened.
          </p>
        </section>
      </>
    );
  }

  // Everyone signed in gets an opponent. Your own defense only decides whether others can draw you.
  const [defense, found, archenemies, standing] = await Promise.all([
    getStandingDefense(session.user.id),
    findRandomOpponent(session.user.id),
    // Only decides whether the draw gets a splash; never worth failing the page over
    getArchenemies(session.user.id).catch(() => {
      console.error("Archenemies unavailable");
      return [];
    }),
    // Only feeds the share link; without it the link just isn't offered
    getPlayerStanding(session.user.id).catch(() => {
      console.error("Player standing unavailable");
      return null;
    }),
  ]);
  // The opponent's defense is part of the visible matchup; their ids stay on the server.
  const opponent = found && toOpponentView(found);
  const matchup: Matchup = {
    player: { name: session.user.name, image: session.user.image ?? null },
    opponent: opponent && { name: opponent.name, image: opponent.image },
  };

  // Where the draw ranks among the players who've beaten this one most, if at all
  const rank = found ? archenemies.findIndex(enemy => enemy.userId === found.userId) : -1;
  const rivalry = rank < 0 ? null : { rank: rank + 1, losses: archenemies[rank].losses, wins: archenemies[rank].wins };

  let judge = null;
  if (found) {
    const opponentId = found.userId;
    // Bound to the opponent drawn above. Next encrypts the captured id, so the browser
    // can neither read it nor swap in someone else, and it sends nothing else.
    // Only records the round; JEV is asked through `resolve` once it exists.
    judge = async () => {
      "use server";
      return createRound(opponentId);
    };
  }

  // The browser names the round it just created; the session still decides whether it's theirs
  const resolve = async (roundId: string) => {
    "use server";
    return resolveRound(roundId);
  };

  return (
    <>
      <CornerBar user={matchup.player} standing={standing}/>
      {/* A new key per render: drawing the next opponent starts a fresh matchup */}
      <PlayableMatchup
        key={crypto.randomUUID()}
        matchup={matchup}
        rivalry={rivalry}
        judge={judge}
        resolve={resolve}
        defense={defense}
        theirs={opponent
          ? <OpponentDefense opponent={opponent}/>
          : <p className="notice">No other developer has entered the trolley yet.</p>}
      />
    </>
  );
}
