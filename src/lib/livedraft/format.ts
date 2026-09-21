/**
 * Working out what draft you pasted, and what format it is.
 *
 * Mock drafts are frequently a different format from your league, and the board
 * is scored and VOR-ranked for *your* settings. Pointed at a 1-QB mock without
 * adjusting, the app would rank quarterbacks as if superflex -- replacement is
 * QB22 in this league versus roughly QB10 there -- and give confident, wrong
 * advice. So the format has to be detected before anything is displayed.
 */
import type { LeagueInfo } from "./types"

export interface DraftRef {
  kind: "draft" | "league"
  id: string
}

const ID_RE = /(\d{6,})/

/**
 * Accepts a draft URL, a league URL, or a bare id of either kind.
 *
 * Both id types are bare digit strings, so a bare id is indistinguishable on
 * sight; the caller resolves it by trying the draft endpoint first and falling
 * back to the league one.
 */
export function parseDraftRef(input: string): DraftRef | null {
  const text = input.trim()
  if (!text) return null

  if (/\/draft\//i.test(text)) {
    const m = ID_RE.exec(text.split(/[?#]/)[0]!.split("/draft/")[1] ?? "")
    return m ? { kind: "draft", id: m[1]! } : null
  }
  if (/\/leagues?\//i.test(text)) {
    const m = ID_RE.exec(text.split(/[?#]/)[0]!.split(/\/leagues?\//)[1] ?? "")
    return m ? { kind: "league", id: m[1]! } : null
  }

  const bare = ID_RE.exec(text)
  // Ambiguous: reported as a draft, and the resolver falls back to league.
  return bare ? { kind: "draft", id: bare[1]! } : null
}

/**
 * Sleeper's default scoring, by `scoring_type`.
 *
 * The three modes differ only in `rec`. Note these are Sleeper's defaults, not
 * your league's -- notably `pass_int` is -1 here where your league uses -2.
 */
export const SLEEPER_BASE_SCORING: Record<string, number> = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -1,
  pass_2pt: 2,
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  fum_lost: -2,
  // Kicking
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  fgmiss: -1,
  xpm: 1,
  xpmiss: -1,
  // Team defense
  sack: 1,
  int: 2,
  fum_rec: 2,
  def_td: 6,
  safe: 2,
  blk_kick: 2,
}

const PPR_BY_TYPE: Record<string, number> = {
  std: 0,
  standard: 0,
  half_ppr: 0.5,
  ppr: 1,
}

export interface ScoringResolution {
  scoring: Record<string, number>
  ppr: number
  /** True when `scoring_type` described a format, not a scoring mode. */
  ambiguous: boolean
  note: string
}

/**
 * Scoring for a draft, from its `scoring_type`.
 *
 * `scoring_type` is not reliably a scoring field. Your own league's draft
 * reports `"2qb"`, which describes the *format* and says nothing about PPR.
 * When the token is a format rather than a scoring mode we default to half-PPR
 * and flag it, so the panel can say so and offer an override rather than
 * silently guessing.
 */
export function resolveScoring(
  scoringType: string | null | undefined,
  pprOverride?: number,
): ScoringResolution {
  const token = (scoringType ?? "").toLowerCase()
  const known = PPR_BY_TYPE[token]
  const ambiguous = known === undefined
  const ppr = pprOverride ?? (ambiguous ? 0.5 : known)

  return {
    scoring: { ...SLEEPER_BASE_SCORING, rec: ppr },
    ppr,
    ambiguous,
    note: ambiguous
      ? `Sleeper reports scoring_type "${scoringType}", which describes the format rather than the scoring — assuming ${ppr} PPR.`
      : `Sleeper reports "${scoringType}" — ${ppr} PPR.`,
  }
}

/** Sleeper draft settings, as returned by /v1/draft/{id}. */
export interface DraftSettings {
  teams?: number
  rounds?: number
  slots_qb?: number
  slots_rb?: number
  slots_wr?: number
  slots_te?: number
  slots_k?: number
  slots_def?: number
  slots_flex?: number
  slots_super_flex?: number
  slots_rec_flex?: number
  slots_wrrb_flex?: number
  slots_bn?: number
}

const SLOT_KEYS: [keyof DraftSettings, string][] = [
  ["slots_qb", "QB"],
  ["slots_rb", "RB"],
  ["slots_wr", "WR"],
  ["slots_te", "TE"],
  ["slots_flex", "FLEX"],
  ["slots_wrrb_flex", "WRRB_FLEX"],
  ["slots_rec_flex", "REC_FLEX"],
  ["slots_super_flex", "SUPER_FLEX"],
  ["slots_k", "K"],
  ["slots_def", "DEF"],
]

/**
 * Expand a draft's slot counts into the same `roster_positions` array shape
 * `league.py` produces, so everything downstream is unchanged.
 */
export function rosterFromDraftSettings(settings: DraftSettings): string[] {
  const roster: string[] = []
  for (const [key, label] of SLOT_KEYS) {
    const count = Number(settings[key] ?? 0)
    for (let i = 0; i < count; i++) roster.push(label)
  }
  return roster
}

export interface DraftFormat {
  draftId: string
  name: string
  status: string
  numTeams: number
  rounds: number
  rosterSlots: string[]
  starterSlots: string[]
  scoring: Record<string, number>
  ppr: number
  scoringAmbiguous: boolean
  scoringNote: string
  superflex: boolean
  hasKicker: boolean
  /** Slot detected from the draft's `draft_order`, when you are in it. */
  detectedSlot: number | null
}

export function buildFormat(
  draft: {
    draft_id: string
    status?: string
    metadata?: { name?: string; scoring_type?: string }
    settings?: DraftSettings
    draft_order?: Record<string, number> | null
  },
  myUserId: string,
  pprOverride?: number,
): DraftFormat {
  const settings = draft.settings ?? {}
  const rosterSlots = rosterFromDraftSettings(settings)
  const scoring = resolveScoring(draft.metadata?.scoring_type, pprOverride)

  return {
    draftId: draft.draft_id,
    name: draft.metadata?.name?.trim() || "Mock draft",
    status: draft.status ?? "unknown",
    numTeams: Number(settings.teams ?? 12),
    rounds: Number(settings.rounds ?? rosterSlots.length),
    rosterSlots,
    starterSlots: rosterSlots.filter((s) => !["BN", "IR", "TAXI"].includes(s)),
    scoring: scoring.scoring,
    ppr: scoring.ppr,
    scoringAmbiguous: scoring.ambiguous,
    scoringNote: scoring.note,
    superflex: rosterSlots.includes("SUPER_FLEX"),
    hasKicker: rosterSlots.includes("K"),
    detectedSlot: draft.draft_order?.[myUserId] ?? null,
  }
}

export interface FormatDiff {
  label: string
  league: string
  mock: string
  /** Material differences change how players should be valued. */
  material: boolean
}

/** Human-readable differences between your league and a mock. */
export function diffFormat(league: LeagueInfo, mock: DraftFormat): FormatDiff[] {
  const out: FormatDiff[] = []
  const push = (label: string, a: string, b: string, material = true) => {
    if (a !== b) out.push({ label, league: a, mock: b, material })
  }

  push("Teams", String(league.numTeams), String(mock.numTeams))
  push("Rounds", String(league.rounds), String(mock.rounds), false)
  push(
    "Superflex",
    league.superflex ? "yes" : "no",
    mock.superflex ? "yes" : "no",
  )
  push("Kicker", league.hasKicker ? "yes" : "no", mock.hasKicker ? "yes" : "no")
  push("PPR", String(league.scoring.rec ?? 0), String(mock.ppr))
  push(
    "Starters",
    league.starterSlots.join(" "),
    mock.starterSlots.join(" "),
    false,
  )
  return out
}
