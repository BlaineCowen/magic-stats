// Shared types matching api_server.py response shapes.

export type StatusResponse = {
  alive: boolean;
  systems?: {
    lead_lag?: { alive?: boolean; last_ago_s?: number | null };
    rt_middles?: { alive?: boolean; last_ago_s?: number | null };
  };
  outcomes_count?: number;
  db_size_mb?: number;
};

export type LiveGame = {
  outcome: string;
  sport?: string;
  kalshi_mid?: number | null;
  poly_mid?: number | null;
  delta?: number | null;
  last_kalshi_s?: number | null;
  last_poly_s?: number | null;
};

export type BetsSummary = {
  today?: {
    total_pnl?: number | null;
    settled?: number;
    skipped?: number;
    win_rate?: number | null;
    avg_pnl?: number | null;
  };
  active: Array<{ outcome: string }>;
  recent?: unknown[];
};

export type RecentBet = {
  outcome: string;
  sport?: string;
  signal_pct?: number | null;
  entry_ask?: number | null;
  exit_mid?: number | null;
  realized_pnl?: number | null;
  status: string;
};

export type BacktestResponse = {
  total?: { n: number; net_pnl: number; win_rate: number };
  run_at?: string;
  sports?: Record<
    string,
    { n: number; win_rate: number; avg_pnl: number; net_pnl: number }
  >;
  recent?: Array<{
    outcome: string;
    sport?: string;
    realized_pnl?: number | null;
    spread?: number | null;
    game_date?: string | null;
  }>;
} | null;

// Manual arbs

export type KalshiScanMarket = {
  ticker: string;
  title?: string | null;
  yes_ask_dollars?: number | null;
  no_ask_dollars?: number | null;
};

export type PolyScanMarket = {
  condition_id: string;
  group_item_title?: string | null;
  question?: string | null;
  yes_token_id?: string | null;
  no_token_id?: string | null;
  yes_outcome_label?: string | null;
  no_outcome_label?: string | null;
  // Last-trade / Gamma-cached price. NOT a tradeable price — on thin books
  // these can be 50-80¢ away from the actual ask. Show as reference only.
  yes_last_price?: number | null;
  no_last_price?: number | null;
  // Tradeable ask prices, derived from `bestAsk` / `1 - bestBid` on the
  // YES token book. These are what you'd actually PAY to BUY each side
  // right now — use these for combined-cost / arb math, not last_price.
  yes_ask_dollars?: number | null;
  no_ask_dollars?: number | null;
  yes_bid_dollars?: number | null;
  no_bid_dollars?: number | null;
  // YES-side bid-ask spread. A wide spread (e.g. > $0.20) means the
  // displayed prices are unreliable — the book is essentially dead.
  yes_spread_dollars?: number | null;
  seconds_delay?: number | null;
};

export type ManualArbScanResponse = {
  kalshi_markets: KalshiScanMarket[];
  poly_markets: PolyScanMarket[];
};

export type Side = "YES" | "NO";

export type ManualArbSaveBody = {
  label: string;
  kalshi_event_url?: string;
  poly_event_url?: string;
  kalshi_market_ticker: string;
  kalshi_side: Side;
  poly_condition_id: string;
  poly_token_id: string;
  poly_outcome_label?: string | null;
  poly_side: Side;
};

export type ManualArbPreflightBody = {
  kalshi_url: string;
  poly_url: string;
  kalshi_market_ticker: string;
  poly_condition_id: string;
};

export type ManualArbPreflightResponse = {
  blocked: boolean;
  block_reason: string;
  warn: boolean;
  warn_reason: string;
  combined_k_yes_p_no: number | null;
  combined_k_no_p_yes: number | null;
  kalshi: {
    ticker: string;
    title: string;
    rules_primary: string;
    yes_ask: number | null;
    no_ask: number | null;
  };
  poly: {
    condition_id: string;
    question: string;
    description: string;
    group_item_title: string;
    yes_token_id: string | null;
    no_token_id: string | null;
    yes_outcome_label: string | null;
    no_outcome_label: string | null;
    yes_last_price: number | null;
    no_last_price: number | null;
    seconds_delay: number;
  };
};

export type ManualArbSaveBidirectionalBody = {
  kalshi_url: string;
  poly_url: string;
  kalshi_market_ticker: string;
  poly_condition_id: string;
  label: string;
};

export type ManualArbSaveBidirectionalResponse = {
  ok: boolean;
  pair_ids: number[];
};

export type ManualArbState = {
  kalshi_best_ask?: number | null;
  poly_best_ask?: number | null;
  /** unix seconds; when the displayed best_ask was last observed live. */
  kalshi_best_ask_at?: number | null;
  poly_best_ask_at?: number | null;
  current_max_contracts?: number | null;
  current_roi_pct?: number | null;
  current_annualized_roi_pct?: number | null;
  days_to_close?: number | null;
  trigger_state?: string | null;
};

export type ManualArbRecentBet = {
  status: string;
  current_mtm_roi_pct?: number | null;
  target_exit_roi_pct?: number | null;
};

export type ManualArbPair = {
  id: number;
  label: string;
  kalshi_market_ticker?: string;
  kalshi_side?: Side;
  poly_outcome_label?: string;
  poly_side?: Side;
  auto_execute?: boolean | number;
  state?: ManualArbState;
  recent_bets?: ManualArbRecentBet[];
  open_bet_count?: number;
  settled_bet_count?: number;
  realized_pnl_dollars?: number | null;
  // Server returns the original event URLs the user pasted when creating
  // the pair. The dashboard uses them to surface the EVENT context (not
  // just the candidate name) — preventing the cross-event-collision bug
  // where two pairs labelled "Robert F. Kennedy Jr." but bound to entirely
  // different questions (Trump-admin-leave vs 2028 primary) get visually
  // conflated.
  kalshi_event_url?: string | null;
  poly_event_url?: string | null;
};

export type ManualArbsListResponse = { pairs: ManualArbPair[] };

export type HistoryRow = {
  pair_label?: string;
  label?: string;
  settled_count?: number;
  win_pct?: number | null;
  cost?: number | null;
  realized_pnl?: number | null;
  roi_pct?: number | null;
};

export type HistoryResponse = { history: HistoryRow[] };

// Temp arbs

export type TempArbScanResponse = {
  city_key?: string;
  city_name?: string;
  event_date?: string;
  kalshi_station_label?: string;
  poly_station_label?: string;
  same_station?: boolean;
  kalshi_markets: KalshiScanMarket[];
  poly_markets: PolyScanMarket[];
};

export type TempArbCombo = {
  kalshi_low?: number | null;
  kalshi_high?: number | null;
  poly_low?: number | null;
  poly_high?: number | null;
  kalshi_side?: Side;
  poly_side?: Side;
  current_max_contracts?: number | null;
  current_kalshi_price?: number | null;
  current_poly_price?: number | null;
  current_combined_cost?: number | null;
  current_ev_payout?: number | null;
  alpha?: number | null;
  current_ev_roi_pct?: number | null;
  trigger_state?: string | null;
};

export type TempArbPair = {
  id: number;
  label: string;
  city_key?: string;
  event_date?: string;
  backfill_status?: string;
  backfill_n_pairs?: number | null;
  n_combos?: number | null;
  top_combos?: TempArbCombo[];
  realized_pnl_dollars?: number | null;
};

export type TempArbsListResponse = { pairs: TempArbPair[] };

// Open bets

export type OpenBet = {
  source: string;
  label: string;
  instrument?: string;
  contracts?: number | null;
  entry_cost_dollars?: number | null;
  expected_payout_dollars?: number | null;
  expected_roi_pct?: number | null;
  current_mtm_dollars?: number | null;
  current_mtm_roi_pct?: number | null;
  kalshi_side?: Side;
  kalshi_entry_price?: number | null;
  kalshi_current_mid?: number | null;
  k_leg_pnl_dollars?: number | null;
  poly_side?: Side;
  poly_entry_price?: number | null;
  poly_current_mid?: number | null;
  p_leg_pnl_dollars?: number | null;
  opened_ago_s?: number | null;
};

export type PipelineStats = {
  open_count?: number;
  cost_basis?: number | null;
  current_mtm?: number | null;
  unrealized_pnl_pct?: number | null;
  mtm_known_count?: number;
};

export type OpenBetsResponse = {
  bets: OpenBet[];
  stats?: Record<string, PipelineStats>;
};

// Settled

export type SettledLeg = {
  instrument?: string;
  side?: Side;
  entry?: number | null;
  exit?: number | null;
  pnl?: number | null;
};

export type SettledBet = {
  source: string;
  label: string;
  instrument?: string;
  contracts?: number | null;
  cost?: number | null;
  realized_pnl_dollars?: number | null;
  roi_pct?: number | null;
  settled_at?: string | null;
  legs?: SettledLeg[];
};

export type SettledBetsResponse = {
  bets: SettledBet[];
  totals?: Record<
    string,
    { count: number; win_count: number; pct: number; realized_pnl: number }
  >;
  grand_total_realized_pnl_dollars?: number | null;
};

// RT middles

export type RtMovie = {
  title: string;
  kalshi_event_ticker: string;
  poly_event_slug: string;
  k_buckets: number;
  p_buckets: number;
  discovered_at?: string;
};

export type RtOpportunity = {
  title: string;
  k_ticker: string;
  k_side: string;
  k_boundary: number;
  k_price: number;
  p_side: string;
  p_boundary: number;
  p_price: number;
  combined: number;
  is_guaranteed?: boolean;
  guaranteed_floor?: number | null;
  bonus_zone_low?: number | null;
  bonus_zone_high?: number | null;
  max_contracts?: number | null;
  potential_profit_dollars?: number | null;
};

export type RtBet = {
  id: number;
  title?: string;
  k_ticker: string;
  k_side: string;
  k_boundary: number;
  p_side: string;
  p_boundary: number;
  combined_cost?: number | null;
  guaranteed_floor?: number | null;
  contracts?: number;
  current_mtm_dollars?: number | null;
  current_mtm_pct?: number | null;
  bonus_zone_low?: number | null;
  bonus_zone_high?: number | null;
  k_result?: string;
  p_result?: string;
  realized_pnl_dollars?: number | null;
  status: string;
  detected_at?: string;
};

export type RtBetsResponse = {
  bets: RtBet[];
  summary?: {
    open?: number;
    settled?: number;
    voided?: number;
    win_rate?: number | null;
    avg_pnl?: number | null;
    total_pnl?: number | null;
  };
  outcomes?: Record<string, number>;
};

// ── Arb discovery (scanner-proposed pairs awaiting human review) ────────────

export type ArbSeverity = "BLOCK" | "WARN" | "INFO";
export type ArbCandidateStatus =
  | "pending"
  | "approving"
  | "approved"
  | "rejected"
  | "expired"
  | "stale";
export type ArbRejectReason =
  | "rules_differ"
  | "different_event"
  | "outcome_mismatch"
  | "thin_market"
  | "live_delay"
  | "not_interesting"
  | "other";

export type ArbFlag = {
  id: string;
  code: string;
  severity: ArbSeverity;
  message: string;
  kalshi_excerpt?: string;
  poly_excerpt?: string;
};

export type ArbSpan = {
  start: number;
  end: number;
  term: string;
  kind: string;
  one_sided?: boolean;
};

export type ArbHighlights = {
  kalshi: ArbSpan[];
  poly: ArbSpan[];
  /** Exact strings the spans index into (server-provided). */
  kalshi_text?: string;
  poly_text?: string;
};

export type ArbCoverage = {
  unmatched_kalshi?: string[];
  unmatched_poly?: string[];
  poly_other?: string[];
};

export type ArbEdge = {
  contracts?: number | null;
  best_direction?: string | null;
  roi_pct?: number | null;
  profit_dollars?: number | null;
  error?: string;
};

export type ArbKalshiSnapshot = {
  event_ticker?: string;
  event_title?: string;
  event_sub_title?: string;
  market_ticker: string;
  outcome_label: string;
  rules_primary: string;
  rules_secondary: string;
  settlement_sources?: { name?: string; url?: string }[];
  expected_expiration_time?: string | null;
  close_time?: string | null;
  can_close_early?: boolean;
  early_close_condition?: string;
  mutually_exclusive?: boolean | null;
  status?: string;
  yes_ask?: number | null;
  no_ask?: number | null;
  event_url?: string;
};

export type ArbPolySnapshot = {
  event_slug?: string;
  event_title?: string;
  condition_id?: string;
  question?: string;
  outcome_label: string;
  yes_token_id?: string | null;
  no_token_id?: string | null;
  description: string;
  resolution_source?: string;
  end_date?: string | null;
  neg_risk?: boolean | null;
  seconds_delay?: number | null;
  fees_enabled?: boolean | null;
  game_start_time?: string | null;
  event_start_time?: string | null;
  clear_book_on_start?: boolean | null;
  yes_ask?: number | null;
  no_ask?: number | null;
  event_url?: string;
};

export type ArbCandidateRow = {
  id: number;
  dedupe_key: string;
  /** Approval is bound to exactly this text version. */
  rules_hash: string;
  check_version: number;
  series_ticker: string;
  category: string | null;
  kalshi_event_ticker: string;
  kalshi_market_ticker: string;
  kalshi_event_title: string | null;
  kalshi_outcome_label: string | null;
  poly_event_title: string | null;
  poly_outcome_label: string | null;
  poly_seconds_delay: number | null;
  outcome_match_method: string | null;
  max_severity: ArbSeverity | "NONE" | null;
  block_count: number | null;
  warn_count: number | null;
  edge_contracts: number | null;
  edge_roi_pct: number | null;
  status: ArbCandidateStatus;
  rules_changed_since_review: number;
  first_seen_at: string;
  last_checked_at: string | null;
  /** Codes of the WARN flags, for a glance in the table (full flags in detail). */
  warn_codes: string[];
  promoted_pair_ids: number[];
};

export type ArbAuditEntry = {
  id: number;
  ts: string;
  action: string;
  actor: string;
  detail: unknown;
};

export type ArbCandidateDetail = ArbCandidateRow & {
  flags: ArbFlag[];
  coverage: ArbCoverage;
  edge: ArbEdge;
  current_check_version: number;
  confirm_phrase: string;
  last_viewed_at: string | null;
  snapshot: { kalshi: ArbKalshiSnapshot; poly: ArbPolySnapshot };
  highlights: ArbHighlights;
  audit: ArbAuditEntry[];
};

export type ArbCandidatesResponse = { candidates: ArbCandidateRow[] };

export type ArbScanRun = {
  id: number;
  finished_at: string | null;
  complete: number;
  errors: string[];
  unmatched: string[];
};

export type ArbSummary = {
  counts: Record<ArbCandidateStatus, number>;
  last_run: ArbScanRun | null;
  promote_mode: string;
  approvals_enabled: boolean;
  approvals_today: number;
  max_approvals_per_day: number;
};

export type ArbApproveBody = {
  rules_hash: string;
  check_version: number;
  note?: string;
};

export type ArbApproveEventBody = {
  items: { id: number; rules_hash: string }[];
  check_version: number;
  note?: string;
};

export type ArbApproveEventResponse = {
  results: {
    id: number;
    ok: boolean;
    status_code: number;
    pair_ids: number[];
    error: string | null;
  }[];
  approved: number;
  pair_ids: number[];
};

export type ArbApproveResponse = {
  ok: boolean;
  pair_ids: number[];
  auto_execute: false;
  mode: string;
  message: string;
};

export type ArbRejectBody = { reason_code: ArbRejectReason; note?: string };

export type ArbFilters = {
  status: ArbCandidateStatus | "";
  series: string;
  hideBlocked: boolean;
};
