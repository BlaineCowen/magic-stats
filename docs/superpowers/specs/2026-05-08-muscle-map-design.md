# Muscle Map — Design Spec

**Date:** 2026-05-08  
**Project:** magic-stats workout dashboard (`/workout`)

---

## Context

The workout dashboard currently categorizes exercises into 8 broad body-part buckets (Chest, Back, Arms, etc.). This feature adds a dedicated **Muscle Map tab** that shows a front + back SVG body diagram with ~20 specific muscle groups lit up as a heat map, driven by your actual workout data for the selected date range.

---

## What We're Building

A new **Muscle Map** tab in the workout dashboard showing:
- A full-width front + back body diagram with muscles colored by activation intensity
- Sets / Volume toggle (same style as Exercise Explorer metric buttons)
- Hover tooltip showing muscle name + exact stat
- A link to a separate **config page** (`/workout/muscle-config`) where you review and fix exercise → muscle mappings

---

## Muscle IDs

20 specific muscle identifiers (TypeScript union type `MuscleId`):

```
upper-chest | lower-chest
ant-deltoid | lat-deltoid | post-deltoid
lats | upper-back | lower-back | traps
biceps | triceps | forearms
upper-abs | lower-abs | obliques
glutes | quads | hamstrings | calves | hip-flexors
```

---

## Data Layer

### `src/lib/muscleMap.ts` (new)

- `MuscleId` — union type of 20 strings above
- `MuscleTarget` — `{ primary: MuscleId[], secondary: MuscleId[] }`
- `WGER_TO_MUSCLE_ID` — maps Wger muscle names to our `MuscleId`s
- `ABBREV_MAP` — normalization table: `{ db: "dumbbell", bb: "barbell", rdl: "romanian deadlift", ohp: "overhead press", ... }`
- `normalizeExerciseName(name: string): string` — lowercase, expand abbreviations, strip punctuation

### `src/lib/workout.ts` (addition)

```typescript
export function muscleActivation(
  rows: WorkoutRow[],
  mappings: Record<string, MuscleTarget>
): Map<MuscleId, { sets: number; volume: number }>
```

- Iterates filtered rows; for each row looks up its exercise in `mappings`
- Primary muscle hit: +1 set, +volume; Secondary: +0.5 sets, +0.5 volume
- Returns raw counts (normalization to 0–1 happens in the component)

### Mapping persistence

`muscle_mappings.json` is **global** — one file shared across all users, keyed by exercise name. Exercise names from Strong are standard across users, so a single map makes sense. The config page shows all exercises found across every user's CSV combined.

Overrides stored at `/app/data/workout/muscle_mappings.json`:
```json
{
  "RDL": {
    "wger_id": 94,
    "wger_name": "Romanian Deadlift",
    "primary": ["hamstrings", "glutes"],
    "secondary": ["lower-back"],
    "override": true
  }
}
```

---

## API Endpoints

### `GET /api/workout/muscles?user=blaine`

1. Read unique exercise names from the user's CSV (or all CSVs if no `user` param)
2. Fetch Wger exercise list — paginate through all pages (`https://wger.de/api/v2/exercise/?format=json&language=2&limit=100&offset=0`) until `next` is null; cache full list in Node.js module memory for session lifetime (~800–1200 exercises total)
3. Fuzzy-match each exercise name: normalize both sides, compute token overlap score (intersection / union of word sets)
4. Merge with saved overrides from `muscle_mappings.json` — overrides always win
5. Return array of:
```typescript
{
  exerciseName: string      // from Strong CSV
  wgerId: number | null
  wgerName: string | null
  confidence: number        // 0–1
  primary: MuscleId[]
  secondary: MuscleId[]
  override: boolean
}
```

### `POST /api/workout/muscles/save`

Body: `{ exerciseName: string, primary: MuscleId[], secondary: MuscleId[], wgerId?: number, wgerName?: string }`  
Writes/updates the entry in `muscle_mappings.json`. Returns `{ ok: true }`.

---

## SVG Component — `src/components/workout/MuscleSvg.tsx`

Props:
```typescript
interface Props {
  view: "front" | "back"
  intensities: Map<MuscleId, number>   // 0–1 normalized
  onHover: (id: MuscleId | null) => void
}
```

- Each muscle region is a `<path>` or `<ellipse>` with `data-muscle={id}`
- Fill: `rgba(0,170,255, intensity * 0.85)` — same accent blue as dashboard
- Zero-intensity muscles: `rgba(255,255,255,0.05)` (near-invisible)
- `onMouseEnter` / `onMouseLeave` fire `onHover` with the muscle id
- Pure display component — no logic

---

## Muscle Map Tab — `src/components/workout/MuscleMap.tsx`

Props: `{ rows: WorkoutRow[], user: string }`

Behavior:
- Calls `GET /api/workout/muscles?user={user}` on mount (once per user; result is stable unless CSV changes)
- Calls `muscleActivation(rows, mappings)` via `useMemo` whenever `rows` or metric changes
- Normalizes values: divide each by the max across all muscles → 0–1
- Renders Sets / Volume toggle (same button style as Exercise Explorer)
- Renders `<MuscleSvg view="front">` and `<MuscleSvg view="back">` side by side, centered, full-width
- Hover state: a small dark tooltip card anchored near the cursor showing `"Lower Chest — 16 sets"` or `"Lower Chest — 24,500 lbs"`
- Bottom-right corner: `⚙ Review Mappings` link → `/workout/muscle-config`
- If mapping data is loading: show a muted "Loading muscle data…" placeholder

---

## Config Page — `src/app/workout/muscle-config/page.tsx`

A separate `"use client"` Next.js page (shares the same dark theme via layout).

### Table

One row per unique exercise in the user's CSV. Columns:

| Your Exercise | Matched Wger Exercise | Confidence | Primary | Secondary | |
|---|---|---|---|---|---|
| Barbell Bench Press | Bench Press | 97% | lower-chest, upper-chest | ant-deltoid, triceps | Edit |
| RDL | Stiff-Legged Deadlift | 61% ⚠️ | hamstrings | glutes, lower-back | Edit |

- Default sort: low confidence (< 0.7) floated to top, flagged with ⚠️
- Filter buttons: **All / Needs Review / Overridden**
- Search box to filter by exercise name

### Inline Edit (expands in-row, no modal)

Clicking **Edit** expands the row into an edit panel directly below it:
- **Wger search**: text input that searches Wger exercises live; picking one auto-fills muscles
- **Or set manually**: two groups of checkbox pills — **Primary** and **Secondary** — one pill per `MuscleId` (20 pills each group), pre-checked based on current mapping
- **Save** button — calls `POST /api/workout/muscles/save`, collapses row, shows ✓ confirmation
- **Cancel** — collapses without saving

Design priorities for ease of use:
- Checkbox pills are large enough to tap on mobile (min 36px height)
- The muscle pill labels use human-readable names ("Lower Chest" not "lower-chest")
- Wger search results show up to 5 suggestions inline, no dropdown scroll hell
- Save is instant (optimistic update) — no page reload required

### Header
- Title: "Muscle Mappings"
- Subtitle: "Review how your exercises map to muscles. Changes save immediately."
- "← Back to Dashboard" link

---

## Tab Wiring — `src/app/workout/page.tsx`

Add to `TABS`:
```typescript
{ id: "muscles", label: "Muscle Map" }
```

Render:
```tsx
{activeTab === "muscles" && <MuscleMap rows={filteredRows} user={user} />}
```

---

## Files Created / Modified

| File | Action |
|---|---|
| `src/lib/muscleMap.ts` | Create |
| `src/lib/workout.ts` | Add `muscleActivation()` |
| `src/app/api/workout/muscles/route.ts` | Create |
| `src/app/api/workout/muscles/save/route.ts` | Create |
| `src/components/workout/MuscleSvg.tsx` | Create |
| `src/components/workout/MuscleMap.tsx` | Create |
| `src/app/workout/muscle-config/page.tsx` | Create |
| `src/app/workout/page.tsx` | Add tab |

---

## Verification

1. Open `/workout` → new "Muscle Map" tab appears
2. Switch to it → front + back body diagram loads; muscles glow proportionally to your workout data
3. Toggle Sets ↔ Volume → diagram updates instantly
4. Hover a muscle → tooltip shows name + exact count
5. Click "Review Mappings" → navigates to `/workout/muscle-config`
6. Config page: low-confidence matches float to top with ⚠️
7. Click Edit on a row → inline panel expands with Wger search + muscle checkboxes
8. Pick a different Wger exercise or manually check muscles → Save → row collapses with ✓, change is live immediately
9. Return to Muscle Map tab → updated mapping reflected in the diagram
