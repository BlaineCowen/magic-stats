import fs from "node:fs/promises";
import path from "node:path";
import { NFL_DATA_DIR } from "@/lib/nfl/db";

/**
 * Trade ideas for H-Town Ballers, written each morning by scripts/trades/find_trades.py.
 * Everything under a `numbers` key is for Blaine only: loadTrades strips it on the server
 * for anyone else, so the values never reach their browser.
 */

type TeamNumbers = { strength: number };
type TradeNumbers = {
  gain: [number, number];
  ours: [number, number];
  market: [number, number];
};
type PlayerNumbers = {
  ours: number | null;
  market: number | null;
  etrRank: number | null;
};

export type TradeSide = {
  rosterId: number;
  gives: string[];
  gets: string[];
  why: string;
};

export type TradeTeam = {
  rosterId: number;
  owner: string;
  teamName: string | null;
  record: string;
  need: string[];
  surplus: string[];
  trades: number[];
  numbers?: TeamNumbers;
};

export type Trade = {
  id: number;
  sides: [TradeSide, TradeSide];
  numbers?: TradeNumbers;
};

export type TradePlayer = {
  name: string;
  pos: string;
  team: string;
  injury: string | null;
  numbers?: PlayerNumbers;
};

export type TradeData = {
  generated: string;
  etrFileDate: string | null;
  league: { name: string; week: number | null; tradeDeadline: number | null };
  teams: TradeTeam[];
  trades: Trade[];
  players: Record<string, TradePlayer>;
};

export async function loadTrades(
  withNumbers: boolean,
): Promise<TradeData | null> {
  let data: TradeData;
  try {
    data = JSON.parse(
      await fs.readFile(path.join(NFL_DATA_DIR, "trades.json"), "utf8"),
    ) as TradeData;
  } catch {
    return null;
  }
  if (withNumbers) return data;
  return {
    ...data,
    teams: data.teams.map(({ numbers: _, ...t }) => t),
    trades: data.trades.map(({ numbers: _, ...t }) => t),
    players: Object.fromEntries(
      Object.entries(data.players).map(([id, { numbers: _, ...p }]) => [id, p]),
    ),
  };
}
