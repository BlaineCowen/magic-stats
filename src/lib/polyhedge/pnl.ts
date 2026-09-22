import { api } from "@/lib/polyhedge/api";

export type PnlByStrategy = { strategy: string; realized: number };

export type PnlBalance = {
  available_dollars: number;
  locked_dollars: number;
};

export type PnlSummary = {
  realized: number;
  unrealized: number;
  by_strategy: PnlByStrategy[];
  balances: Record<string, PnlBalance>;
  last_sync: string | null;
};

export type PnlByDay = { date: string; realized: number };

export type PnlFill = {
  trade_id: string;
  ticker: string;
  side: string;
  action: string;
  count: number;
  price: number;
  fee_dollars: number;
  strategy: string;
  created_ts: string;
};

export type PnlFillsResponse = { fills: PnlFill[] };

export const fetchPnlSummary = () => api.get<PnlSummary>("/api/pnl/summary");
export const fetchPnlByDay = () => api.get<PnlByDay[]>("/api/pnl/by-day");
export const fetchPnlFills = () => api.get<PnlFillsResponse>("/api/pnl/fills");
