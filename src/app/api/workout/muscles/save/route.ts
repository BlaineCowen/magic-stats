// src/app/api/workout/muscles/save/route.ts
import { NextResponse } from "next/server"
import { readFileSync, writeFileSync, existsSync } from "fs"
import type { MuscleId } from "@/lib/muscleMap"

export const dynamic = "force-dynamic"

const MAPPINGS_PATH = "/app/data/workout/muscle_mappings.json"

interface SaveBody {
  exerciseName: string
  primary: MuscleId[]
  secondary: MuscleId[]
  wgerId?: number
  wgerName?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveBody
    const { exerciseName, primary, secondary, wgerId, wgerName } = body

    if (!exerciseName || !Array.isArray(primary) || !Array.isArray(secondary)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 })
    }

    const existing = existsSync(MAPPINGS_PATH)
      ? (JSON.parse(readFileSync(MAPPINGS_PATH, "utf-8")) as Record<string, unknown>)
      : {}

    existing[exerciseName] = { primary, secondary, wgerId, wgerName, override: true }
    writeFileSync(MAPPINGS_PATH, JSON.stringify(existing, null, 2))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Muscle save error:", err)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}
