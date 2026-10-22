import type { Entry, Side } from "@/lib/pickem/optimizer";
import type { PickemGame } from "@/lib/pickem/scoreboard";

export type PickStatus =
  | "pre"
  | "winning"
  | "losing"
  | "tied"
  | "won"
  | "lost"
  | "push";

/** Where your pick stands right now. */
export function pickStatus(g: PickemGame, pick: Side): PickStatus {
  if (g.state === "pre" || g.home.score === null || g.away.score === null)
    return "pre";
  const lead = g.home.score - g.away.score;
  const mine = pick === "home" ? lead : -lead;
  if (g.final) return mine > 0 ? "won" : mine < 0 ? "lost" : "push";
  return mine > 0 ? "winning" : mine < 0 ? "losing" : "tied";
}

/** Chance your pick wins: settled when final, ESPN's live number in play, else Vegas. */
export function pickChance(g: PickemGame, pick: Side): number {
  const s = pickStatus(g, pick);
  if (s === "won") return 1;
  if (s === "lost" || s === "push") return 0;
  const home = g.state === "in" && g.liveHome !== null ? g.liveHome : g.pHome;
  return pick === "home" ? home : 1 - home;
}

export type Tally = {
  banked: number;
  lost: number;
  winning: number;
  losing: number;
  toPlay: number;
  expected: number;
  max: number;
  started: boolean;
};

export function tally(games: PickemGame[], e: Entry): Tally {
  const t: Tally = {
    banked: 0,
    lost: 0,
    winning: 0,
    losing: 0,
    toPlay: 0,
    expected: 0,
    max: 0,
    started: false,
  };
  for (const g of games) {
    const pick = e.picks[g.id];
    const pts = e.points[g.id] ?? 0;
    if (!pick) continue;
    const s = pickStatus(g, pick);
    if (s !== "pre") t.started = true;
    if (s === "won") t.banked += pts;
    else if (s === "lost" || s === "push") t.lost += pts;
    else if (s === "winning") t.winning += pts;
    else if (s === "losing") t.losing += pts;
    else t.toPlay += pts;
    t.expected += pts * pickChance(g, pick);
  }
  t.max = t.banked + t.winning + t.losing + t.toPlay;
  return t;
}
