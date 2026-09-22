// src/lib/muscleMap.ts

export type MuscleId =
  | "upper-chest" | "lower-chest"
  | "ant-deltoid" | "lat-deltoid" | "post-deltoid"
  | "lats" | "upper-back" | "lower-back" | "traps"
  | "biceps" | "triceps" | "forearms"
  | "upper-abs" | "lower-abs" | "obliques"
  | "glutes" | "quads" | "hamstrings" | "calves" | "hip-flexors"
  | "hip-adductors" | "hip-abductors"

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
  "hip-adductors": "Hip Adductors",
  "hip-abductors": "Hip Abductors",
}

export interface MuscleTarget {
  primary: MuscleId[]
  secondary: MuscleId[]
}

// Maps Wger muscle IDs → our MuscleIds.
// Verified from /api/v2/muscle/ — Wger has exactly 15 muscles (IDs 1–15):
// 1=Biceps brachii, 2=Anterior deltoid, 3=Serratus anterior, 4=Pectoralis major,
// 5=Triceps brachii, 6=Rectus abdominis, 7=Gastrocnemius, 8=Gluteus maximus,
// 9=Trapezius, 10=Quadriceps femoris, 11=Biceps femoris, 12=Latissimus dorsi,
// 13=Brachialis, 14=Obliquus externus abdominis, 15=Soleus
export const WGER_MUSCLE_MAP: Record<number, MuscleId[]> = {
  1: ["biceps"],
  2: ["ant-deltoid"],
  3: [],                             // serratus anterior — no visual mapping
  4: ["upper-chest", "lower-chest"],
  5: ["triceps"],
  6: ["upper-abs", "lower-abs"],     // rectus abdominis
  7: ["calves"],                     // gastrocnemius
  8: ["glutes"],
  9: ["traps"],                      // trapezius
  10: ["quads"],                     // quadriceps femoris
  11: ["hamstrings"],                // biceps femoris
  12: ["lats"],                      // latissimus dorsi
  13: ["biceps"],                    // brachialis groups with biceps
  14: ["obliques"],                  // obliquus externus abdominis
  15: ["calves"],                    // soleus groups with calves
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
  | "trapezius" | "triceps" | "upper-back" | "adductors"

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
  "hip-adductors": "adductors",
  "hip-abductors": "gluteal",
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
  "adductors": "Hip Adductors",
}
