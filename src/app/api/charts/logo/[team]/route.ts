import fs from "node:fs/promises";
import path from "node:path";
import { NFL_DATA_DIR } from "@/lib/nfl/db";

export const runtime = "nodejs";

// Logos are downloaded by scripts/refresh-nfl-data.mjs. Served from our own
// origin so the chart's PNG export can embed them.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ team: string }> },
) {
  const code = (await params).team.replace(/\.png$/i, "").toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(code)) {
    return new Response("Unknown team", { status: 400 });
  }
  try {
    const png = await fs.readFile(
      path.join(NFL_DATA_DIR, "logos", `${code}.png`),
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
