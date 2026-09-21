/**
 * How this specific league drafts, versus the national market.
 *
 * Measured from the 2025 draft (`scripts/league_bias.py`), comparing where each
 * position actually went against its superflex ADP at the time:
 *
 *     pos    n    mean   median   top-60 mean   ratio
 *     QB    33   -12.6    -11.5         -8.3    0.830
 *     RB    49    -4.0     -3.8         -1.1    0.947
 *     WR    61    +2.3     +1.8         +7.6    1.034
 *     TE    16   +17.3    +15.3         +8.1    1.285
 *
 * Round 1 of that draft spent 5 of 12 picks on quarterbacks and round 2 another
 * 4 — nine in the first 24. This is a genuinely QB-hungry room, and it lets
 * tight ends fall a long way.
 *
 * **Applied multiplicatively, not as a flat pick shift.** The flat form is
 * wrong at the top of the board: subtracting ~9 picks from every quarterback
 * drove Josh Allen (ADP 3.8) and Drake Maye (8.5) both to pick 1, along with
 * two running backs. Four players cannot all go first, and the pile-up shoved
 * the elite receivers out to a nonsensical 100% chance of surviving to pick 6.
 *
 * The multiplicative form also matches the data better: for every position the
 * full-sample shift is larger than the top-60 shift, i.e. the effect genuinely
 * scales with where a player goes. `ratio = median(actual pick / ADP)`.
 */

/** Damped toward 1.0 — one draft is 168 picks, a small sample to bet on. */
export const BIAS_DAMPING = 0.7

const MEASURED_RATIO: Record<string, number> = {
  QB: 0.83,
  RB: 0.947,
  WR: 1.034,
  TE: 1.285,
  DEF: 1.0,
  K: 1.0,
}

export const LEAGUE_ADP_RATIO: Record<string, number> = Object.fromEntries(
  Object.entries(MEASURED_RATIO).map(([pos, r]) => [pos, 1 + (r - 1) * BIAS_DAMPING]),
)

/** This league's expected draft position for a player, given national ADP. */
export function biasedAdp(adp: number, pos: string): number {
  return adp * (LEAGUE_ADP_RATIO[pos] ?? 1)
}

/** For display: how the room treats each position, in plain language. */
export const BIAS_SUMMARY: { pos: string; ratio: number; label: string }[] = [
  { pos: "QB", ratio: 0.83, label: "reaches hard — QBs go ~17% earlier" },
  { pos: "TE", ratio: 1.285, label: "waits — tight ends fall ~29%" },
  { pos: "WR", ratio: 1.034, label: "slightly late; top-60 WRs fall ~8 picks" },
  { pos: "RB", ratio: 0.947, label: "mild reach" },
]
