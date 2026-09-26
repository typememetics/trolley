import "./leaderboard.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { faceOf } from "@/components/game/face";
import { auth } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard/queries";

export const metadata: Metadata = {
  title: "Leaderboard · The Trolley Problem",
};

const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/** Who survives JEV most often, derived from resolved rounds on every request. */
export default async function LeaderboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const entries = await getLeaderboard();

  return (
    <main className="leaderboard">
      <h1>Leaderboard</h1>
      <p className="auth">Signed in as {session.user.name} <SignOutButton/></p>
      <nav className="leaderboard-nav"><Link href="/">Back to game</Link></nav>

      {entries.length === 0 ? (
        <p className="notice">No one has survived AGI yet.</p>
      ) : (
        <div className="leaderboard-table">
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className="player">Player</th>
                <th scope="col">Survival</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const face = faceOf(entry);
                const you = entry.userId === session.user.id;
                return (
                  <tr key={entry.userId} className={you ? "you" : undefined}>
                    <td>{i + 1}</td>
                    <th scope="row" className="player">
                      <span className="who">
                        <img src={face.src} alt="" width={28} height={28}/>
                        {entry.name}
                        {you && <span className="you-tag">You</span>}
                      </span>
                    </th>
                    <td className="rate">{percent(entry.survivalRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
