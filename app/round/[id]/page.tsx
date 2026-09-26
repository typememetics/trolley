import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { RoundPlayback } from "@/components/game/RoundPlayback";
import { OpponentDefense } from "@/components/player/OpponentDefense";
import { auth } from "@/lib/auth";
import { resolveRound } from "@/lib/round/actions";
import { findPlayerRound, findRoundPlayers } from "@/lib/round/queries";
import { toRoundOutcome } from "@/lib/round/resolve-round";

/**
 * One stored round, visible only to the player who started it. Shows what was judged
 * (the snapshots, not the players' current defenses) and plays the stored verdict.
 * Rendering never calls JEV; the client asks for a verdict only while there is none.
 */
export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, auth.api.getSession({ headers: await headers() })]);
  if (!session) redirect("/");

  const round = await findPlayerRound(id, session.user.id);
  // Someone else's round looks exactly like a missing one
  if (!round) notFound();
  const matchup = await findRoundPlayers(round);

  // Bound to this round; the session decides whose it is, again, on every call
  const resolve = async () => {
    "use server";
    return resolveRound(id);
  };

  return (
    <RoundPlayback key={round.id} matchup={matchup} initial={toRoundOutcome(round)} resolve={resolve}>
      <p className="auth">Signed in as {session.user.name} <SignOutButton/></p>
      <div className="matchup">
        <OpponentDefense opponent={{ ...matchup.opponent, standingDefense: round.opponentDefenseSnapshot }}/>
        <section className="defense">
          <h2>Your defense</h2>
          <p className="defense-who">As you wrote it for this round</p>
          <blockquote>{round.playerArgumentSnapshot}</blockquote>
        </section>
      </div>
    </RoundPlayback>
  );
}
