import { NextResponse } from "next/server";
import { getWeek } from "@/lib/pickem/week-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  try {
    return NextResponse.json(await getWeek(season, week));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't reach ESPN" },
      { status: 502 },
    );
  }
}
