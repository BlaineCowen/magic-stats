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
  yes_last_price?: number | null;
  no_last_price?: number | null;
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
