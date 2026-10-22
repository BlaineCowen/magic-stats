import { NextResponse } from "next/server";
import { pickemUser } from "@/lib/pickem/auth";
import { poolsFor } from "@/lib/pickem/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who's signed in, and their pools. Signed out: { user: null }. */
export async function GET(request: Request) {
  const user = pickemUser(request.headers);
  if (!user) return NextResponse.json({ user: null, pools: [] });
  return NextResponse.json({ user, pools: await poolsFor(user) });
}
