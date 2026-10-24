/**
 * Grades a fantasy trade from market values (FantasyCalc, for the league's settings).
 *
 * Two corrections on top of adding up values:
 *  - Stars are worth more than the sum of smaller pieces: each value is bent by STAR_CURVE
 *    against the best player in the pool, so two 50% players add up to about 81% of one star.
 *  - Roster spots: the side that gets fewer players frees spots it can fill from waivers, so it
 *    is credited a replacement-level player for each.
 */

export type Settings = {
  dynasty: boolean;
  teams: number; // 8-16
  qbs: 1 | 2; // 2 = superflex / 2QB
  ppr: 0 | 0.5 | 1;
  tep: 0 | 0.5 | 1; // extra points per TE catch
};

export type ValuedPlayer = {
  id: string;
  name: string;
  pos: string;
  team: string | null;
  age: number | null;
  value: number;
};

export const DEFAULT_SETTINGS: Settings = { dynasty: false, teams: 12, qbs: 1, ppr: 1, tep: 0 };

const STAR_CURVE = 1.3;
// Rostered players per team before the next one is a waiver pickup.
const DEPTH = { redraft: 14, dynasty: 24 };

/** FantasyCalc has no TE premium setting; scale TEs up by about what a TE catch bonus adds. */
export function withTePremium(players: ValuedPlayer[], tep: Settings["tep"]): ValuedPlayer[] {
  if (!tep) return players;
  const k = 1 + 0.3 * tep;
  return players
    .map((p) => (p.pos === "TE" ? { ...p, value: Math.round(p.value * k) } : p))
    .sort((a, b) => b.value - a.value);
}

export type SideResult = {
  raw: number; // plain sum of values received
  adjusted: number; // after the star curve and roster spot credit
  spotCredit: number;
  grade: string;
};

export type TradeResult = {
  a: SideResult; // what side A receives
  b: SideResult;
  /** Gap as a share of the bigger side, 0-1. */
  gap: number;
  winner: "a" | "b" | null; // null = fair
  /** Adjusted value the winning side should add to make it fair. */
  balanceNeeded: number;
};

export function curve(value: number, top: number): number {
  if (top <= 0 || value <= 0) return 0;
  return top * Math.pow(value / top, STAR_CURVE);
}

/** Value of the first player past what a league rosters: what an open roster spot is worth. */
export function replacementValue(pool: ValuedPlayer[], s: Settings): number {
  const rank = s.teams * (s.dynasty ? DEPTH.dynasty : DEPTH.redraft);
  const players = pool.filter((p) => p.pos !== "PICK");
  return players[Math.min(rank, players.length - 1)]?.value ?? 0;
}

const FAIR = 0.05;

/** Letter grade for one side, from what it gets over what it gives (adjusted). */
export function letter(ratio: number): string {
  if (ratio >= 1.25) return "A+";
  if (ratio >= 1.1) return "A";
  if (ratio >= 1 / (1 - FAIR)) return "A-";
  if (ratio >= 1 - FAIR) return "B+";
  if (ratio >= 0.88) return "B-";
  if (ratio >= 0.78) return "C";
  if (ratio >= 0.65) return "D";
  return "F";
}

/**
 * aGets / bGets: the players each side RECEIVES. `pool` is every valued player for these
 * settings, best first (it sets the star curve and replacement level).
 */
export function gradeTrade(aGets: ValuedPlayer[], bGets: ValuedPlayer[], pool: ValuedPlayer[], s: Settings): TradeResult | null {
  if (!aGets.length || !bGets.length) return null;
  const top = pool[0]?.value ?? Math.max(...aGets.map((p) => p.value), ...bGets.map((p) => p.value));
  const repl = curve(replacementValue(pool, s), top);
  const side = (gets: ValuedPlayer[], other: ValuedPlayer[]) => {
    const spots = Math.max(0, other.length - gets.length);
    const spotCredit = spots * repl;
    return {
      raw: gets.reduce((t, p) => t + p.value, 0),
      adjusted: gets.reduce((t, p) => t + curve(p.value, top), 0) + spotCredit,
      spotCredit,
    };
  };
  const a = side(aGets, bGets), b = side(bGets, aGets);
  const big = Math.max(a.adjusted, b.adjusted);
  const gap = big > 0 ? Math.abs(a.adjusted - b.adjusted) / big : 0;
  const winner = gap < FAIR ? null : a.adjusted > b.adjusted ? "a" : "b";
  return {
    a: { ...a, grade: letter(b.adjusted ? a.adjusted / b.adjusted : 2) },
    b: { ...b, grade: letter(a.adjusted ? b.adjusted / a.adjusted : 2) },
    gap,
    winner,
    balanceNeeded: Math.abs(a.adjusted - b.adjusted),
  };
}

/**
 * Players whose value (alone) closes the gap: the winning side adds one of them to what it
 * gives. Excludes players already in the trade.
 */
export function balancers(r: TradeResult, pool: ValuedPlayer[], inTrade: Set<string>, n = 5): ValuedPlayer[] {
  if (!r.winner || !pool.length) return [];
  const top = pool[0]!.value;
  // A player added to the losing side's haul. Adding a piece also changes roster spot credit,
  // which is small next to the gap; ignore it here.
  const want = r.balanceNeeded;
  return pool
    .filter((p) => !inTrade.has(p.id) && curve(p.value, top) <= want * 1.15)
    .sort((x, y) => Math.abs(curve(x.value, top) - want) - Math.abs(curve(y.value, top) - want))
    .slice(0, n)
    .sort((x, y) => y.value - x.value);
}
