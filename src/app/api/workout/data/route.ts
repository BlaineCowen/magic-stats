import { NextResponse } from "next/server"
import { readFileSync, statSync, existsSync } from "fs"
import Papa from "papaparse"
import { categorizeExercise, computeEst1rm, type WorkoutRow } from "@/lib/workout"

export const dynamic = "force-dynamic"

const DATA_DIR = "/app/data/workout"

function resolveCsvPath(user: string): string {
  const sanitized = user.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32)
  if (!sanitized || sanitized === "blaine") return `${DATA_DIR}/strong_workouts.csv`
  return `${DATA_DIR}/${sanitized}.csv`
}

function parseRows(content: string): WorkoutRow[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  })
  const rows: WorkoutRow[] = []
  for (const raw of result.data) {
    const setOrder = parseInt(raw["Set Order"] ?? "")
    if (isNaN(setOrder)) continue
    const weight = parseFloat(raw["Weight"] ?? "") || 0
    const reps = parseInt(raw["Reps"] ?? "") || 0
    const dateStr = (raw["Date"] ?? "").substring(0, 10)
    const exerciseName = raw["Exercise Name"] ?? ""
    rows.push({
      dateStr,
      workoutName: raw["Workout Name"] ?? "",
      duration: raw["Duration"] ?? "",
      exerciseName,
      setOrder,
      weight,
      reps,
      est1rm: computeEst1rm(weight, reps),
      volume: weight * reps,
      bodyPart: categorizeExercise(exerciseName),
    })
  }
  return rows
}

export async function GET(req: Request) {
  const user = new URL(req.url).searchParams.get("user") ?? "blaine"
  const csvPath = resolveCsvPath(user)
  try {
    const stat = statSync(csvPath)
    const mtime = stat.mtimeMs
    const rows = parseRows(readFileSync(csvPath, "utf-8"))

    // Merge manual_entries.csv for blaine (persists across Strong CSV uploads)
    if (user === "blaine" || user === "") {
      const manualPath = `${DATA_DIR}/manual_entries.csv`
      if (existsSync(manualPath)) {
        rows.push(...parseRows(readFileSync(manualPath, "utf-8")))
      }
    }

    return NextResponse.json({ rows, mtime })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ rows: [], mtime: 0 })
    }
    console.error("Workout data error:", err)
    return NextResponse.json({ error: "Failed to read workout data" }, { status: 500 })
  }
}
