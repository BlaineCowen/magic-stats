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
const MANUAL_PATH = `${DATA_DIR}/manual_entries.csv`;

const CSV_HEADER =
  "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE";

// manual_entries.csv has extra columns: Notes (9), Workout Notes (10), then RPE (11)
// This merges any manual rows not already present in the main file.
function mergeManualEntries(mainContent: string): void {
  if (!existsSync(MANUAL_PATH)) return;
  const manualLines = readFileSync(MANUAL_PATH, "utf-8")
    .split(/\r?\n/)
    .slice(1) // skip header
    .filter((l) => l.trim());

  const mainLines = mainContent.split(/\r?\n/);
  const toAppend: string[] = [];

  for (const line of manualLines) {
    const cols = line.split(",");
    if (cols.length < 9) continue;
    const date = cols[0]?.trim() ?? "";
    const exercise = cols[3]?.trim() ?? "";
    const setOrder = cols[4]?.trim() ?? "";
    if (!date || !exercise) continue;

    const exists = mainLines.some(
      (l) => l.includes(date) && l.includes(exercise) && l.includes(setOrder)
    );
    if (!exists) {
      // Drop Notes/Workout Notes columns; RPE is at index 11 (or 9 if extras absent)
      const rpe = cols.length >= 12 ? (cols[11]?.trim() ?? "") : (cols[9]?.trim() ?? "");
      toAppend.push([cols[0],cols[1],cols[2],cols[3],cols[4],cols[5],cols[6],cols[7],cols[8],rpe].join(","));
    }
  }

  if (toAppend.length > 0) {
    const current = readFileSync(DATA_PATH, "utf-8");
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    appendFileSync(DATA_PATH, prefix + toAppend.join("\n") + "\n", "utf-8");
  }
}

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

      // Read existing content (used for both dedup and newline check)
      const existingContent = existsSync(DATA_PATH)
        ? readFileSync(DATA_PATH, "utf-8")
        : "";
      const existingLines = existingContent.split(/\r?\n/);

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

      // Ensure file exists with header (no trailing newline — the append adds it)
      if (!existingContent) {
        writeFileSync(DATA_PATH, CSV_HEADER, "utf-8");
      }

      // Prefix with \n only if file exists but doesn't end with a newline
      const prefix = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
      appendFileSync(DATA_PATH, prefix + rowsToCsvLines(dedupedRows) + "\n", "utf-8");

      return Response.json({ ok: true, appended: dedupedRows.length });
    } else {
      // Full CSV export → replace file, then merge in manual entries
      writeFileSync(DATA_PATH, Buffer.from(buffer));
      mergeManualEntries(text);
      return Response.json({ ok: true, replaced: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
