/**
 * Re-score the board for an arbitrary league format.
 *
 * board.json carries every player's raw component line, so any format can be
 * derived without another pipeline run. This is a deliberate mirror of the
 * Python — `src/scoring.py` for the dot product and `src/vor.py` for
 * replacement levels — and the two must stay in step.
 *
 * The part that matters most is the flex allocation. Fixed slots are read
 * straight off the roster, but how many quarterbacks a league *starts* is not
 * knowable a priori: it depends on whether drafters spend their SUPER_FLEX on
 * one. Assuming an answer is what makes a board wrong in a different format, so
 * the market decides it, exactly as `vor.starter_demand` does.
 */
import type { Player } from "./types"

export const FLEX_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
}

const FIXED_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"]

/** Component keys that are volume/context, never scoring events. */
const NON_SCORING = new Set(["gp", "pass_att", "pass_cmp", "rush_att", "rec_tgt"])

/**
 * Score one component line. Mirrors `score_line` in src/scoring.py: any key
 * present in both the line and the scoring table contributes value × weight,
 * so nothing about the scoring rules is hardcoded here either.
 */
export function scoreLine(
  components: Record<string, number | null | undefined>,
  scoring: Record<string, number>,
): number {
  let total = 0
  for (const [key, value] of Object.entries(components)) {
    if (value === null || value === undefined) continue
    if (NON_SCORING.has(key)) continue
    const weight = scoring[key]
    if (weight) total += value * weight
  }
  return total
}

/**
 * How many players at each position the league starts each week.
 *
 * Mirrors `starter_demand` in src/vor.py. Fixed slots come from the roster;
 * each flex slot is handed to whichever eligible position has the best-drafted
 * player not already spoken for, by ADP. In a superflex league that sends the
 * SUPER_FLEX slots to quarterbacks because that is what ADP says drafters
 * actually do; in a 1-QB league it does not.
 */
export function starterDemand(
  rosterSlots: string[],
  numTeams: number,
  players: Player[],
): Record<string, number> {
  const demand: Record<string, number> = {}
  for (const pos of FIXED_POSITIONS) demand[pos] = 0

  const flexSlots: string[] = []
  for (const slot of rosterSlots) {
    if (slot === "BN" || slot === "IR" || slot === "TAXI") continue
    if (FIXED_POSITIONS.includes(slot)) demand[slot] = (demand[slot] ?? 0) + numTeams
    else if (FLEX_ELIGIBILITY[slot]) {
      for (let i = 0; i < numTeams; i++) flexSlots.push(slot)
    }
  }

  // ADP-sorted list per position, so we can ask "who is the next unclaimed
  // player here?"
  const byPos: Record<string, number[]> = {}
  for (const pos of FIXED_POSITIONS) {
    byPos[pos] = players
      .filter((p) => p.pos === pos && p.adp !== null && p.adp !== undefined)
      .map((p) => p.adp as number)
      .sort((a, b) => a - b)
  }

  const cursor: Record<string, number> = { ...demand }
  for (const slot of flexSlots) {
    let bestPos: string | null = null
    let bestAdp = Infinity
    for (const pos of FLEX_ELIGIBILITY[slot] ?? []) {
      const idx = cursor[pos] ?? 0
      const list = byPos[pos] ?? []
      if (idx < list.length && list[idx]! < bestAdp) {
        bestAdp = list[idx]!
        bestPos = pos
      }
    }
    if (!bestPos) continue
    cursor[bestPos] = (cursor[bestPos] ?? 0) + 1
    demand[bestPos] = (demand[bestPos] ?? 0) + 1
  }
  return demand
}

/**
 * Points scored by the best player at each position who is *not* a starter --
 * the true opportunity cost of a pick. Mirrors `replacement_levels`.
 */
export function replacementLevels(
  players: Player[],
  demand: Record<string, number>,
  points: Map<string, number>,
): Record<string, number> {
  const levels: Record<string, number> = {}
  for (const [pos, count] of Object.entries(demand)) {
    const pool = players
      .filter((p) => p.pos === pos)
      .map((p) => points.get(p.id) ?? 0)
      .sort((a, b) => b - a)
    if (!pool.length) continue
    levels[pos] = pool[Math.min(count, pool.length - 1)]!
  }
  return levels
}

export interface RescoreResult {
  players: Player[]
  demand: Record<string, number>
  replacement: Record<string, number>
}

/**
 * Board re-scored and re-ranked for a different format.
 *
 * Risk percentiles are rebased rather than resimulated: the outcome
 * *distribution* around a projection does not depend on the scoring rules, so
 * the p25/p50/p75 point totals are scaled by the change in the player's mean
 * and then measured against the new replacement level.
 */
export function rescoreBoard(
  players: Player[],
  scoring: Record<string, number>,
  rosterSlots: string[],
  numTeams: number,
): RescoreResult {
  const points = new Map<string, number>()
  for (const p of players) {
    points.set(p.id, scoreLine(p.components, scoring))
  }

  const demand = starterDemand(rosterSlots, numTeams, players)
  const replacement = replacementLevels(players, demand, points)

  const rescored = players.map((p) => {
    const pts = points.get(p.id) ?? 0
    const repl = replacement[p.pos] ?? 0
    // Ratio between the new and old projection, used to carry the simulated
    // spread across. Falls back to 1 when the original was zero.
    const ratio = p.pts && p.pts !== 0 ? pts / p.pts : 1
    const scale = (v: number | null) => (v === null || v === undefined ? null : v * ratio)

    const floor = scale(p.floor)
    const median = scale(p.median)
    const ceiling = scale(p.ceiling)
    const p25 = scale(p.p25)
    const p75 = scale(p.p75)

    return {
      ...p,
      pts,
      vor: pts - repl,
      floor,
      p25,
      median,
      p75,
      ceiling,
      vorFloor: p25 === null ? null : p25 - repl,
      vorMedian: median === null ? null : median - repl,
      vorCeiling: p75 === null ? null : p75 - repl,
    }
  })

  // Positional rank follows the new ordering.
  const byPos = new Map<string, Player[]>()
  for (const p of rescored) {
    const list = byPos.get(p.pos) ?? []
    list.push(p)
    byPos.set(p.pos, list)
  }
  for (const list of byPos.values()) {
    list.sort((a, b) => (b.vor ?? 0) - (a.vor ?? 0))
    list.forEach((p, i) => {
      p.posRank = i + 1
    })
  }

  rescored.sort((a, b) => (b.vor ?? 0) - (a.vor ?? 0))
  return { players: rescored, demand, replacement }
}
