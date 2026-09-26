import { headers } from "next/headers";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { TrolleyGame } from "@/components/game/TrolleyGame";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const player = session ? { name: session.user.name, image: session.user.image ?? null } : undefined;

  return (
    <>
      <TrolleyGame player={player}/>
      <p className="auth">
        {player
          ? <>Signed in as {player.name} <SignOutButton/></>
          : <GitHubSignInButton/>}
      </p>
    </>
  );
}
