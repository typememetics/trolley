import { headers } from "next/headers";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { TrolleyGame, type PlayerIdentity } from "@/components/game/TrolleyGame";
import { StandingDefenseForm } from "@/components/player/StandingDefenseForm";
import { auth } from "@/lib/auth";
import { findRandomOpponent } from "@/lib/player/opponent";
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

  const player: PlayerIdentity = { name: session.user.name, image: session.user.image ?? null };
  const defense = await getStandingDefense(session.user.id);
  // Only players who've made their case get matched. The opponent's own defense stays
  // on the server: the scene gets a name and a face, nothing more.
  const found = defense ? await findRandomOpponent(session.user.id) : null;
  const opponent: PlayerIdentity | undefined = found ? { name: found.name, image: found.image } : undefined;

  return (
    <>
      <TrolleyGame player={player} opponent={opponent}/>
      {defense && !opponent && <p className="notice">No other developer has entered the trolley yet.</p>}
      <p className="auth">Signed in as {player.name} <SignOutButton/></p>
      <StandingDefenseForm defense={defense}/>
    </>
  );
}
