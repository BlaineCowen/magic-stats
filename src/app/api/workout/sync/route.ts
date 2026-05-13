// POST /api/workout/sync?token=<WORKOUT_SYNC_TOKEN>[&username=<name>]
// Accepts either:
// 1. Single-workout text (from Strong share sheet) → appends to {user}.csv
// 2. Full CSV export → replaces {user}.csv, then merges {user}_manual_entries.csv
// Called from Apple Shortcuts after a Strong export or share.
// username defaults to "blaine" (maps to strong_workouts.csv for backward compat).
import { writeFileSync, appendFileSync, readFileSync, existsSync } from "fs";
import { isStrongText, parseStrongText, rowsToCsvLines } from "@/lib/strongTextParser";

export const dynamic = "force-dynamic";

const DATA_DIR = "/app/data/workout";

const CSV_HEADER =
  "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE";

function sanitizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

// Blaine's data lives in strong_workouts.csv for backward compat; everyone else gets {username}.csv
function dataPathFor(username: string): string {
  return username === "blaine"
    ? `${DATA_DIR}/strong_workouts.csv`
    : `${DATA_DIR}/${username}.csv`;
}

// manual_entries.csv has extra cols: Notes (9), Workout Notes (10), then RPE (11).
// Merges any rows not already present in the user's main file.
function mergeManualEntries(username: string, mainContent: string): void {
  const manualPath = username === "blaine"
    ? `${DATA_DIR}/manual_entries.csv`
    : `${DATA_DIR}/${username}_manual_entries.csv`;

  if (!existsSync(manualPath)) return;

  const dataPath = dataPathFor(username);
  const manualLines = readFileSync(manualPath, "utf-8")
    .split(/\r?\n/)
    .slice(1)
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
      const rpe = cols.length >= 12 ? (cols[11]?.trim() ?? "") : (cols[9]?.trim() ?? "");
      toAppend.push([cols[0],cols[1],cols[2],cols[3],cols[4],cols[5],cols[6],cols[7],cols[8],rpe].join(","));
    }
  }

  if (toAppend.length > 0) {
    const current = readFileSync(dataPath, "utf-8");
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    appendFileSync(dataPath, prefix + toAppend.join("\n") + "\n", "utf-8");
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!process.env.WORKOUT_SYNC_TOKEN || token !== process.env.WORKOUT_SYNC_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = sanitizeUsername(url.searchParams.get("username") ?? "blaine");
  const dataPath = dataPathFor(username);

  try {
    const buffer = await req.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buffer);

    if (isStrongText(text)) {
      // Single-workout text share → parse and append
      const newRows = parseStrongText(text);
      if (newRows.length === 0) {
        return Response.json({ error: "Could not parse workout text" }, { status: 400 });
      }

      const existingContent = existsSync(dataPath)
        ? readFileSync(dataPath, "utf-8")
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

      if (!existingContent) {
        writeFileSync(dataPath, CSV_HEADER, "utf-8");
      }

      const prefix = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
      appendFileSync(dataPath, prefix + rowsToCsvLines(dedupedRows) + "\n", "utf-8");

      return Response.json({ ok: true, appended: dedupedRows.length });
    } else {
      // Full CSV export → replace file, then merge manual entries
      writeFileSync(dataPath, Buffer.from(buffer));
      mergeManualEntries(username, text);
      return Response.json({ ok: true, replaced: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
