import { NextResponse } from "next/server";
import { viewerFrom } from "@/lib/query-limits";
import { allowShare, createShare } from "@/lib/sports/shares";

export const runtime = "nodejs";

type ShareRequest = { answer_id?: string; chart?: unknown };

/** Turn a recent answer into a public page at /magic-stats/s/<id>. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ShareRequest;
  if (typeof body.answer_id !== "string") {
    return NextResponse.json(
      { error: "answer_id is required" },
      { status: 400 },
    );
  }
  const viewer = viewerFrom(request.headers);
  if (!allowShare(viewer.keys[0] ?? "unknown")) {
    return NextResponse.json(
      { error: "That's a lot of sharing. Try again in a bit." },
      { status: 429 },
    );
  }
  const share = await createShare(body.answer_id, body.chart);
  if (!share) {
    return NextResponse.json(
      { error: "That answer has expired. Ask it again, then share." },
      { status: 404 },
    );
  }
  return NextResponse.json({ id: share.id, url: `/magic-stats/s/${share.id}` });
}
