// src/app/api/workout/muscles/route.ts
import { NextResponse } from "next/server"
import { readFileSync, existsSync } from "fs"
import Papa from "papaparse"
import {
  normalizeExerciseName,
  tokenOverlap,
  WGER_MUSCLE_MAP,
  type MuscleId,
  type MuscleTarget,
} from "@/lib/muscleMap"

export const dynamic = "force-dynamic"

const DATA_DIR = "/app/data/workout"
const MAPPINGS_PATH = `${DATA_DIR}/muscle_mappings.json`

// ── Wger cache ────────────────────────────────────────────────────────────────

interface WgerExercise {
  id: number
  name: string
  muscles: number[]
  muscles_secondary: number[]
}
interface WgerCache { exercises: WgerExercise[]; fetchedAt: number }

let wgerCache: WgerCache | null = null

async function fetchWgerExercises(): Promise<WgerExercise[]> {
  // Cache for 1 hour (Wger data changes rarely)
  if (wgerCache && Date.now() - wgerCache.fetchedAt < 3_600_000) {
    return wgerCache.exercises
  }

  const exercises: WgerExercise[] = []
  let url: string | null =
    "https://wger.de/api/v2/exercise/?format=json&language=2&limit=100"

  while (url) {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) break
    const data = (await res.json()) as {
      next: string | null
      results: WgerExercise[]
    }
    exercises.push(...data.results)
    url = data.next
  }

  wgerCache = { exercises, fetchedAt: Date.now() }
  return exercises
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapWgerMuscles(ids: number[]): MuscleId[] {
  return ids.flatMap(id => WGER_MUSCLE_MAP[id] ?? [])
}

function loadOverrides(): Record<string, MuscleTarget & { wgerId?: number; wgerName?: string; override: boolean }> {
  if (!existsSync(MAPPINGS_PATH)) return {}
  try {
    return JSON.parse(readFileSync(MAPPINGS_PATH, "utf-8")) as Record<string, MuscleTarget & { wgerId?: number; wgerName?: string; override: boolean }>
  } catch {
    return {}
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const user = new URL(req.url).searchParams.get("user") ?? "blaine"

    // 1. Collect exercise names
    let exerciseNames: string[] = []
    const csvPath = user === "blaine"
      ? `${DATA_DIR}/strong_workouts.csv`
      : `${DATA_DIR}/${user.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32)}.csv`

    if (existsSync(csvPath)) {
      const content = readFileSync(csvPath, "utf-8")
      const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
      const seen = new Set<string>()
      for (const row of parsed.data) {
        const name = row["Exercise Name"]
        if (name && !isNaN(parseInt(row["Set Order"] ?? ""))) seen.add(name)
      }
      exerciseNames = [...seen]
    }

    // 2. Fetch Wger exercises
    const wgerExercises = await fetchWgerExercises()

    // Pre-normalize Wger names once (skip entries with no name)
    const normalized = wgerExercises
      .filter(e => e.name)
      .map(e => ({
        ...e,
        norm: normalizeExerciseName(e.name),
      }))

    // 3. Load saved overrides
    const overrides = loadOverrides()

    // 4. Match each exercise
    const results = exerciseNames.map(exerciseName => {
      // Override wins immediately
      if (overrides[exerciseName]) {
        const o = overrides[exerciseName]
        return {
          exerciseName,
          wgerId: o.wgerId ?? null,
          wgerName: o.wgerName ?? null,
          confidence: 1,
          primary: o.primary,
          secondary: o.secondary,
          override: true,
        }
      }

      // Fuzzy match
      const normStrong = normalizeExerciseName(exerciseName)
      let best = { score: 0, ex: null as (typeof normalized)[0] | null }
      for (const ex of normalized) {
        const score = tokenOverlap(normStrong, ex.norm)
        if (score > best.score) best = { score, ex }
      }

      const primary = best.ex ? mapWgerMuscles(best.ex.muscles) : []
      const secondary = best.ex ? mapWgerMuscles(best.ex.muscles_secondary) : []

      return {
        exerciseName,
        wgerId: best.ex?.id ?? null,
        wgerName: best.ex?.name ?? null,
        confidence: Math.round(best.score * 100) / 100,
        primary,
        secondary,
        override: false,
      }
    })

    return NextResponse.json({ mappings: results })
  } catch (err) {
    console.error("Muscles API error:", err)
    return NextResponse.json({ error: "Failed to load muscle data" }, { status: 500 })
  }
}
