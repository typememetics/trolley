import { headers } from "next/headers";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { PlayableMatchup } from "@/components/game/PlayableMatchup";
import { TrolleyGame, type Matchup } from "@/components/game/TrolleyGame";
import { OpponentDefense } from "@/components/player/OpponentDefense";
import { auth } from "@/lib/auth";
import { findRandomOpponent, toOpponentView } from "@/lib/player/opponent";
import { getStandingDefense } from "@/lib/player/profile";
import { createRound } from "@/lib/round/actions";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return (
      <>
        <TrolleyGame/>
        <p className="auth"><GitHubSignInButton/></p>
      </>
    );
  }

  // Everyone signed in gets an opponent. Your own defense only decides whether others can draw you.
  const [defense, found] = await Promise.all([
    getStandingDefense(session.user.id),
    findRandomOpponent(session.user.id),
  ]);
  // The opponent's defense is part of the visible matchup; their ids stay on the server.
  const opponent = found && toOpponentView(found);
  const matchup: Matchup = {
    player: { name: session.user.name, image: session.user.image ?? null },
    opponent: opponent && { name: opponent.name, image: opponent.image },
  };

  let judge = null;
  if (found) {
    const opponentId = found.userId;
    // Bound to the opponent drawn above. Next encrypts the captured id, so the browser
    // can neither read it nor swap in someone else, and it sends nothing else.
    // Only records the round; JEV is asked on the round's own page, where the browser goes next.
    judge = async () => {
      "use server";
      return createRound(opponentId);
    };
  }

  return (
    // A new key per render: drawing the next opponent starts a fresh matchup
    <PlayableMatchup
      key={crypto.randomUUID()}
      matchup={matchup}
      judge={judge}
      defense={defense}
      theirs={opponent
        ? <OpponentDefense opponent={opponent}/>
        : <p className="notice">No other developer has entered the trolley yet.</p>}
    >
      <p className="auth">
        Signed in as {matchup.player.name} <SignOutButton/> · <Link href="/leaderboard">Leaderboard</Link>
      </p>
    </PlayableMatchup>
  );
}
