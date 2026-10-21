import { NextResponse } from "next/server";
import { decide, type Situation } from "@/lib/fourth/engine";
import { coachReport } from "@/lib/fourth/coaches";
import { analyzeGame, listGames } from "@/lib/fourth/games";
import { liveGame, liveScoreboard } from "@/lib/fourth/live";
import { parseSituation } from "@/lib/fourth/params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?game=2023_22_SF_KC analyzes every 4th down of a game, ?games=2023 lists a season's games,
 * and anything else is one situation for the calculator.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const game = params.get("game");
    if (game) return NextResponse.json(await analyzeGame(game));
    if (params.has("coaches")) return NextResponse.json(coachReport());
    // live: ?live=1 lists this week's games, ?live=<ESPN event id> grades one game so far
    const live = params.get("live");
    if (live)
      return NextResponse.json(
        live === "1" ? await liveScoreboard() : await liveGame(live),
      );
    const season = params.get("games");
    if (season) return NextResponse.json(await listGames(Number(season)));
    const situation: Situation = parseSituation(params);
    return NextResponse.json(decide(situation));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
