import { NextResponse } from "next/server";
import { etrValues, marketValues, settingsFrom } from "@/lib/nfl/trade-values";
import { viewerFrom } from "@/lib/query-limits";

export const dynamic = "force-dynamic";

/**
 * GET /api/trade-values?dynasty=1&teams=12&qbs=2&ppr=0.5&tep=0 → market values, best first.
 * ?values=etr returns Blaine's ETR values instead, only when blaine-auth says it's him.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("values") === "etr") {
    if (viewerFrom(req.headers).tier !== "owner") return NextResponse.json({ error: "Not available." }, { status: 403 });
    try {
      const { players, updated } = await etrValues();
      return NextResponse.json({ updated, players }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return NextResponse.json({ error: "Your ETR values aren't there yet. The trade desk refreshes them each morning." }, { status: 503 });
    }
  }
  const settings = settingsFrom(q);
  try {
    const players = await marketValues(settings);
    return NextResponse.json(
      { settings, updated: new Date().toISOString(), players },
      { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } },
    );
  } catch {
    return NextResponse.json({ error: "Couldn't load player values right now. Try again in a minute." }, { status: 502 });
  }
}
