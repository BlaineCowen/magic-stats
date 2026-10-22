import { clamp01, type Entry, type Side } from "./optimizer";
import type { PickemGame, PickemWeek } from "./scoreboard";
import { tally, type Tally } from "./tally";

/**
 * A pool's week: every member's standing, each member's chance to win the
 * week, and how many members picked each side of every game. Runs on the
 * server, which sees all entries; only picks for games that have kicked off
 * (or the viewer's own) are passed back when the pool hides picks.
 */

export type MemberRow = Tally & {
  user: string;
  /** Games picked out of the week. */
  picked: number;
  /** Chance to finish first this week (ties split). */
  winProb: number;
  /** Picks the viewer may see: [gameId] -> [side, points]. */
  visible: Record<string, [Side, number]>;
};

export type PoolWeek = {
  rows: MemberRow[];
  /** How the other members picked each game, for the optimizer. */
  counts: Record<string, { home: number; away: number }>;
};

/** Chance the home team wins from here: settled, live, or Vegas. */
function homeChance(g: PickemGame): number {
  if (g.final && g.home.score !== null && g.away.score !== null) {
    return g.home.score > g.away.score
      ? 1
      : g.home.score < g.away.score
        ? 0
        : 0.5;
  }
  if (g.state === "in" && g.liveHome !== null) return g.liveHome;
  return g.pHome;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poolWeek(
  week: PickemWeek,
  members: { user: string; entry: Entry | null }[],
  viewer: string,
  hidePicks: boolean,
  started: Set<string>,
  sims = 5000,
): PoolWeek {
  const games = week.games;
  const counts: PoolWeek["counts"] = {};
  for (const g of games) counts[g.id] = { home: 0, away: 0 };
  for (const m of members) {
    if (m.user === viewer || !m.entry) continue;
    for (const g of games) {
      const p = m.entry.picks[g.id];
      if (p) counts[g.id]![p]++;
    }
  }

  // Simulate the week from here: each unsettled game by its current chance.
  const probs = games.map((g) => clamp01(homeChance(g), 0));
  const wins = new Float64Array(members.length);
  const rand = rng(week.week * 7919 + members.length);
  const score = new Float64Array(members.length);
  for (let s = 0; s < sims; s++) {
    score.fill(0);
    games.forEach((g, i) => {
      const p = probs[i]!;
      const homeWon = p >= 1 ? true : p <= 0 ? false : rand() < p;
      members.forEach((m, k) => {
        const pick = m.entry?.picks[g.id];
        if (pick && (pick === "home") === homeWon)
          score[k] = score[k]! + (m.entry!.points[g.id] ?? 0);
      });
    });
    let best = -1;
    let ties = 0;
    for (const v of score) {
      if (v > best) {
        best = v;
        ties = 1;
      } else if (v === best) ties++;
    }
    score.forEach((v, k) => {
      if (v === best) wins[k] = wins[k]! + 1 / ties;
    });
  }

  const rows = members.map((m, k): MemberRow => {
    const e: Entry = m.entry ?? { picks: {}, points: {} };
    const visible: MemberRow["visible"] = {};
    for (const g of games) {
      const p = e.picks[g.id];
      if (!p) continue;
      if (m.user === viewer || !hidePicks || started.has(g.id))
        visible[g.id] = [p, e.points[g.id] ?? 0];
    }
    return {
      ...tally(games, e),
      user: m.user,
      picked: games.filter((g) => e.picks[g.id]).length,
      winProb: members.length ? wins[k]! / sims : 0,
      visible,
    };
  });
  rows.sort(
    (a, b) =>
      b.banked + b.winning - (a.banked + a.winning) || b.expected - a.expected,
  );
  return { rows, counts };
}
