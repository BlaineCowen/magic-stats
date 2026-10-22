import { NextResponse } from "next/server";
import { pickemUser } from "@/lib/pickem/auth";
import { createPool, poolsFor } from "@/lib/pickem/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a pool; the creator is its first member. */
export async function POST(request: Request) {
  const user = pickemUser(request.headers);
  if (!user)
    return NextResponse.json(
      { error: "Sign in to start a pool." },
      { status: 401 },
    );
  if ((await poolsFor(user)).length >= 10) {
    return NextResponse.json(
      { error: "That's 10 pools already." },
      { status: 400 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    hidePicks?: boolean;
  };
  const pool = await createPool(
    user,
    String(body.name ?? ""),
    body.hidePicks !== false,
  );
  return NextResponse.json({ pool });
}
