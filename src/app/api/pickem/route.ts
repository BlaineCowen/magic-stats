import { NextResponse } from "next/server";
import { fetchWeek, isActive, type PickemWeek } from "@/lib/pickem/scoreboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One ESPN call per week per window, however many people have the page open:
// 20 seconds while games are on, 5 minutes otherwise.
const cache = new Map<string, { at: number; data: PickemWeek }>();

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const season = Number(p.get("season")) || undefined;
  const week = Number(p.get("week")) || undefined;
  if (week !== undefined && (week < 1 || week > 18)) {
    return NextResponse.json(
      { error: "Week must be 1 to 18" },
      { status: 400 },
    );
  }
  const key = `${season ?? "now"}-${week ?? "now"}`;
  const hit = cache.get(key);
  const ttl = hit && isActive(hit.data) ? 20e3 : 300e3;
  if (hit && Date.now() - hit.at < ttl) return NextResponse.json(hit.data);
  try {
    const data = await fetchWeek(season, week);
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    if (hit) return NextResponse.json(hit.data);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't reach ESPN" },
      { status: 502 },
    );
  }
}
