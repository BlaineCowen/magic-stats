import { api } from "@/lib/polyhedge/api";

export type MakerMode = "live" | "paper";

export interface MakerGame {
  key: string;
  league: string;
  team_a: string;
  team_b: string;
  first_t: number | null;
  last_t: number | null;
  running: boolean;
  recent: boolean;
  skip: boolean;
  stopped: boolean;
  kmid: number | null;
  ref: number | null;
  poly: [number | null, number | null] | null;
  bid: number | null;
  ask: number | null;
  inv_a: number | null;
  inv_b: number | null;
  net: number | null;
  cash: number | null;
  pnl_mtm: number | null;
  settled: number | null;
  pnl: number | null;
  winner: string | null;
  official: boolean;
  avg_edge_c: number | null;
  game_t: number | null;
  pnl_60s: number | null;
  fills: number;
  shares: number;
}

export interface MakerFill {
  t: number;
  game: string;
  team: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  fair: number | null;
  edge_c: number | null;
  a_price: number;
  a_dir: "buy" | "sell";
}

export interface MakerProblem {
  t: number;
  game: string;
  ev: string;
  detail: string;
}

export interface MakerSummary {
  mode: MakerMode;
  now: number;
  synced_at: number | null;
  bot: Record<string, string | number>;
  totals: {
    recent_pnl: number;
    recent_fills: number;
    all_pnl: number;
    all_games: number;
    running: number;
  };
  games: MakerGame[];
  fills: MakerFill[];
  problems: MakerProblem[];
}

export function fetchMakerSummary(mode: MakerMode): Promise<MakerSummary> {
  return api.get<MakerSummary>("/api/maker/summary", { mode });
}

export interface MakerGameDetail {
  key: string;
  team_a: string;
  team_b: string;
  // [unix seconds, P&L marked to Kalshi, Kalshi mid of team A, shares of A held, shares of B held]
  series: [number, number | null, number | null, number | null, number | null][];
  fills: MakerFill[];
  problems: MakerProblem[];
}

export function fetchMakerGame(mode: MakerMode, key: string): Promise<MakerGameDetail> {
  return api.get<MakerGameDetail>("/api/maker/game", { mode, key });
}

export interface MakerUpcomingGame {
  key: string;
  league: string;
  start_ts: number;
  started: boolean;
  team_a: string; // the Kalshi favourite
  team_b: string;
  fav_price: number | null;
  volume: number | null;
  delay: number | null;
  loaded: boolean;
  status: "real money" | "paper" | "loaded, not selected" | "recording only";
}

export interface MakerUpcoming {
  now: number;
  bot_live: boolean;
  games: MakerUpcomingGame[];
}

export function fetchMakerUpcoming(): Promise<MakerUpcoming> {
  return api.get<MakerUpcoming>("/api/maker/upcoming");
}
