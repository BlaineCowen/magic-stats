import { NextResponse } from "next/server";
import { pickemUser } from "@/lib/pickem/auth";
import {
  getEntry,
  mergeEntry,
  putEntry,
  type SavedEntry,
} from "@/lib/pickem/store";
import { getWeek, startedIds } from "@/lib/pickem/week-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const signIn = () =>
  NextResponse.json({ error: "Sign in to save picks." }, { status: 401 });

function weekParams(p: URLSearchParams | Record<string, unknown>) {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : p[k]);
  const season = Number(get("season"));
  const week = Number(get("week"));
  return Number.isInteger(season) &&
    season > 2000 &&
    Number.isInteger(week) &&
    week >= 1 &&
    week <= 18
    ? { season, week }
    : null;
}

export async function GET(request: Request) {
  const user = pickemUser(request.headers);
  if (!user) return signIn();
  const w = weekParams(new URL(request.url).searchParams);
  if (!w)
    return NextResponse.json(
      { error: "season and week are required" },
      { status: 400 },
    );
  return NextResponse.json({ entry: await getEntry(user, w.season, w.week) });
}

export async function PUT(request: Request) {
  const user = pickemUser(request.headers);
  if (!user) return signIn();
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const w = weekParams(body);
  if (!w)
    return NextResponse.json(
      { error: "season and week are required" },
      { status: 400 },
    );
  const week = await getWeek(w.season, w.week);
  const ids = week.games.map((g) => g.id);
  const old = await getEntry(user, w.season, w.week);
  const merged = mergeEntry(
    old,
    {
      picks: (body.picks ?? {}) as SavedEntry["picks"],
      points: (body.points ?? {}) as SavedEntry["points"],
      office: (body.office ?? {}) as SavedEntry["office"],
      pinned: Array.isArray(body.pinned) ? (body.pinned as string[]) : [],
    },
    ids,
    startedIds(week),
  );
  if ("error" in merged)
    return NextResponse.json(
      { error: merged.error, entry: old },
      { status: 409 },
    );
  await putEntry(user, w.season, w.week, merged.entry);
  return NextResponse.json({ entry: merged.entry });
}
