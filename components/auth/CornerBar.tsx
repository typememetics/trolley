import Link from "next/link";
import { faceOf } from "@/components/game/face";
import { ShareOnXLink, type Standing } from "@/components/ui/ShareOnXLink";
import { SignOutButton } from "./SignOutButton";

/**
 * Pinned to the page's top right: who's signed in and a way out (when someone is),
 * a way to brag about their Elo (when it could be read), then the way to the leaderboard,
 * which anyone can open.
 */
export function CornerBar({ user, standing }: {
  user?: { name: string; image: string | null };
  standing?: Standing | null;
}) {
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
      {user && standing && <ShareOnXLink standing={standing} className="corner-link corner-share" compact/>}
      <Link className="corner-link" href="/leaderboard">Leaderboard</Link>
    </div>
  );
}
