/**
 * Risk preference: which percentile of a player's outcome distribution drives
 * the ranking.
 *
 * The board carries `vorFloor` (p25), `vorMedian` (p50) and `vorCeiling` (p75)
 * -- VOR computed at each percentile of a simulated season. Ranking on floor
 * favours players who will simply be there every week; ranking on ceiling
 * favours the ones whose good outcome wins you a week.
 *
 * `auto` shifts across the draft, which is how a 12-team league is actually
 * won: your first four picks are anchors that have to play, and your last four
 * are bench swings where the upside is the whole reason to hold the spot.
 */
import type { LeagueInfo, Player, RiskMode } from "./types"

export type RiskLean = "floor" | "balanced" | "upside"

/** Round boundaries for `auto`. */
export const FLOOR_THROUGH_ROUND = 4
export const UPSIDE_FROM_ROUND = 10

export function roundForPick(league: LeagueInfo, pick: number): number {
  return Math.max(1, Math.ceil(pick / league.numTeams))
}

/** The lean `auto` resolves to at a given pick. */
export function autoLean(league: LeagueInfo, pick: number | null): RiskLean {
  if (pick === null) return "balanced"
  const round = roundForPick(league, pick)
  if (round <= FLOOR_THROUGH_ROUND) return "floor"
  if (round >= UPSIDE_FROM_ROUND) return "upside"
  return "balanced"
}

export function resolveLean(
  mode: RiskMode,
  league: LeagueInfo,
  pick: number | null,
): RiskLean {
  return mode === "auto" ? autoLean(league, pick) : mode
}

/**
 * The VOR a player is ranked on under a given lean.
 *
 * Falls back to plain `vor` when the simulation has no output for a player, so
 * a missing history never silently drops him off the board.
 */
export function rankingVor(player: Player, lean: RiskLean): number {
  const pick =
    lean === "floor"
      ? player.vorFloor
      : lean === "upside"
        ? player.vorCeiling
        : player.vorMedian
  return pick ?? player.vor ?? 0
}

export const LEAN_LABEL: Record<RiskLean, string> = {
  floor: "floor (p25)",
  balanced: "median (p50)",
  upside: "upside (p75)",
}

export const LEAN_EXPLAIN: Record<RiskLean, string> = {
  floor: "Ranking on the 25th percentile — who shows up every week.",
  balanced: "Ranking on the median outcome.",
  upside: "Ranking on the 75th percentile — who wins you a week.",
}

/** Coarse risk band for display. Thresholds from the observed spread of `risk`. */
export function riskBand(risk: number | null): "low" | "medium" | "high" | null {
  if (risk === null || risk === undefined) return null
  if (risk < 0.45) return "low"
  if (risk < 0.6) return "medium"
  return "high"
}

export const RISK_BAND_CLASS: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
}
