/**
 * Roster construction, needs, and draft-flow signals.
 *
 * Mirrors the roster logic in `scripts/draft_assistant.py`, but does the flex
 * accounting properly: this league starts a FLEX (RB/WR/TE) and a SUPER_FLEX
 * (QB/RB/WR/TE), so "do I still need a running back?" cannot be answered from
 * position counts alone.
 */
import type { DraftPick, LeagueInfo, Player, QbPace } from "./types"

/** Which positions may fill each flex slot. */
export const FLEX_ELIGIBILITY: Record<string, string[]> = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
}

const FIXED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"])

/** QBs this far ahead of ADP expectation counts as a run. */
export const RUN_ALERT_DELTA = 3

/**
 * Which starting slots are still empty, given the players already drafted.
 *
 * Fixed slots are filled first, then whatever is left over is applied to the
 * flex slots. Filling fixed first matters: two running backs should occupy RB
 * and RB, not RB and FLEX, or the board would claim you still need a back when
 * what you actually need is a flex-eligible body.
 */
export function unfilledSlots(league: LeagueInfo, roster: Player[]): string[] {
  const byPos = new Map<string, Player[]>()
  for (const p of [...roster].sort((a, b) => (b.vor ?? 0) - (a.vor ?? 0))) {
    const list = byPos.get(p.pos) ?? []
    list.push(p)
    byPos.set(p.pos, list)
  }

  const unfilled: string[] = []
  const flexSlots: string[] = []

  for (const slot of league.starterSlots) {
    if (FIXED_POSITIONS.has(slot)) {
      const pool = byPos.get(slot)
      if (pool && pool.length) pool.shift()
      else unfilled.push(slot)
    } else {
      flexSlots.push(slot)
    }
  }

  for (const slot of flexSlots) {
    const eligible = FLEX_ELIGIBILITY[slot] ?? []
    // Spend the highest-VOR leftover that can legally fill this slot.
    let bestPos: string | null = null
    let bestVor = -Infinity
    for (const pos of eligible) {
      const pool = byPos.get(pos)
      if (!pool || !pool.length) continue
      const vor = pool[0]!.vor ?? 0
      if (vor > bestVor) {
        bestVor = vor
        bestPos = pos
      }
    }
    if (bestPos) byPos.get(bestPos)!.shift()
    else unfilled.push(slot)
  }

  return unfilled
}

/** Positions that would fill at least one still-empty starting slot. */
export function neededPositions(league: LeagueInfo, roster: Player[]): Set<string> {
  const needed = new Set<string>()
  for (const slot of unfilledSlots(league, roster)) {
    if (FIXED_POSITIONS.has(slot)) needed.add(slot)
    else for (const pos of FLEX_ELIGIBILITY[slot] ?? []) needed.add(pos)
  }
  return needed
}

/** Human-readable counts of what is still missing, e.g. `{ QB: 2, WR: 1 }`. */
export function needCounts(league: LeagueInfo, roster: Player[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const slot of unfilledSlots(league, roster)) {
    counts[slot] = (counts[slot] ?? 0) + 1
  }
  return counts
}

/**
 * Overall pick numbers for a snake-draft slot.
 * Mirrors `League.my_picks` in src/league.py.
 */
export function picksForSlot(league: LeagueInfo, slot: number): number[] {
  const picks: number[] = []
  const n = league.numTeams
  for (let round = 1; round <= league.rounds; round++) {
    picks.push(round % 2 === 1 ? (round - 1) * n + slot : (round - 1) * n + (n - slot + 1))
  }
  return picks
}

/**
 * Quarterbacks gone versus how many ADP says should be gone by now.
 *
 * This is the single most useful live signal in a superflex draft. The plan of
 * waiting on quarterback is correct right up until the run starts, and from
 * inside the draft room you cannot see it starting.
 */
export function quarterbackPace(
  allPlayers: Player[],
  takenIds: Set<string>,
  picksMade: number,
): QbPace {
  let gone = 0
  let expected = 0
  for (const p of allPlayers) {
    if (p.pos !== "QB") continue
    if (takenIds.has(p.id)) gone++
    if (p.adp !== null && p.adp <= picksMade) expected++
  }
  const delta = gone - expected
  return { gone, expected, delta, isRun: delta >= RUN_ALERT_DELTA }
}

/** Bye weeks where enough of the roster is idle to be a real problem. */
export function byeConflicts(
  roster: Player[],
  threshold = 3,
): { week: number; players: string[] }[] {
  const byWeek = new Map<number, string[]>()
  for (const p of roster) {
    if (p.bye === null || p.bye === undefined) continue
    const list = byWeek.get(p.bye) ?? []
    list.push(p.name)
    byWeek.set(p.bye, list)
  }
  return [...byWeek.entries()]
    .filter(([, names]) => names.length >= threshold)
    .map(([week, players]) => ({ week, players }))
    .sort((a, b) => b.players.length - a.players.length)
}

/** The next pick belonging to `slot` that has not happened yet. */
export function nextPickForSlot(
  league: LeagueInfo,
  slot: number,
  picksMade: number,
): number | null {
  for (const pick of picksForSlot(league, slot)) {
    if (pick > picksMade) return pick
  }
  return null
}

export function takenIdsFrom(picks: DraftPick[]): Set<string> {
  return new Set(picks.map((p) => p.player_id).filter((id): id is string => !!id))
}
