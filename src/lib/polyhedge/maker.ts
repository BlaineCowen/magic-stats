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
  // [unix seconds, pnl marked to Kalshi, Kalshi mid of team A, net position (A − B)]
  series: Record<string, [number, number | null, number | null, number | null][]>;
  fills: MakerFill[];
  problems: MakerProblem[];
}

export function fetchMakerSummary(mode: MakerMode): Promise<MakerSummary> {
  return api.get<MakerSummary>("/api/maker/summary", { mode });
}
