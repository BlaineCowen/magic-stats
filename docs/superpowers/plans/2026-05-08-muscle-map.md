# Muscle Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Muscle Map" tab to the workout dashboard showing a front + back SVG body diagram with ~20 specific muscle groups lit up by activation intensity, driven by the user's actual workout data.

**Architecture:** A static `muscleMap.ts` defines the 20 muscle IDs, their human labels, and a Wger muscle-ID→MuscleId map. A new API route fetches all Wger exercises (paginated, cached in module memory), fuzzy-matches each exercise name from the user's Strong CSV, and merges the result with saved user overrides from `muscle_mappings.json`. The `MuscleMap` tab component calls this API once per user, computes intensity via `muscleActivation()` in `workout.ts`, and renders two `MuscleSvg` components (front + back). A separate `/workout/muscle-config` page lets the user review and override low-confidence matches inline, with a Wger exercise search and muscle checkboxes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript — no new dependencies. Wger REST API (public, no key). Inline SVG for the body diagram.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/muscleMap.ts` | Create | `MuscleId` type, `MUSCLE_LABEL`, `WGER_MUSCLE_MAP`, `ABBREV_MAP`, `normalizeExerciseName()` |
| `src/lib/workout.ts` | Modify | Add `muscleActivation()` |
| `src/app/api/workout/muscles/route.ts` | Create | Wger fetch + fuzzy match + override merge |
| `src/app/api/workout/muscles/save/route.ts` | Create | Write overrides to `muscle_mappings.json` |
| `src/components/workout/MuscleSvg.tsx` | Create | Front/back SVG with dynamic fills, hover callbacks |
| `src/components/workout/MuscleMap.tsx` | Create | Tab component: fetches mappings, computes activation, renders diagram + tooltip |
| `src/app/workout/muscle-config/page.tsx` | Create | Review/edit page: table of matches, inline edit row |
| `src/app/workout/page.tsx` | Modify | Add `muscles` tab + render `<MuscleMap>` |

---

## Task 1: Define muscle types and normalization (`src/lib/muscleMap.ts`)

**Files:**
- Create: `src/lib/muscleMap.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/muscleMap.ts

export type MuscleId =
  | "upper-chest" | "lower-chest"
  | "ant-deltoid" | "lat-deltoid" | "post-deltoid"
  | "lats" | "upper-back" | "lower-back" | "traps"
  | "biceps" | "triceps" | "forearms"
  | "upper-abs" | "lower-abs" | "obliques"
  | "glutes" | "quads" | "hamstrings" | "calves" | "hip-flexors"

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  "upper-chest": "Upper Chest",
  "lower-chest": "Lower Chest",
  "ant-deltoid": "Anterior Deltoid",
  "lat-deltoid": "Lateral Deltoid",
  "post-deltoid": "Posterior Deltoid",
  "lats": "Lats",
  "upper-back": "Upper Back",
  "lower-back": "Lower Back",
  "traps": "Trapezius",
  "biceps": "Biceps",
  "triceps": "Triceps",
  "forearms": "Forearms",
  "upper-abs": "Upper Abs",
  "lower-abs": "Lower Abs",
  "obliques": "Obliques",
  "glutes": "Glutes",
  "quads": "Quads",
  "hamstrings": "Hamstrings",
  "calves": "Calves",
  "hip-flexors": "Hip Flexors",
}

export interface MuscleTarget {
  primary: MuscleId[]
  secondary: MuscleId[]
}

// Maps Wger muscle IDs → our MuscleIds.
// Wger muscles: 1=Biceps, 2=Ant.Deltoid, 3=Serratus, 4=Pec.Major, 5=Triceps,
// 6=Biceps femoris, 7=Gastrocnemius, 8=Glutes, 9=Quads, 10=Rectus abdominis,
// 11=Brachialis, 12=Obliques, 13=Post.Deltoid, 14=Trapezius,
// 15=Tibialis, 16=Rhomboids, 17=Lats, 18=Soleus
export const WGER_MUSCLE_MAP: Record<number, MuscleId[]> = {
  1: ["biceps"],
  2: ["ant-deltoid"],
  3: [],                            // serratus — no mapping
  4: ["upper-chest", "lower-chest"],
  5: ["triceps"],
  6: ["hamstrings"],
  7: ["calves"],
  8: ["glutes"],
  9: ["quads"],
  10: ["upper-abs", "lower-abs"],
  11: ["biceps"],                   // brachialis groups with biceps
  12: ["obliques"],
  13: ["post-deltoid"],
  14: ["traps"],
  15: [],                           // tibialis — no mapping
  16: ["upper-back"],
  17: ["lats"],
  18: ["calves"],                   // soleus groups with calves
}

// Expands common Strong abbreviations before fuzzy matching.
const ABBREV_MAP: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  rdl: "romanian deadlift",
  ohp: "overhead press",
  cgbp: "close grip bench press",
  bp: "bench press",
  dl: "deadlift",
  sq: "squat",
  lat: "lateral",
  inc: "incline",
  dec: "decline",
  ext: "extension",
}

export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .map(t => ABBREV_MAP[t] ?? t)
    .join(" ")
    .trim()
}

// Jaccard similarity over word tokens (length > 2 to ignore stop words).
export function tokenOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(t => t.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(t => t.length > 2))
  if (wordsA.size === 0 && wordsB.size === 0) return 0
  const intersection = [...wordsA].filter(t => wordsB.has(t)).length
  const union = new Set([...wordsA, ...wordsB]).size
  return intersection / union
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /DATA/AppData/openclaw/workspace/magic-stats && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/muscleMap.ts
git commit -m "feat(workout): add MuscleId types, labels, Wger map, normalization"
```

---

## Task 2: Add `muscleActivation()` to `workout.ts`

**Files:**
- Modify: `src/lib/workout.ts`

- [ ] **Step 1: Add the import and function at the bottom of `src/lib/workout.ts`**

First add the import at the top of the file (after existing imports):

```typescript
import type { MuscleId, MuscleTarget } from "@/lib/muscleMap"
```

Then add this function at the end of the file:

```typescript
export function muscleActivation(
  rows: WorkoutRow[],
  mappings: Record<string, MuscleTarget>,
): Map<MuscleId, { sets: number; volume: number }> {
  const result = new Map<MuscleId, { sets: number; volume: number }>()

  function add(id: MuscleId, sets: number, vol: number) {
    const cur = result.get(id)
    if (cur) { cur.sets += sets; cur.volume += vol }
    else result.set(id, { sets, volume: vol })
  }

  for (const r of rows) {
    const target = mappings[r.exerciseName]
    if (!target) continue
    for (const m of target.primary) add(m, 1, r.volume)
    for (const m of target.secondary) add(m, 0.5, r.volume * 0.5)
  }

  return result
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/workout.ts
git commit -m "feat(workout): add muscleActivation() aggregation function"
```

---

## Task 3: Wger fetch + fuzzy match API (`GET /api/workout/muscles`)

**Files:**
- Create: `src/app/api/workout/muscles/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/app/api/workout/muscles
```

- [ ] **Step 2: Write the route**

```typescript
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

    // Pre-normalize Wger names once
    const normalized = wgerExercises.map(e => ({
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
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the endpoint manually**

Start the dev server if not running (`npm run dev` in a separate shell), then:

```bash
curl "http://localhost:3000/api/workout/muscles?user=blaine" | head -c 500
```

Expected: JSON with `{ mappings: [...] }`, each entry having `exerciseName`, `wgerName`, `confidence`, `primary`, `secondary`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workout/muscles/route.ts
git commit -m "feat(workout): add Wger fuzzy-match muscle mapping API"
```

---

## Task 4: Mapping save API (`POST /api/workout/muscles/save`)

**Files:**
- Create: `src/app/api/workout/muscles/save/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/app/api/workout/muscles/save
```

- [ ] **Step 2: Write the route**

```typescript
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
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/workout/muscles/save/route.ts
git commit -m "feat(workout): add muscle mapping save/override API"
```

---

## Task 5: Build the SVG body diagram (`src/components/workout/MuscleSvg.tsx`)

**Files:**
- Create: `src/components/workout/MuscleSvg.tsx`

Each muscle region is a path/shape with `data-muscle` matching a `MuscleId`. The component is purely presentational.

- [ ] **Step 1: Write the component**

```typescript
// src/components/workout/MuscleSvg.tsx
"use client"

import type { MouseEvent, ReactNode } from "react"
import type { MuscleId } from "@/lib/muscleMap"

interface Props {
  view: "front" | "back"
  intensities: Map<MuscleId, number>          // 0–1 normalized
  onHover: (id: MuscleId | null, e?: MouseEvent<SVGElement>) => void
}

function fill(intensities: Map<MuscleId, number>, id: MuscleId) {
  const v = intensities.get(id) ?? 0
  return v === 0 ? "rgba(255,255,255,0.06)" : `rgba(0,170,255,${(v * 0.82 + 0.08).toFixed(2)})`
}

function MuscleRegion({
  id, intensities, onHover, children,
}: {
  id: MuscleId
  intensities: Map<MuscleId, number>
  onHover: Props["onHover"]
  children: ReactNode
}) {
  return (
    <g
      data-muscle={id}
      style={{ cursor: "crosshair" }}
      onMouseEnter={e => onHover(id, e as unknown as MouseEvent<SVGElement>)}
      onMouseLeave={e => onHover(null, e as unknown as MouseEvent<SVGElement>)}
    >
      {children}
    </g>
  )
}

export default function MuscleSvg({ view, intensities, onHover }: Props) {
  const r = (id: MuscleId) => fill(intensities, id)
  const stroke = "#2d3748"
  const sw = 0.8

  if (view === "front") {
    return (
      <svg viewBox="0 0 110 260" style={{ width: "100%", maxWidth: "160px" }}>
        {/* Body silhouette (not interactive) */}
        <ellipse cx="55" cy="18" rx="16" ry="17" fill="#1e2535" stroke={stroke} strokeWidth="0.5" />
        {/* Neck */}
        <rect x="48" y="33" width="14" height="12" rx="2" fill="#1e2535" />

        {/* Upper chest */}
        <MuscleRegion id="upper-chest" intensities={intensities} onHover={onHover}>
          <rect x="33" y="48" width="44" height="14" rx="4" fill={r("upper-chest")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Lower chest */}
        <MuscleRegion id="lower-chest" intensities={intensities} onHover={onHover}>
          <rect x="31" y="62" width="48" height="20" rx="4" fill={r("lower-chest")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Anterior deltoid L/R */}
        <MuscleRegion id="ant-deltoid" intensities={intensities} onHover={onHover}>
          <ellipse cx="22" cy="58" rx="11" ry="13" fill={r("ant-deltoid")} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="88" cy="58" rx="11" ry="13" fill={r("ant-deltoid")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Lateral deltoid L/R (outer cap of shoulder) */}
        <MuscleRegion id="lat-deltoid" intensities={intensities} onHover={onHover}>
          <ellipse cx="14" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="96" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Biceps L/R */}
        <MuscleRegion id="biceps" intensities={intensities} onHover={onHover}>
          <rect x="6" y="76" width="12" height="30" rx="5" fill={r("biceps")} stroke={stroke} strokeWidth={sw} />
          <rect x="92" y="76" width="12" height="30" rx="5" fill={r("biceps")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Forearms L/R */}
        <MuscleRegion id="forearms" intensities={intensities} onHover={onHover}>
          <rect x="5" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
          <rect x="93" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Upper abs */}
        <MuscleRegion id="upper-abs" intensities={intensities} onHover={onHover}>
          <rect x="35" y="84" width="40" height="18" rx="3" fill={r("upper-abs")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Lower abs */}
        <MuscleRegion id="lower-abs" intensities={intensities} onHover={onHover}>
          <rect x="37" y="102" width="36" height="16" rx="3" fill={r("lower-abs")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Obliques L/R */}
        <MuscleRegion id="obliques" intensities={intensities} onHover={onHover}>
          <path d="M22,84 L35,84 L33,118 L20,124 Z" fill={r("obliques")} stroke={stroke} strokeWidth={sw} />
          <path d="M75,84 L88,84 L90,124 L77,118 Z" fill={r("obliques")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Hip flexors */}
        <MuscleRegion id="hip-flexors" intensities={intensities} onHover={onHover}>
          <ellipse cx="43" cy="146" rx="10" ry="7" fill={r("hip-flexors")} stroke={stroke} strokeWidth={sw} />
          <ellipse cx="67" cy="146" rx="10" ry="7" fill={r("hip-flexors")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Quads L/R */}
        <MuscleRegion id="quads" intensities={intensities} onHover={onHover}>
          <rect x="29" y="152" width="20" height="50" rx="5" fill={r("quads")} stroke={stroke} strokeWidth={sw} />
          <rect x="61" y="152" width="20" height="50" rx="5" fill={r("quads")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>

        {/* Calves L/R */}
        <MuscleRegion id="calves" intensities={intensities} onHover={onHover}>
          <rect x="30" y="206" width="18" height="42" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
          <rect x="62" y="206" width="18" height="42" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
        </MuscleRegion>
      </svg>
    )
  }

  // ── Back view ────────────────────────────────────────────────────────────────
  return (
    <svg viewBox="0 0 110 260" style={{ width: "100%", maxWidth: "160px" }}>
      {/* Head */}
      <ellipse cx="55" cy="18" rx="16" ry="17" fill="#1e2535" stroke={stroke} strokeWidth="0.5" />
      {/* Neck */}
      <rect x="48" y="33" width="14" height="12" rx="2" fill="#1e2535" />

      {/* Trapezius */}
      <MuscleRegion id="traps" intensities={intensities} onHover={onHover}>
        <path d="M48,35 L62,35 L90,56 L80,68 L55,74 L30,68 L20,56 Z"
          fill={r("traps")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Posterior deltoid L/R */}
      <MuscleRegion id="post-deltoid" intensities={intensities} onHover={onHover}>
        <ellipse cx="22" cy="60" rx="11" ry="13" fill={r("post-deltoid")} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="88" cy="60" rx="11" ry="13" fill={r("post-deltoid")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Lateral deltoid L/R (outer cap, visible from back too) */}
      <MuscleRegion id="lat-deltoid" intensities={intensities} onHover={onHover}>
        <ellipse cx="14" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="96" cy="52" rx="7" ry="8" fill={r("lat-deltoid")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Upper back (rhomboids) */}
      <MuscleRegion id="upper-back" intensities={intensities} onHover={onHover}>
        <rect x="34" y="68" width="42" height="22" rx="3" fill={r("upper-back")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Lats L/R */}
      <MuscleRegion id="lats" intensities={intensities} onHover={onHover}>
        <path d="M20,68 L35,72 L42,148 L22,148 Z" fill={r("lats")} stroke={stroke} strokeWidth={sw} />
        <path d="M90,68 L75,72 L68,148 L88,148 Z" fill={r("lats")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Lower back */}
      <MuscleRegion id="lower-back" intensities={intensities} onHover={onHover}>
        <rect x="36" y="112" width="38" height="30" rx="3" fill={r("lower-back")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Triceps L/R */}
      <MuscleRegion id="triceps" intensities={intensities} onHover={onHover}>
        <rect x="6" y="76" width="12" height="30" rx="5" fill={r("triceps")} stroke={stroke} strokeWidth={sw} />
        <rect x="92" y="76" width="12" height="30" rx="5" fill={r("triceps")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Forearms L/R (back) */}
      <MuscleRegion id="forearms" intensities={intensities} onHover={onHover}>
        <rect x="5" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
        <rect x="93" y="108" width="12" height="26" rx="4" fill={r("forearms")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Glutes L/R */}
      <MuscleRegion id="glutes" intensities={intensities} onHover={onHover}>
        <ellipse cx="38" cy="160" rx="18" ry="16" fill={r("glutes")} stroke={stroke} strokeWidth={sw} />
        <ellipse cx="72" cy="160" rx="18" ry="16" fill={r("glutes")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Hamstrings L/R */}
      <MuscleRegion id="hamstrings" intensities={intensities} onHover={onHover}>
        <rect x="29" y="174" width="20" height="44" rx="5" fill={r("hamstrings")} stroke={stroke} strokeWidth={sw} />
        <rect x="61" y="174" width="20" height="44" rx="5" fill={r("hamstrings")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>

      {/* Calves L/R (back) */}
      <MuscleRegion id="calves" intensities={intensities} onHover={onHover}>
        <rect x="30" y="222" width="18" height="36" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
        <rect x="62" y="222" width="18" height="36" rx="5" fill={r("calves")} stroke={stroke} strokeWidth={sw} />
      </MuscleRegion>
    </svg>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/MuscleSvg.tsx
git commit -m "feat(workout): add MuscleSvg front/back SVG component with dynamic fills"
```

---

## Task 6: Build the MuscleMap tab component (`src/components/workout/MuscleMap.tsx`)

**Files:**
- Create: `src/components/workout/MuscleMap.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/workout/MuscleMap.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { muscleActivation, type WorkoutRow } from "@/lib/workout"
import { MUSCLE_LABEL, type MuscleId, type MuscleTarget } from "@/lib/muscleMap"
import MuscleSvg from "@/components/workout/MuscleSvg"

const ACCENT = "#00aaff"
const MUTED = "#94a3b8"

interface MappingEntry {
  exerciseName: string
  primary: MuscleId[]
  secondary: MuscleId[]
}

interface Props {
  rows: WorkoutRow[]
  user: string
}

export default function MuscleMap({ rows, user }: Props) {
  const [mappings, setMappings] = useState<Record<string, MuscleTarget>>({})
  const [loadingMap, setLoadingMap] = useState(true)
  const [metric, setMetric] = useState<"sets" | "volume">("sets")
  const [hovered, setHovered] = useState<MuscleId | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingMap(true)
    fetch(`/api/workout/muscles?user=${user}`)
      .then(r => r.json())
      .then((d: { mappings?: MappingEntry[] }) => {
        const map: Record<string, MuscleTarget> = {}
        for (const m of d.mappings ?? []) {
          map[m.exerciseName] = { primary: m.primary, secondary: m.secondary }
        }
        setMappings(map)
      })
      .catch(() => {})
      .finally(() => setLoadingMap(false))
  }, [user])

  const activation = useMemo(() => muscleActivation(rows, mappings), [rows, mappings])

  // Normalize 0–1 for each metric
  const intensities = useMemo(() => {
    const vals = [...activation.values()].map(v => metric === "sets" ? v.sets : v.volume)
    const max = Math.max(...vals, 1)
    const result = new Map<MuscleId, number>()
    for (const [id, v] of activation) {
      result.set(id, (metric === "sets" ? v.sets : v.volume) / max)
    }
    return result
  }, [activation, metric])

  function handleHover(id: MuscleId | null, e?: MouseEvent<SVGElement>) {
    setHovered(id)
    if (e && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 24 })
    }
  }

  function formatStat(id: MuscleId): string {
    const v = activation.get(id)
    if (!v) return "0 sets"
    if (metric === "sets") return `${v.sets.toFixed(1)} sets`
    return `${Math.round(v.volume).toLocaleString()} lbs`
  }

  if (loadingMap) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
        Loading muscle data…
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["sets", "volume"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: `1px solid ${metric === m ? ACCENT : "#2d3748"}`,
                background: metric === m ? "rgba(0,170,255,0.15)" : "transparent",
                color: metric === m ? ACCENT : MUTED,
                fontSize: "0.8rem",
                cursor: "pointer",
                fontWeight: metric === m ? 600 : 400,
              }}
            >
              {m === "sets" ? "Sets" : "Volume"}
            </button>
          ))}
        </div>
        <a
          href="/workout/muscle-config"
          style={{ fontSize: "0.8rem", color: MUTED, textDecoration: "none" }}
        >
          ⚙ Review Mappings
        </a>
      </div>

      {/* Body diagrams */}
      <div style={{ display: "flex", gap: "3rem", justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Front</p>
          <MuscleSvg view="front" intensities={intensities} onHover={handleHover} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Back</p>
          <MuscleSvg view="back" intensities={intensities} onHover={handleHover} />
        </div>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: "#1a1f2e",
            border: "1px solid #2d3748",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "0.82rem",
            color: "#e2e8f0",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 20,
          }}
        >
          <span style={{ color: ACCENT, fontWeight: 600 }}>{MUSCLE_LABEL[hovered]}</span>
          {" — "}
          {formatStat(hovered)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/workout/MuscleMap.tsx
git commit -m "feat(workout): add MuscleMap tab component with hover tooltip"
```

---

## Task 7: Build the config/review page (`/workout/muscle-config`)

**Files:**
- Create: `src/app/workout/muscle-config/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/app/workout/muscle-config
```

- [ ] **Step 2: Write the page**

```typescript
// src/app/workout/muscle-config/page.tsx
"use client"

import { useEffect, useState } from "react"
import { MUSCLE_LABEL, type MuscleId } from "@/lib/muscleMap"

const ACCENT = "#00aaff"
const MUTED = "#94a3b8"
const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleId[]

interface MappingRow {
  exerciseName: string
  wgerId: number | null
  wgerName: string | null
  confidence: number
  primary: MuscleId[]
  secondary: MuscleId[]
  override: boolean
}

type Filter = "all" | "review" | "overridden"

const CARD = { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px" }
const PILL_BASE = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "0 10px", borderRadius: "999px", fontSize: "0.75rem",
  cursor: "pointer", userSelect: "none" as const, minHeight: "32px",
  border: "1px solid #2d3748",
}

export default function MuscleConfigPage() {
  const [rows, setRows] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("review")
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)

  // Edit state
  const [editPrimary, setEditPrimary] = useState<Set<MuscleId>>(new Set())
  const [editSecondary, setEditSecondary] = useState<Set<MuscleId>>(new Set())
  const [wgerSearch, setWgerSearch] = useState("")
  const [wgerResults, setWgerResults] = useState<{ id: number; name: string; muscles: MuscleId[]; muscles_secondary: MuscleId[] }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/workout/muscles")
      .then(r => r.json())
      .then((d: { mappings?: MappingRow[] }) => setRows(d.mappings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = rows
    .filter(r => {
      if (filter === "review" && r.confidence >= 0.7 && !r.override) return false
      if (filter === "overridden" && !r.override) return false
      if (search && !r.exerciseName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      // Low confidence + not overridden float to top
      const aScore = a.override ? 1 : a.confidence
      const bScore = b.override ? 1 : b.confidence
      return aScore - bScore
    })

  function openEdit(row: MappingRow) {
    setEditId(row.exerciseName)
    setEditPrimary(new Set(row.primary))
    setEditSecondary(new Set(row.secondary))
    setWgerSearch(row.wgerName ?? "")
    setWgerResults([])
  }

  function toggleMuscle(
    set: Set<MuscleId>,
    setter: (s: Set<MuscleId>) => void,
    id: MuscleId,
  ) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  async function searchWger(q: string) {
    setWgerSearch(q)
    if (q.length < 3) { setWgerResults([]); return }
    try {
      const res = await fetch(
        `https://wger.de/api/v2/exercise/?format=json&language=2&limit=8&name=${encodeURIComponent(q)}`
      )
      const data = (await res.json()) as { results: { id: number; name: string; muscles: number[]; muscles_secondary: number[] }[] }
      // We need to map Wger muscle IDs here — import the map
      const { WGER_MUSCLE_MAP } = await import("@/lib/muscleMap")
      setWgerResults(
        data.results.map(e => ({
          id: e.id,
          name: e.name,
          muscles: e.muscles.flatMap(id => WGER_MUSCLE_MAP[id] ?? []) as MuscleId[],
          muscles_secondary: e.muscles_secondary.flatMap(id => WGER_MUSCLE_MAP[id] ?? []) as MuscleId[],
        }))
      )
    } catch { /* ignore */ }
  }

  function pickWgerResult(r: typeof wgerResults[0]) {
    setWgerSearch(r.name)
    setEditPrimary(new Set(r.muscles))
    setEditSecondary(new Set(r.muscles_secondary))
    setWgerResults([])
  }

  async function save(exerciseName: string) {
    setSaving(true)
    try {
      await fetch("/api/workout/muscles/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName,
          primary: [...editPrimary],
          secondary: [...editSecondary],
          wgerName: wgerSearch || null,
        }),
      })
      setRows(prev =>
        prev.map(r =>
          r.exerciseName === exerciseName
            ? { ...r, primary: [...editPrimary], secondary: [...editSecondary], override: true, confidence: 1 }
            : r
        )
      )
      setSaved(exerciseName)
      setTimeout(() => { setSaved(null); setEditId(null) }, 1200)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const INPUT = {
    padding: "6px 10px",
    background: "#111827",
    border: "1px solid #2d3748",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "0.85rem",
    outline: "none",
  } as const

  return (
    <div style={{ background: "#0f1117", minHeight: "100vh", color: "#e2e8f0", padding: "1.5rem 20px" }}>
      {/* Header */}
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <a href="/workout" style={{ color: MUTED, fontSize: "0.82rem", textDecoration: "none" }}>← Back to Dashboard</a>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f1f5f9", margin: "0.75rem 0 0.25rem" }}>
          Muscle Mappings
        </h1>
        <p style={{ fontSize: "0.82rem", color: MUTED, marginBottom: "1.5rem" }}>
          Review how your exercises map to muscles. Changes save immediately.
          Low-confidence matches (⚠️) are shown first.
        </p>

        {/* Controls */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
          {(["all", "review", "overridden"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: `1px solid ${filter === f ? ACCENT : "#2d3748"}`,
                background: filter === f ? "rgba(0,170,255,0.15)" : "transparent",
                color: filter === f ? ACCENT : MUTED,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              {f === "all" ? "All" : f === "review" ? "Needs Review" : "Overridden"}
            </button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises…"
            style={{ ...INPUT, width: "220px", marginLeft: "auto" }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {filtered.map(row => {
              const isEditing = editId === row.exerciseName
              const isSaved = saved === row.exerciseName
              const needsReview = row.confidence < 0.7 && !row.override

              return (
                <div key={row.exerciseName} style={{ ...CARD, overflow: "hidden" }}>
                  {/* Row summary */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto auto auto",
                    gap: "10px",
                    padding: "10px 14px",
                    alignItems: "center",
                    fontSize: "0.83rem",
                  }}>
                    <span style={{ fontWeight: 600, color: needsReview ? "#fbbf24" : "#e2e8f0" }}>
                      {needsReview && "⚠️ "}{row.exerciseName}
                    </span>
                    <span style={{ color: MUTED, fontSize: "0.78rem" }}>
                      {row.wgerName ?? "—"}{" "}
                      <span style={{ color: needsReview ? "#fbbf24" : "#64748b" }}>
                        ({Math.round(row.confidence * 100)}%)
                      </span>
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                      {row.primary.map(m => MUSCLE_LABEL[m]).join(", ") || "—"}
                    </span>
                    {row.override && (
                      <span style={{ background: "rgba(0,170,255,0.15)", color: ACCENT, borderRadius: "999px", padding: "1px 8px", fontSize: "0.68rem" }}>
                        edited
                      </span>
                    )}
                    <button
                      onClick={() => isEditing ? setEditId(null) : openEdit(row)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "6px",
                        border: `1px solid ${isEditing ? "#2d3748" : ACCENT}`,
                        background: "transparent",
                        color: isEditing ? MUTED : ACCENT,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      {isSaved ? "✓ Saved" : isEditing ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <div style={{ borderTop: "1px solid #2d3748", padding: "14px 14px 16px", background: "#111827" }}>
                      {/* Wger search */}
                      <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Search Wger exercises (auto-fills muscles)
                      </p>
                      <div style={{ position: "relative", marginBottom: "16px" }}>
                        <input
                          value={wgerSearch}
                          onChange={e => searchWger(e.target.value)}
                          placeholder="e.g. Bench Press…"
                          style={{ ...INPUT, width: "100%", boxSizing: "border-box" }}
                        />
                        {wgerResults.length > 0 && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0,
                            background: "#1a1f2e", border: "1px solid #2d3748",
                            borderRadius: "6px", zIndex: 10, marginTop: "2px",
                          }}>
                            {wgerResults.slice(0, 5).map(r => (
                              <button
                                key={r.id}
                                onClick={() => pickWgerResult(r)}
                                style={{
                                  display: "block", width: "100%", padding: "8px 12px",
                                  background: "transparent", border: "none",
                                  borderBottom: "1px solid #2d3748",
                                  color: "#e2e8f0", fontSize: "0.82rem",
                                  textAlign: "left", cursor: "pointer",
                                }}
                              >
                                {r.name}
                                <span style={{ color: MUTED, marginLeft: "8px", fontSize: "0.72rem" }}>
                                  → {r.muscles.map(m => MUSCLE_LABEL[m]).join(", ") || "—"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Muscle checkboxes */}
                      {(["primary", "secondary"] as const).map(group => {
                        const activeSet = group === "primary" ? editPrimary : editSecondary
                        const setter = group === "primary" ? setEditPrimary : setEditSecondary
                        return (
                          <div key={group} style={{ marginBottom: "14px" }}>
                            <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                              {group === "primary" ? "Primary muscles" : "Secondary muscles"}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {ALL_MUSCLES.map(m => {
                                const active = activeSet.has(m)
                                return (
                                  <button
                                    key={m}
                                    onClick={() => toggleMuscle(activeSet, setter, m)}
                                    style={{
                                      ...PILL_BASE,
                                      background: active
                                        ? group === "primary" ? "rgba(0,170,255,0.2)" : "rgba(0,170,255,0.1)"
                                        : "transparent",
                                      border: `1px solid ${active ? ACCENT : "#2d3748"}`,
                                      color: active ? ACCENT : MUTED,
                                      fontWeight: active ? 600 : 400,
                                    }}
                                  >
                                    {MUSCLE_LABEL[m]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      <button
                        onClick={() => save(row.exerciseName)}
                        disabled={saving}
                        style={{
                          padding: "8px 20px",
                          borderRadius: "6px",
                          border: "none",
                          background: saving ? "#2d3748" : ACCENT,
                          color: saving ? MUTED : "#000",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          cursor: saving ? "not-allowed" : "pointer",
                        }}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p style={{ color: MUTED, textAlign: "center", padding: "2rem" }}>No exercises match this filter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/workout/muscle-config/page.tsx
git commit -m "feat(workout): add muscle mapping review/edit config page"
```

---

## Task 8: Wire the Muscle Map tab into `page.tsx`

**Files:**
- Modify: `src/app/workout/page.tsx`

- [ ] **Step 1: Add the import at the top of `src/app/workout/page.tsx` (with existing imports)**

```typescript
import MuscleMap from "@/components/workout/MuscleMap"
```

- [ ] **Step 2: Extend the `Tab` type and `TABS` array**

Find:
```typescript
type Tab = "overview" | "explorer" | "workouts" | "records"
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "explorer", label: "Exercise Explorer" },
  { id: "workouts", label: "Workouts" },
  { id: "records", label: "Personal Records" },
]
```

Replace with:
```typescript
type Tab = "overview" | "explorer" | "workouts" | "records" | "muscles"
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "explorer", label: "Exercise Explorer" },
  { id: "workouts", label: "Workouts" },
  { id: "records", label: "Personal Records" },
  { id: "muscles", label: "Muscle Map" },
]
```

- [ ] **Step 3: Add the tab render in the content section**

Find the block ending with:
```tsx
{activeTab === "records" && <PersonalRecords rows={filteredRows} />}
```

Add immediately after it:
```tsx
{activeTab === "muscles" && <MuscleMap rows={filteredRows} user={user} />}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/workout/page.tsx
git commit -m "feat(workout): wire Muscle Map tab into workout dashboard"
```

---

## Verification

1. Open `http://localhost:3001/workout` — "Muscle Map" tab appears in the tab bar
2. Click "Muscle Map" — front and back body diagrams load; muscles glow blue in proportion to your workout data for the selected date range
3. Toggle Sets ↔ Volume — diagram updates instantly
4. Hover a muscle region — tooltip appears: "Lower Chest — 16.0 sets"
5. Click "⚙ Review Mappings" — navigates to `/workout/muscle-config`
6. Config page loads — exercises with confidence < 70% show ⚠️ and are sorted to the top
7. Default filter is "Needs Review" — only low-confidence exercises shown
8. Click Edit on a row — panel expands inline with Wger search + muscle checkboxes
9. Type in Wger search — suggestions appear; click one to auto-fill primary/secondary checkboxes
10. Toggle muscle pills manually — primary and secondary update independently
11. Click Save — row collapses with ✓, row now shows "edited" badge, confidence becomes 100%
12. Return to Muscle Map tab and change date range — activation updates instantly using the corrected mapping
