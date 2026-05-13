// src/lib/strongTextParser.ts

const DATE_LINE_RE =
  /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(.+?)\s+at\s+(\d+:\d+\s*[AP]M)$/i;

const SET_LINE_RE =
  /^Set\s+(\d+):\s*([\d.]+|BW)\s*(lb|kg)?\s*[×x]\s*(\d+)/i;

export function isStrongText(text: string): boolean {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return false;
  const secondLine = lines[1];
  if (!secondLine) return false;
  return DATE_LINE_RE.test(secondLine.trim());
}

export interface StrongCsvRow {
  Date: string;
  "Workout Name": string;
  Duration: string;
  "Exercise Name": string;
  "Set Order": number;
  Weight: number;
  Reps: number;
  Distance: number;
  Seconds: number;
  RPE: string;
}

function parseDate(datePart: string, timePart: string): string {
  const dt = new Date(`${datePart} ${timePart}`);
  if (isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function parseStrongText(text: string): StrongCsvRow[] {
  // Strip trailing URLs (Strong app share appends a link.strong.app URL)
  const cleaned = text.replace(/https?:\/\/\S+/g, "").trim();
  const lines = cleaned.split(/\r?\n/);

  const workoutName = lines[0]?.trim() ?? "Workout";
  const secondLine = lines[1];
  if (!secondLine) return [];

  const dateMatch = DATE_LINE_RE.exec(secondLine.trim());
  if (!dateMatch || !dateMatch[1] || !dateMatch[2]) return [];

  const dateStr = parseDate(dateMatch[1].trim(), dateMatch[2].trim());
  if (!dateStr) return [];

  const rows: StrongCsvRow[] = [];
  let currentExercise = "";

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const setMatch = SET_LINE_RE.exec(trimmedLine);
    if (setMatch && setMatch[1] && setMatch[2] && setMatch[4]) {
      const setOrder = parseInt(setMatch[1], 10);
      const rawWeight = setMatch[2].toUpperCase() === "BW" ? 0 : parseFloat(setMatch[2]);
      const unit = (setMatch[3] ?? "lb").toLowerCase();
      const weight = unit === "kg" ? rawWeight * 2.20462 : rawWeight;
      const reps = parseInt(setMatch[4], 10);

      rows.push({
        Date: dateStr,
        "Workout Name": workoutName,
        Duration: "",
        "Exercise Name": currentExercise,
        "Set Order": setOrder,
        Weight: weight,
        Reps: reps,
        Distance: 0,
        Seconds: 0,
        RPE: "",
      });
    } else {
      // Not a set line → it's an exercise name
      currentExercise = trimmedLine;
    }
  }

  return rows;
}

export function rowsToCsvLines(rows: StrongCsvRow[]): string {
  return rows
    .map(
      (r) =>
        [
          r.Date,
          r["Workout Name"],
          r.Duration,
          r["Exercise Name"],
          r["Set Order"],
          r.Weight,
          r.Reps,
          r.Distance,
          r.Seconds,
          r.RPE,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
    )
    .join("\n");
}
