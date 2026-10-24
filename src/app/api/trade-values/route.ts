import { NextResponse } from "next/server";
import { marketValues, settingsFrom } from "@/lib/nfl/trade-values";

export const dynamic = "force-dynamic";

/** GET /api/trade-values?dynasty=1&teams=12&qbs=2&ppr=0.5&tep=0 → players with values, best first. */
export async function GET(req: Request) {
  const settings = settingsFrom(new URL(req.url).searchParams);
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
