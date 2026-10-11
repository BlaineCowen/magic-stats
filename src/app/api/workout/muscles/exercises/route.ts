// src/app/api/workout/muscles/exercises/route.ts
// Returns all Wger exercises with English names + muscle mappings, using the shared cache.
import { NextResponse } from "next/server"
import { WGER_MUSCLE_MAP, type MuscleId } from "@/lib/muscleMap"

export const dynamic = "force-dynamic"

interface WgerMuscleRef { id: number }
interface WgerTranslation { language: number; name: string }
interface WgerExercise {
  id: number
  muscles: WgerMuscleRef[]
  muscles_secondary: WgerMuscleRef[]
  translations: WgerTranslation[]
}
interface WgerCache { exercises: WgerExercise[]; fetchedAt: number }

// Re-use the same module-level cache as the main muscles route.
// Both files share the same Node.js module instance inside the container.
declare const globalThis: { _wgerCache?: WgerCache }

async function getWgerExercises(): Promise<WgerExercise[]> {
  if (globalThis._wgerCache && Date.now() - globalThis._wgerCache.fetchedAt < 3_600_000) {
    return globalThis._wgerCache.exercises
  }

  const exercises: WgerExercise[] = []
  let url: string | null =
    "https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=100"

  while (url) {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) break
    const data = (await res.json()) as { next: string | null; results: WgerExercise[] }
    exercises.push(...data.results)
    url = data.next
  }

  globalThis._wgerCache = { exercises, fetchedAt: Date.now() }
  return exercises
}

export async function GET() {
  try {
    const wgerExercises = await getWgerExercises()

    const results = wgerExercises
      .map(e => ({
        id: e.id,
        name: e.translations.find(t => t.language === 2)?.name ?? "",
        muscles: e.muscles.flatMap(m => WGER_MUSCLE_MAP[m.id] ?? []) as MuscleId[],
        muscles_secondary: e.muscles_secondary.flatMap(m => WGER_MUSCLE_MAP[m.id] ?? []) as MuscleId[],
      }))
      .filter(e => e.name)
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ exercises: results })
  } catch (err) {
    console.error("Wger exercises error:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
