import type { MuscleId, MuscleTarget } from "@/lib/muscleMap"

export interface WorkoutRow {
  dateStr: string
  workoutName: string
  duration: string
  exerciseName: string
  setOrder: number
  weight: number
  reps: number
  est1rm: number
  volume: number
  bodyPart: string
}

export interface SetRow {
  setOrder: number
  weight: number
  reps: number
  est1rm: number
}

export interface ExerciseBlock {
  name: string
  sets: SetRow[]
}

export interface SessionGroup {
  key: string
  date: string
  workoutName: string
  duration: string
  nExercises: number
  nSets: number
  exercises: ExerciseBlock[]
}

export interface FrequencyData {
  weeks: string[]
  grid: number[][]
  dayLabels: string[]
}

export const BODY_PART_RULES: [string, string][] = [
  ["curl", "Arms"], ["tricep", "Arms"], ["bicep", "Arms"], ["skull", "Arms"],
  ["close grip", "Arms"], ["preacher", "Arms"],
  ["plank", "Core"], ["crunch", "Core"], ["sit-up", "Core"], ["sit up", "Core"],
  ["ab wheel", "Core"], ["leg raise", "Core"], ["russian twist", "Core"],
  ["bench press", "Chest"], ["chest", "Chest"], ["pec", "Chest"],
  ["fly", "Chest"], ["flye", "Chest"],
  ["shoulder press", "Shoulders"], ["overhead press", "Shoulders"],
  ["military press", "Shoulders"], ["lateral raise", "Shoulders"],
  ["front raise", "Shoulders"], ["arnold", "Shoulders"],
  ["upright row", "Shoulders"], ["rear delt", "Shoulders"],
  ["face pull", "Shoulders"], ["shrug", "Shoulders"],
  ["deadlift", "Back"], ["row", "Back"], ["pull-up", "Back"], ["pull up", "Back"],
  ["pullup", "Back"], ["chin-up", "Back"], ["chin up", "Back"],
  ["pulldown", "Back"], ["lat ", "Back"], ["rack pull", "Back"],
  ["squat", "Legs"], ["leg press", "Legs"], ["lunge", "Legs"],
  ["hip thrust", "Legs"], ["calf", "Legs"], ["leg extension", "Legs"],
  ["leg curl", "Legs"], ["hack", "Legs"], ["bulgarian", "Legs"],
  ["step up", "Legs"], ["glute", "Legs"], ["hip abduct", "Legs"], ["hip adduct", "Legs"],
  ["run", "Cardio"], ["cycling", "Cardio"], ["bike", "Cardio"],
  ["elliptical", "Cardio"], ["cardio", "Cardio"], ["swim", "Cardio"], ["walk", "Cardio"],
]

export function categorizeExercise(name: string): string {
  const lower = name.toLowerCase()
  for (const [keyword, part] of BODY_PART_RULES) {
    if (lower.includes(keyword)) return part
  }
  return "Other"
}

export function computeEst1rm(weight: number, reps: number): number {
  if (weight <= 0) return 0
  if (reps <= 1) return weight
  return weight * (1 + reps / 30)
}

export function filterByDateRange(rows: WorkoutRow[], start: string, end: string): WorkoutRow[] {
  return rows.filter(r => {
    if (start && r.dateStr < start) return false
    if (end && r.dateStr > end) return false
    return true
  })
}

export function summaryStats(rows: WorkoutRow[]) {
  const uniqueDates = new Set(rows.map(r => r.dateStr))
  const totalWorkouts = uniqueDates.size
  const totalVolume = rows.reduce((s, r) => s + r.volume, 0)
  const uniqueExercises = new Set(rows.map(r => r.exerciseName)).size

  let avgPerWeek: number = totalWorkouts
  if (totalWorkouts > 1) {
    const sorted = [...uniqueDates].sort()
    const first = new Date(sorted[0]! + "T00:00:00")
    const last = new Date(sorted[sorted.length - 1]! + "T00:00:00")
    const days = (last.getTime() - first.getTime()) / 86400000
    const weeks = Math.max(days / 7, 1)
    avgPerWeek = Math.round((totalWorkouts / weeks) * 10) / 10
  }

  return { totalWorkouts, totalVolume, uniqueExercises, avgPerWeek }
}

function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const day = new Date(d)
  day.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(day.getFullYear(), 0, 4)
  const weekNum =
    1 + Math.round(((day.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  const isoYear =
    (() => {
      const dy = new Date(d)
      dy.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
      return dy.getFullYear()
    })()
  return `${isoYear}-W${String(weekNum).padStart(2, "0")}`
}

function weekday(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00")
  return (d.getDay() + 6) % 7 // Mon=0, Sun=6
}

export function workoutFrequency(rows: WorkoutRow[]): FrequencyData {
  const sessionDates = new Set(rows.map(r => r.dateStr))
  const weekSet = new Set<string>()
  const counts = new Map<string, number>() // "weekKey-weekday" -> count

  for (const dateStr of sessionDates) {
    const wk = isoWeekKey(dateStr)
    const wd = weekday(dateStr)
    weekSet.add(wk)
    const key = `${wk}-${wd}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const weeks = [...weekSet].sort()
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(weeks.length).fill(0))

  for (let wd = 0; wd < 7; wd++) {
    for (let wi = 0; wi < weeks.length; wi++) {
      grid[wd]![wi] = counts.get(`${weeks[wi]}-${wd}`) ?? 0
    }
  }

  return { weeks, grid, dayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }
}

export function topExercises(rows: WorkoutRow[], n = 10) {
  const sessions = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!sessions.has(r.exerciseName)) sessions.set(r.exerciseName, new Set())
    sessions.get(r.exerciseName)!.add(r.dateStr)
  }
  return [...sessions.entries()]
    .map(([exercise, dates]) => ({ exercise, sessions: dates.size }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, n)
}

export function exerciseSessions(rows: WorkoutRow[], exercise: string) {
  const byDate = new Map<string, { maxWeight: number; bestEst1rm: number; maxReps: number }>()
  for (const r of rows) {
    if (r.exerciseName !== exercise) continue
    const cur = byDate.get(r.dateStr)
    if (!cur) {
      byDate.set(r.dateStr, { maxWeight: r.weight, bestEst1rm: r.est1rm, maxReps: r.reps })
    } else {
      cur.maxWeight = Math.max(cur.maxWeight, r.weight)
      cur.bestEst1rm = Math.max(cur.bestEst1rm, r.est1rm)
      cur.maxReps = Math.max(cur.maxReps, r.reps)
    }
  }
  return [...byDate.entries()]
    .map(([date, s]) => ({ date, ...s }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function exercisePRMap(rows: WorkoutRow[]): Map<string, { weight: number; est1rm: number }> {
  const map = new Map<string, { weight: number; est1rm: number }>()
  for (const r of rows) {
    if (r.weight <= 0) continue
    const cur = map.get(r.exerciseName)
    if (!cur) {
      map.set(r.exerciseName, { weight: r.weight, est1rm: r.est1rm })
    } else {
      cur.weight = Math.max(cur.weight, r.weight)
      cur.est1rm = Math.max(cur.est1rm, r.est1rm)
    }
  }
  return map
}

export function allTimePRs(rows: WorkoutRow[]) {
  const prMap = exercisePRMap(rows)
  const volMap = new Map<string, number>()
  for (const r of rows) {
    if (r.weight <= 0) continue
    volMap.set(r.exerciseName, Math.max(volMap.get(r.exerciseName) ?? 0, r.volume))
  }
  return [...prMap.entries()]
    .map(([exercise, { weight, est1rm }]) => ({
      exercise,
      bestWeight: weight,
      bestEst1rm: est1rm,
      bestVol: volMap.get(exercise) ?? 0,
    }))
    .sort((a, b) => b.bestEst1rm - a.bestEst1rm)
}

export function groupedSessions(rows: WorkoutRow[]): SessionGroup[] {
  const completed = rows.filter(r => r.setOrder > 0 && r.reps > 0)

  const sessionMap = new Map<
    string,
    { date: string; workoutName: string; duration: string; exerciseRows: Map<string, SetRow[]> }
  >()

  for (const r of completed) {
    const key = `${r.dateStr}::${r.workoutName}`
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        date: r.dateStr,
        workoutName: r.workoutName,
        duration: r.duration,
        exerciseRows: new Map(),
      })
    }
    const session = sessionMap.get(key)!
    if (!session.exerciseRows.has(r.exerciseName)) {
      session.exerciseRows.set(r.exerciseName, [])
    }
    session.exerciseRows.get(r.exerciseName)!.push({
      setOrder: r.setOrder,
      weight: r.weight,
      reps: r.reps,
      est1rm: r.est1rm,
    })
  }

  return [...sessionMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, { date, workoutName, duration, exerciseRows }]) => {
      const exercises: ExerciseBlock[] = [...exerciseRows.entries()].map(([name, sets]) => ({
        name,
        sets: sets.sort((a, b) => a.setOrder - b.setOrder),
      }))
      return {
        key,
        date,
        workoutName,
        duration,
        nExercises: exercises.length,
        nSets: exercises.reduce((s, e) => s + e.sets.length, 0),
        exercises,
      }
    })
}

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

// ── Trend & Forecast ─────────────────────────────────────────────────────────

export interface ExtendedChartPoint {
  date: string
  maxWeight: number | null
  bestEst1rm: number | null
  maxReps: number | null
  trend: number | null
  forecast: number | null
}

// Ordinary least squares log regression: fits y = a·ln(t) + b
// t must be > 0 (use 1-indexed days). Returns null if degenerate.
export function logRegression(
  points: { t: number; y: number }[],
): { a: number; b: number } | null {
  const n = points.length
  if (n < 2) return null

  let sumU = 0, sumY = 0, sumUU = 0, sumUY = 0
  for (const { t, y } of points) {
    const u = Math.log(t)
    sumU  += u
    sumY  += y
    sumUU += u * u
    sumUY += u * y
  }

  const denom = n * sumUU - sumU * sumU
  if (Math.abs(denom) < 1e-10) return null

  const a = (n * sumUY - sumU * sumY) / denom
  const b = (sumY - a * sumU) / n
  return { a, b }
}

// Extends session data with trend overlay and optional forecast points.
// forecastDays=0 skips forecast. Requires ≥3 sessions for regression.
export function addTrendAndForecast(
  sessions: { date: string; maxWeight: number; bestEst1rm: number; maxReps: number }[],
  metricKey: "maxWeight" | "bestEst1rm" | "maxReps",
  forecastDays: number,
): ExtendedChartPoint[] {
  if (sessions.length === 0) return []

  const firstMs = new Date(sessions[0]!.date + "T00:00:00").getTime()

  // t = days from first session + 1 (1-indexed, so ln(t) is never ln(0))
  const pts = sessions.map(s => ({
    t: Math.round((new Date(s.date + "T00:00:00").getTime() - firstMs) / 86_400_000) + 1,
    y: s[metricKey],
  }))

  const fit = sessions.length >= 3 ? logRegression(pts) : null

  const result: ExtendedChartPoint[] = sessions.map((s, i) => {
    const t = pts[i]!.t
    const raw = fit ? fit.a * Math.log(t) + fit.b : null
    return {
      date: s.date,
      maxWeight: s.maxWeight,
      bestEst1rm: s.bestEst1rm,
      maxReps: s.maxReps,
      trend: raw !== null ? Math.max(0, raw) : null,
      forecast: null,
    }
  })

  if (forecastDays > 0 && fit) {
    const lastDate = new Date(sessions[sessions.length - 1]!.date + "T00:00:00")
    const lastT = pts[pts.length - 1]!.t
    const N = 12 // points spread over forecastDays

    for (let i = 0; i <= N; i++) {
      const daysAhead = Math.round((forecastDays / N) * i)
      const t = lastT + daysAhead
      const val = Math.max(0, fit.a * Math.log(t) + fit.b)

      if (i === 0) {
        // Set forecast on the last real point so the line connects with no gap
        result[result.length - 1]!.forecast = val
      } else {
        const d = new Date(lastDate)
        d.setDate(lastDate.getDate() + daysAhead)
        result.push({
          date: d.toISOString().slice(0, 10),
          maxWeight: null,
          bestEst1rm: null,
          maxReps: null,
          trend: null,
          forecast: val,
        })
      }
    }
  }

  return result
}
