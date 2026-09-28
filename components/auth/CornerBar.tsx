import Link from "next/link";
import { faceOf } from "@/components/game/face";
import { SignOutButton } from "./SignOutButton";

/**
 * Pinned to the page's top right: who's signed in and a way out (when someone is),
 * then the way to the leaderboard, which anyone can open.
 */
export function CornerBar({ user }: { user?: { name: string; image: string | null } }) {
  const face = user && faceOf(user);
  return (
    <div className="corner-bar">
      {user && face && (
        <div className="whoami">
          <img src={face.src} alt="" width={30} height={30}/>
          <span className="whoami-text">
            <small>Signed in as</small>
            <strong>{user.name}</strong>
          </span>
          <SignOutButton compact/>
        </div>
      )}
      <Link className="corner-link" href="/leaderboard">Leaderboard</Link>
    </div>
  );
}
