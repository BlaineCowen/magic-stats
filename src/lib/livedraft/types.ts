export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF"

/**
 * A player's raw component stat line.
 *
 * The named keys are the offensive ones every consumer relies on; the index
 * signature carries the kicking and team-defense categories, which exist so
 * mock mode can re-score formats this league does not use (it starts no
 * kicker). Keyed loosely on purpose — `rescore.scoreLine` walks whatever is
 * present against whatever the target format scores, exactly as the Python does.
 */
export interface PlayerComponents {
  pass_yd: number | null
  pass_td: number | null
  pass_int: number | null
  rush_att: number | null
  rush_yd: number | null
  rush_td: number | null
  rec_tgt: number | null
  rec: number | null
  rec_yd: number | null
  rec_td: number | null
  fum_lost: number | null
  [stat: string]: number | null | undefined
}

export interface Player {
  id: string
  name: string
  pos: Position
  team: string | null
  pts: number | null
  vor: number | null
  tier: number | null
  posRank: number | null
  adp: number | null
  ecr: number | null
  ecrStd: number | null
  ecrTier: number | null
  spread: number | null
  nSources: number | null
  bye: number | null
  age: number | null
  gp: number | null
  winTotal: number | null

  // Outcome distribution from the season simulation -- genuinely different from
  // `spread`/`ecrStd`, which only measure how much forecasters disagree.
  floor: number | null
  p25: number | null
  median: number | null
  p75: number | null
  ceiling: number | null
  /** (ceiling - floor) / projection. One number for "how certain is this?". */
  risk: number | null
  expGames: number | null
  availSeasons: number | null
  vorFloor: number | null
  vorMedian: number | null
  vorCeiling: number | null

  // What blaine_score did to him, and why.
  adjPass: number | null
  adjRush: number | null
  adjNote: string | null

  // Weeks 1-5 schedule — the sell-high window. `earlyStar` marks a rosterable
  // player whose team has one of the softest openings, i.e. someone likely to
  // *look* better than he is by week 5 and be tradeable at a premium.
  earlyStar: boolean
  earlyRatio: number | null
  earlyEdge: number | null
  earlyOppPts: number | null
  earlyWinProb: number | null
  earlyBye: boolean

  // Position-aware matchup. A run funnel (stout vs pass, soft vs run) feeds
  // backs and starves receivers, so the same schedule is not "soft" for both.
  /** Opponent unit-grade advantage, on the position that matters for him. */
  matchupEdge: number | null
  oppRunDef: number | null
  oppPassDef: number | null
  /** Weeks 1-5 opponents that funnel toward *this* player's position. */
  funnelGames: number | null
  /** Experts rank him >=12 picks ahead of ADP: liable to go earlier than simulated. */
  adpLagRisk: boolean
  components: PlayerComponents
  bySource: {
    rotowire: number | null
    clay: number | null
    fftoday: number | null
  }
  /** Availability with an empty board, keyed by overall pick number. */
  availPre: Record<string, number | null>
}

export interface LeagueInfo {
  name: string
  leagueId: string
  draftId: string
  numTeams: number
  rounds: number
  mySlot: number
  myPicks: number[]
  rosterSlots: string[]
  starterSlots: string[]
  benchCount: number
  superflex: boolean
  hasKicker: boolean
  scoring: Record<string, number>
  /** Positions this format actually starts. board.json carries more (kickers). */
  draftablePositions: string[]
  /** Sleeper user id, used to auto-detect our slot from a draft's draft_order. */
  myUserId: string
}

export interface BoardMeta {
  replacement: Record<string, number>
  demand: Record<string, number>
  sourceWeights: Record<string, number>
  playerCount: number
  adpSigma: number
}

export interface TeamAdjustment {
  pass?: number
  rush?: number
  note?: string
}

export interface BlaineScore {
  weight: number
  teams: Record<string, TeamAdjustment>
  riskOverrides: Record<string, number>
}

/**
 * A team's defensive unit grades and the funnel they create.
 *
 * `funnel` is passDef − runDef: positive means better against the pass than the
 * run, i.e. a **run funnel** that feeds opposing backs. Negative is a pass
 * funnel that feeds receivers.
 */
export interface TeamFunnel {
  team: string
  di: number
  ed: number
  lb: number
  cb: number
  s: number
  runDef: number
  passDef: number
  funnel: number
  kind: "run" | "pass" | "neutral"
  /** Averages over this team's own weeks 1-5 opponents. */
  oppRunDef: number | null
  oppPassDef: number | null
  rbEdge: number | null
  wrEdge: number | null
  runFunnelGames: number | null
  passFunnelGames: number | null
}

export interface Board {
  generatedAt: string
  season: number
  league: LeagueInfo
  meta: BoardMeta
  funnels: TeamFunnel[]
  blaineScore: BlaineScore
  players: Player[]
}

/**
 * Which percentile drives the ranking.
 *
 * Round-aware by default because it reflects how a 12-team league is actually
 * won: early picks are anchors that have to play, so rank them on floor, while
 * late picks are bench lottery tickets where the upside is the entire point.
 */
export type RiskMode = "auto" | "floor" | "balanced" | "upside"

export interface DraftPick {
  pick_no: number
  round: number
  draft_slot: number
  player_id: string | null
}

/**
 * Live per-player values, recomputed against who is actually gone.
 *
 * Sent as a compact overlay rather than whole players: the client already holds
 * the full board from /api/livedraft/board, so the five-second poll only needs
 * to ship what changes. Keeps each poll a few KB instead of ~190 KB, which
 * matters on a phone on cell data.
 */
export interface LiveOverlay {
  id: string
  /** P(still on the board) at my next pick, given who is actually gone. */
  availNext: number
  /** VOR minus the best same-position player likely to survive to my next pick. */
  vona: number
  /** True when this player fills a starting slot we have not filled yet. */
  fillsNeed: boolean
}

/** A player joined with his live overlay, for rendering. */
export type LivePlayer = Player & Omit<LiveOverlay, "id">


export interface QbPace {
  gone: number
  expected: number
  delta: number
  /** Running at least RUN_ALERT_DELTA ahead of ADP expectation. */
  isRun: boolean
}

export interface DraftState {
  boardGeneratedAt: string
  draftId: string
  draftStatus: string
  /** Following a draft other than the league's own. */
  isMock: boolean
  /** Board was re-scored for that draft's format rather than the league's. */
  recomputed: boolean
  /** Team count of the draft being played — drives the snake maths. */
  numTeams: number
  /** Every pick belonging to our slot, on the played draft's snake. */
  myPicks: number[]
  picksMade: number
  onTheClock: number
  myNextPick: number | null
  picksUntilMine: number | null
  isMyPick: boolean
  draftStarted: boolean
  /** Ids only; the client resolves them against the board it already holds. */
  takenIds: string[]
  myRosterIds: string[]
  needs: Record<string, number>
  neededPositions: string[]
  byeConflicts: { week: number; players: string[] }[]
  qbPace: QbPace
  overlay: LiveOverlay[]
  recentPicks: { pick: number; slot: number; playerId: string | null }[]
}
