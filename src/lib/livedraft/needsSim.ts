/**
 * Needs-aware draft simulation.
 *
 * The plain ADP simulation in `sim.ts` has no model of the other eleven
 * rosters. It removes drafted players and shifts everyone later, so after a run
 * on one position the survivors do drift earlier — but only because the pool
 * thinned, not because it understands demand. It would behave identically if
 * twelve kickers had gone.
 *
 * That is wrong in exactly the way that matters in superflex. Twelve
 * quarterbacks going does not exhaust quarterback demand: there are roughly 24
 * QB-capable starting slots across the league, so about half the demand is
 * still out there — but it now sits with the teams that *didn't* take one,
 * while the teams that did will wait a long time for their second.
 *
 * This simulation walks the picks between now and your next one, works out
 * which team is on the clock, and has that team weigh each position by whether
 * they still need it. The result answers the real question: given who has
 * already been taken *and by whom*, who actually survives to my pick?
 */
import type { DraftPick, LeagueInfo, Player } from "./types"

/**
 * Roughly what a team ends up rostering at each position in this format,
 * counting the flex and superflex slots. Once a team is at its target the
 * simulation makes it progressively less likely to spend another early pick
 * there.
 */
export const ROSTER_TARGETS: Record<string, number> = {
  QB: 2,
  RB: 3,
  WR: 3,
  TE: 1,
  DEF: 1,
}

/**
 * Urgency multiplier by how many a team already holds, per position.
 *
 * Graded from the first player, not just past the target. An earlier version
 * only penalised teams once they *reached* the target, which made every team
 * look equally desperate early on and rendered the whole simulation a no-op
 * (measured: 0.0pp difference from plain ADP). The real dynamic is that a team
 * holding one quarterback is already meaningfully less urgent than a team
 * holding none — that is what makes a run peter out and then resume later.
 *
 * Index is the count already rostered; the last entry applies beyond it.
 */
export const NEED_CURVE: Record<string, number[]> = {
  // Superflex: everyone wants two, so the drop after the first is gentle and
  // the wall comes after the second.
  QB: [1.0, 1.3, 2.4, 4.0],
  RB: [1.0, 1.15, 1.4, 1.9, 2.8],
  WR: [1.0, 1.1, 1.3, 1.7, 2.5],
  TE: [1.0, 2.2, 3.5],
  DEF: [1.0, 4.0],
  K: [1.0, 4.0],
}

const DEFAULT_CURVE = [1.0, 1.4, 2.2, 3.2]

/** Spread of the ADP noise in log space. Matches ADP_SIGMA in sim.ts. */
const SIGMA = 0.32
const UNDRAFTED_ADP = 400

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function standardNormal(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Which draft slot is on the clock at an overall pick number (snake order). */
export function slotForPick(league: LeagueInfo, pick: number): number {
  const n = league.numTeams
  const round = Math.ceil(pick / n)
  const indexInRound = ((pick - 1) % n) + 1
  return round % 2 === 1 ? indexInRound : n - indexInRound + 1
}

/** Current roster composition per draft slot, from the picks made so far. */
export function rostersFromPicks(
  picks: DraftPick[],
  byId: Map<string, Player>,
  numTeams: number,
): Map<number, Record<string, number>> {
  const rosters = new Map<number, Record<string, number>>()
  for (let slot = 1; slot <= numTeams; slot++) rosters.set(slot, {})
  for (const pick of picks) {
    if (!pick.player_id) continue
    const player = byId.get(pick.player_id)
    if (!player) continue
    const roster = rosters.get(pick.draft_slot)
    if (!roster) continue
    roster[player.pos] = (roster[player.pos] ?? 0) + 1
  }
  return rosters
}

/**
 * Multiplier on a player's effective draft position for a given team.
 *
 * 1.0 means "this team needs this position and will take him at his ADP".
 * Above 1.0 pushes him later for this team specifically -- a team already
 * holding two quarterbacks is not spending pick 40 on a third.
 */
export function needMultiplier(roster: Record<string, number>, pos: string): number {
  const have = roster[pos] ?? 0
  const curve = NEED_CURVE[pos] ?? DEFAULT_CURVE
  return curve[Math.min(have, curve.length - 1)]!
}

export interface NeedsSimOptions {
  nSims?: number
  seed?: number
  /**
   * Per-position *multiplier* on ADP, measured from this league's own draft
   * history. Below 1 means the room reaches: 0.83 for QB moves every
   * quarterback 17% earlier than national ADP says.
   *
   * Multiplicative rather than a flat pick shift, because subtracting a
   * constant drives the top of the board below pick 1 and crowds everyone else
   * out — see the note in leagueBias.ts.
   */
  positionRatio?: Record<string, number>
}

/**
 * P(each player survives) at each of the requested picks.
 *
 * Only simulates as far as the furthest requested pick, which keeps this cheap
 * enough to run on every poll.
 */
export function simulateNeedsAware(
  available: Player[],
  picks: number[],
  league: LeagueInfo,
  rosters: Map<number, Record<string, number>>,
  picksMade: number,
  options: NeedsSimOptions = {},
): Map<string, Record<number, number>> {
  const { nSims = 1200, seed = 20260815, positionRatio = {} } = options
  const result = new Map<string, Record<number, number>>()
  if (!available.length || !picks.length) return result

  const horizon = Math.max(...picks)
  const rand = mulberry32(seed)
  const counts = new Map<string, number[]>()
  for (const p of available) counts.set(p.id, picks.map(() => 0))

  // Group by position once; within a position, ADP order does not change
  // between simulations, so each sim only re-draws noise and re-sorts.
  const positions = [...new Set(available.map((p) => p.pos))]

  for (let s = 0; s < nSims; s++) {
    // Per-position queues ordered by this simulation's noisy draft position.
    const queues = new Map<string, { id: string; value: number }[]>()
    for (const pos of positions) queues.set(pos, [])
    for (const p of available) {
      const base = (p.adp ?? UNDRAFTED_ADP) * (positionRatio[p.pos] ?? 1)
      const value = Math.max(0.5, base) * Math.exp(SIGMA * standardNormal(rand))
      queues.get(p.pos)!.push({ id: p.id, value })
    }
    for (const queue of queues.values()) queue.sort((a, b) => a.value - b.value)

    // Walk the draft. At each pick the team on the clock compares only the best
    // remaining player at each position, weighted by whether it needs him.
    const heads = new Map<string, number>()
    for (const pos of positions) heads.set(pos, 0)
    const simRosters = new Map<number, Record<string, number>>()
    for (const [slot, roster] of rosters) simRosters.set(slot, { ...roster })

    const takenAt = new Map<string, number>()
    for (let pick = picksMade + 1; pick <= horizon; pick++) {
      const slot = slotForPick(league, pick)
      const roster = simRosters.get(slot) ?? {}

      let bestPos: string | null = null
      let bestScore = Infinity
      for (const pos of positions) {
        const idx = heads.get(pos)!
        const queue = queues.get(pos)!
        if (idx >= queue.length) continue
        const score = queue[idx]!.value * needMultiplier(roster, pos)
        if (score < bestScore) {
          bestScore = score
          bestPos = pos
        }
      }
      if (!bestPos) break

      const idx = heads.get(bestPos)!
      const chosen = queues.get(bestPos)![idx]!
      heads.set(bestPos, idx + 1)
      takenAt.set(chosen.id, pick)
      roster[bestPos] = (roster[bestPos] ?? 0) + 1
      simRosters.set(slot, roster)
    }

    for (const p of available) {
      const taken = takenAt.get(p.id)
      const arr = counts.get(p.id)!
      for (let j = 0; j < picks.length; j++) {
        // Survives to pick k if he was never taken before it.
        if (taken === undefined || taken >= picks[j]!) arr[j]!++
      }
    }
  }

  for (const p of available) {
    const rec: Record<number, number> = {}
    const arr = counts.get(p.id)!
    for (let j = 0; j < picks.length; j++) rec[picks[j]!] = arr[j]! / nSims
    result.set(p.id, rec)
  }
  return result
}
