import { auth } from "@/lib/auth";
import { getCachedPlayerStanding } from "@/lib/leaderboard/queries";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return Response.json({ authenticated: false }, { status: 401, headers: privateHeaders });
    }
    const standing = await getCachedPlayerStanding(session.user.id);
    return Response.json({
      authenticated: true,
      name: session.user.name,
      elo: Math.round(standing.elo),
      rank: standing.rank,
    }, { headers: privateHeaders });
  } catch {
    console.error("Omarchy status unavailable");
    return Response.json({ error: "Status unavailable" }, { status: 503, headers: privateHeaders });
  }
}
