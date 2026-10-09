/**
 * Monte Carlo draft simulation -- a faithful port of `src/sim.py` from the
 * projection pipeline.
 *
 * Why this exists rather than reusing the numbers already in board.json: the
 * `availPre` values baked into the export assume nobody has been drafted yet.
 * The moment the draft starts they are wrong, and they get more wrong with
 * every pick. Recomputing against the actual remaining pool is the entire
 * reason the live view is more useful than the printed cheat sheet.
 *
 * Kept deliberately in lockstep with the Python: same lognormal model, same
 * sigma, same undrafted sentinel, same >=0.55 survival threshold for the VONA
 * fallback. If you change one, change both.
 */
import type { Player } from "./types"

/** Spread of the ADP noise in log space. Must match src/sim.py ADP_SIGMA. */
export const ADP_SIGMA = 0.32

/** Players with no ADP are treated as going after everyone who has one. */
export const UNDRAFTED_ADP = 400

/** A fallback candidate must be at least this likely to survive. */
export const SURVIVAL_THRESHOLD = 0.55

/**
 * Mulberry32 -- a small seeded PRNG.
 *
 * Seeded on purpose: an unseeded sim makes the recommendation list jitter
 * between polls even when no pick has happened, which reads as a bug and
 * erodes trust in the board mid-draft.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller standard normal from a uniform generator. */
function standardNormal(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/**
 * Expected draft position per player.
 *
 * `ecrWeight` of 0 uses superflex ADP alone -- what drafters have actually been
 * doing. Raising it mixes in FantasyPros' expert consensus, modelling a room
 * that drafts closer to published rankings. That distinction is not academic
 * here: the experts rank the second QB tier 10-25 picks earlier than ADP, so
 * the two priors disagree about whether waiting on quarterback is safe.
 */
export function draftPrior(player: Player, ecrWeight = 0): number {
  const adp = player.adp ?? null
  const ecr = player.ecr ?? null
  if (ecrWeight <= 0) return adp ?? UNDRAFTED_ADP
  if (adp === null && ecr === null) return UNDRAFTED_ADP
  if (adp === null) return ecr!
  if (ecr === null) return adp
  return adp * (1 - ecrWeight) + ecr * ecrWeight
}

export interface AvailabilityOptions {
  nSims?: number
  sigma?: number
  seed?: number
  ecrWeight?: number
  /** Overall pick numbers already used; simulated positions shift past them. */
  picksMade?: number
}

/**
 * P(each player is still on the board) at each requested pick.
 *
 * `players` must already exclude drafted players. Returns an array aligned with
 * `players`, each entry a map of pick number -> probability.
 */
export function simulateAvailability(
  players: Player[],
  picks: number[],
  options: AvailabilityOptions = {},
): Map<string, Record<number, number>> {
  const {
    nSims = 2000,
    sigma = ADP_SIGMA,
    seed = 20260815,
    ecrWeight = 0,
    picksMade = 0,
  } = options

  const n = players.length
  const result = new Map<string, Record<number, number>>()
  if (n === 0) return result

  const priors = players.map((p) => Math.max(1, draftPrior(p, ecrWeight)))
  const counts: number[][] = players.map(() => picks.map(() => 0))
  const rand = mulberry32(seed)

  const noisy = new Float64Array(n)
  const order = new Int32Array(n)
  const draftPosition = new Int32Array(n)

  for (let s = 0; s < nSims; s++) {
    for (let i = 0; i < n; i++) {
      noisy[i] = priors[i]! * Math.exp(sigma * standardNormal(rand))
      order[i] = i
    }
    // Sort indices by simulated draft position.
    const idx = Array.from(order).sort((a, b) => noisy[a]! - noisy[b]!)
    for (let rank = 0; rank < n; rank++) {
      // Players already off the board occupied the first `picksMade` slots, so
      // the remaining pool starts being selected at picksMade + 1.
      draftPosition[idx[rank]!] = picksMade + rank + 1
    }
    for (let j = 0; j < picks.length; j++) {
      const pick = picks[j]!
      for (let i = 0; i < n; i++) {
        if (draftPosition[i]! >= pick) counts[i]![j]!++
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const rec: Record<number, number> = {}
    for (let j = 0; j < picks.length; j++) {
      rec[picks[j]!] = counts[i]![j]! / nSims
    }
    result.set(players[i]!.id, rec)
  }
  return result
}

/**
 * Value over next available.
 *
 * Compares each player against the best player *at his own position* who is
 * more likely than not to survive to `nextPick`. That is the real alternative:
 * skip this receiver and the receiver you actually end up with is the best one
 * still there next time. A high-VOR player who is certain to last is worth less
 * right now than a slightly worse one who will not.
 */
export function computeVona(
  players: Player[],
  availability: Map<string, Record<number, number>>,
  nextPick: number,
): Map<string, number> {
  const fallbackByPos = new Map<string, number>()
  for (const p of players) {
    const avail = availability.get(p.id)?.[nextPick] ?? 0
    if (avail < SURVIVAL_THRESHOLD) continue
    const vor = p.vor ?? 0
    const current = fallbackByPos.get(p.pos)
    if (current === undefined || vor > current) fallbackByPos.set(p.pos, vor)
  }

  const out = new Map<string, number>()
  for (const p of players) {
    const fallback = fallbackByPos.get(p.pos) ?? 0
    out.set(p.id, (p.vor ?? 0) - fallback)
  }
  return out
}
