import fs from "node:fs/promises";
import path from "node:path";
import { NFL_DATA_DIR } from "@/lib/nfl/db";

/**
 * Trade ideas for H-Town Ballers, written each morning by scripts/trades/find_trades.py.
 * The file holds two lists per team: "etr" (judged by ETR's values, for Blaine) and "market"
 * (judged by the FantasyCalc market, for everyone). loadTrades picks one and, for anyone but
 * Blaine, drops the other list and everything under a `numbers` key on the server, so neither
 * reaches their browser.
 */

export type Audience = "owner" | "friends";
type View = "etr" | "market";

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

export type Trade = {
  id: number;
  view: View;
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

type TeamView = { need: string[]; surplus: string[]; trades: number[] };

type TradeFile = {
  generated: string;
  etrFileDate: string | null;
  league: { name: string; week: number | null; tradeDeadline: number | null };
  teams: {
    rosterId: number;
    owner: string;
    teamName: string | null;
    record: string;
    views: Record<View, TeamView>;
    numbers: { strength: Record<View, number> };
  }[];
  trades: Trade[];
  players: Record<string, TradePlayer>;
};

export type TradeTeam = TeamView & {
  rosterId: number;
  owner: string;
  teamName: string | null;
  record: string;
  strength?: number;
};

export type TradeData = Omit<TradeFile, "teams" | "trades"> & {
  teams: TradeTeam[];
  trades: Record<number, Trade>;
};

export async function loadTrades(
  audience: Audience,
): Promise<TradeData | null> {
  let file: TradeFile;
  try {
    file = JSON.parse(
      await fs.readFile(path.join(NFL_DATA_DIR, "trades.json"), "utf8"),
    ) as TradeFile;
  } catch {
    return null;
  }
  const owner = audience === "owner";
  const view: View = owner ? "etr" : "market";
  const trades = file.trades.filter((t) => t.view === view);
  const used = new Set(trades.flatMap((t) => t.sides.flatMap((s) => s.gives)));
  return {
    generated: file.generated,
    etrFileDate: file.etrFileDate,
    league: file.league,
    teams: file.teams.map((t) => ({
      rosterId: t.rosterId,
      owner: t.owner,
      teamName: t.teamName,
      record: t.record,
      ...t.views[view],
      ...(owner ? { strength: t.numbers.strength[view] } : {}),
    })),
    trades: Object.fromEntries(
      trades.map(({ numbers, ...t }) => [t.id, owner ? { ...t, numbers } : t]),
    ),
    players: Object.fromEntries(
      Object.entries(file.players)
        .filter(([id]) => used.has(id))
        .map(([id, { numbers, ...p }]) => [id, owner ? { ...p, numbers } : p]),
    ),
  };
}
