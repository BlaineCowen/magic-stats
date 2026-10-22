import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/lib/sports/db";
import { isSport } from "@/lib/sports/types";

export const runtime = "nodejs";

// Logos are downloaded by scripts/refresh-<sport>-data.mjs. Served from our own
// origin so the chart's PNG export can embed them. ?sport= picks NBA or MLB.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team: string }> },
) {
  const code = (await params).team.replace(/\.png$/i, "").toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) {
    return new Response("Unknown team", { status: 400 });
  }
  const sport = new URL(request.url).searchParams.get("sport") ?? "nfl";
  if (!isSport(sport)) return new Response("Unknown sport", { status: 400 });
  try {
    const png = await fs.readFile(
      path.join(dataDir(sport), "logos", `${code}.png`),
    );
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("Logo not found", { status: 404 });
  }
}
