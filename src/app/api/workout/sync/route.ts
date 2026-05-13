// POST /api/workout/sync?token=<WORKOUT_SYNC_TOKEN>
// Accepts either:
// 1. Single-workout text (from Strong share sheet) → appends to strong_workouts.csv
// 2. Full CSV export → replaces strong_workouts.csv
// Called from Apple Shortcuts after a Strong export or share.
import { writeFileSync, appendFileSync, readFileSync, existsSync } from "fs";
import { isStrongText, parseStrongText, rowsToCsvLines } from "@/lib/strongTextParser";

export const dynamic = "force-dynamic";

const DATA_DIR = "/app/data/workout";
const DATA_PATH = `${DATA_DIR}/strong_workouts.csv`;

const CSV_HEADER =
  "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE";

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!process.env.WORKOUT_SYNC_TOKEN || token !== process.env.WORKOUT_SYNC_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const buffer = await req.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);

    if (isStrongText(text)) {
      // Single-workout text share → parse and append
      const newRows = parseStrongText(text);
      if (newRows.length === 0) {
        return Response.json({ error: "Could not parse workout text" }, { status: 400 });
      }

      // Deduplication: substring match avoids fragile comma-splitting of quoted CSV
      // (workout names like "Chest, Shoulder" break field-indexed parsing)
      const existingLines = existsSync(DATA_PATH)
        ? readFileSync(DATA_PATH, "utf-8").split(/\r?\n/)
        : [];

      const dedupedRows = newRows.filter(
        (r) =>
          !existingLines.some(
            (line) =>
              line.includes(r.Date) &&
              line.includes(r["Exercise Name"]) &&
              line.includes(String(r["Set Order"]))
          )
      );

      if (dedupedRows.length === 0) {
        return Response.json({ ok: true, appended: 0, message: "No new sets (already synced)" });
      }

      // Ensure file exists with header
      if (!existsSync(DATA_PATH)) {
        writeFileSync(DATA_PATH, CSV_HEADER + "\n", "utf-8");
      }

      appendFileSync(DATA_PATH, "\n" + rowsToCsvLines(dedupedRows), "utf-8");

      return Response.json({ ok: true, appended: dedupedRows.length });
    } else {
      // Full CSV export → replace file (existing behavior)
      writeFileSync(DATA_PATH, Buffer.from(buffer));
      return Response.json({ ok: true, replaced: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
