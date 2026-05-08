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

// Library muscle slugs from react-muscle-highlighter
export type LibMuscleSlug =
  | "abs" | "biceps" | "calves" | "chest" | "deltoids" | "forearm"
  | "gluteal" | "hamstring" | "lower-back" | "obliques" | "quadriceps"
  | "trapezius" | "triceps" | "upper-back"

// Maps our MuscleIds to library slugs (null = no visual equivalent)
export const MUSCLE_TO_LIB_SLUG: Record<MuscleId, LibMuscleSlug | null> = {
  "upper-chest": "chest",
  "lower-chest": "chest",
  "ant-deltoid": "deltoids",
  "lat-deltoid": "deltoids",
  "post-deltoid": "deltoids",
  "lats": "upper-back",
  "upper-back": "upper-back",
  "lower-back": "lower-back",
  "traps": "trapezius",
  "biceps": "biceps",
  "triceps": "triceps",
  "forearms": "forearm",
  "upper-abs": "abs",
  "lower-abs": "abs",
  "obliques": "obliques",
  "glutes": "gluteal",
  "quads": "quadriceps",
  "hamstrings": "hamstring",
  "calves": "calves",
  "hip-flexors": null,
}

export const LIB_SLUG_LABEL: Record<LibMuscleSlug, string> = {
  "abs": "Abs",
  "biceps": "Biceps",
  "calves": "Calves",
  "chest": "Chest",
  "deltoids": "Deltoids",
  "forearm": "Forearms",
  "gluteal": "Glutes",
  "hamstring": "Hamstrings",
  "lower-back": "Lower Back",
  "obliques": "Obliques",
  "quadriceps": "Quads",
  "trapezius": "Traps",
  "triceps": "Triceps",
  "upper-back": "Upper Back / Lats",
}
