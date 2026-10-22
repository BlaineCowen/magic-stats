import { NextResponse } from "next/server";
import { pickemUser } from "@/lib/pickem/auth";
import { poolWeek } from "@/lib/pickem/pool";
import { getEntry, leavePool, listPools } from "@/lib/pickem/store";
import { getWeek, startedIds } from "@/lib/pickem/week-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The pool's week: leaderboard, live chances to win, and pick counts. */
export async function GET(request: Request, ctx: Ctx) {
  const user = pickemUser(request.headers);
  if (!user)
    return NextResponse.json(
      { error: "Sign in to see your pool." },
      { status: 401 },
    );
  const { id } = await ctx.params;
  const pool = (await listPools()).find((p) => p.id === id);
  if (!pool?.members.includes(user)) {
    return NextResponse.json(
      { error: "You're not in that pool." },
      { status: 404 },
    );
  }
  const q = new URL(request.url).searchParams;
  const season = Number(q.get("season"));
  const week = Number(q.get("week"));
  if (!season || !week)
    return NextResponse.json(
      { error: "season and week are required" },
      { status: 400 },
    );
  const w = await getWeek(season, week);
  const members = await Promise.all(
    pool.members.map(async (m) => ({
      user: m,
      entry: await getEntry(m, season, week),
    })),
  );
  return NextResponse.json({
    pool,
    ...poolWeek(w, members, user, pool.hidePicks, startedIds(w)),
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const user = pickemUser(request.headers);
  if (!user)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  return NextResponse.json({ left: await leavePool(user, id) });
}
