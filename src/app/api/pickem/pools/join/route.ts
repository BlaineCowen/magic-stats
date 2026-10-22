import { NextResponse } from "next/server";
import { pickemUser } from "@/lib/pickem/auth";
import { joinPool } from "@/lib/pickem/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = pickemUser(request.headers);
  if (!user)
    return NextResponse.json(
      { error: "Sign in to join a pool." },
      { status: 401 },
    );
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const pool = await joinPool(user, String(body.code ?? ""));
  if (!pool)
    return NextResponse.json(
      { error: "No pool has that code." },
      { status: 404 },
    );
  return NextResponse.json({ pool });
}
