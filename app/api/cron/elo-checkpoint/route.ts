import "server-only";
import { buildEloCheckpointIfNeeded } from "@/lib/elo/checkpoints";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await buildEloCheckpointIfNeeded(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
