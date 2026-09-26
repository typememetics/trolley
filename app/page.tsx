import { headers } from "next/headers";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { TrolleyGame, type Matchup } from "@/components/game/TrolleyGame";
import { OpponentDefense } from "@/components/player/OpponentDefense";
import { StandingDefenseForm } from "@/components/player/StandingDefenseForm";
import { auth } from "@/lib/auth";
import { findRandomOpponent, toOpponentView } from "@/lib/player/opponent";
import { getStandingDefense } from "@/lib/player/profile";

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

  return (
    <>
      <TrolleyGame matchup={matchup}/>
      <p className="auth">Signed in as {matchup.player.name} <SignOutButton/></p>
      <div className="matchup">
        {opponent
          ? <OpponentDefense opponent={opponent}/>
          : <p className="notice">No other developer has entered the trolley yet.</p>}
        <StandingDefenseForm defense={defense}/>
      </div>
    </>
  );
}
