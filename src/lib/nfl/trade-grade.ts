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

export type SampleKind = "1-for-1" | "2-for-1" | "1-for-2" | "2-for-2" | "throw-in";
export const SAMPLE_KINDS: SampleKind[] = ["1-for-1", "2-for-1", "1-for-2", "2-for-2", "throw-in"];

export type SampleTrade = {
  kind: SampleKind;
  give: ValuedPlayer[]; // from your roster
  get: ValuedPlayer[]; // the target, plus one more of the owner's players for 1-for-2 / 2-for-2 / throw-in
  result: TradeResult; // side A = you
  /** Your adjusted value minus theirs, as a share of the bigger side: below 0 = you pay more. */
  edge: number;
  /** With the league's lineup slots: how each starting lineup changes, and where incoming players go. */
  lineup?: {
    yourGain: number;
    theirGain: number;
    /** Incoming player id -> the slot he'd start in, or null for the bench. */
    yourSlots: Record<string, string | null>;
    theirSlots: Record<string, string | null>;
  };
};

// Which positions each Sleeper lineup slot takes. Kickers, defenses and IDP slots are ignored.
const SLOT_POS: Record<string, string[]> = {
  QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"],
  WRRB_FLEX: ["RB", "WR"], REC_FLEX: ["WR", "TE"], FLEX: ["RB", "WR", "TE"], SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};
// Bench players count a little: they start through byes and injuries. Same as the trade ideas page.
const BENCH_WEIGHT = 0.2;
const BENCH_DEPTH = 3;

/**
 * A roster's best lineup for these slots and its strength: starters' values plus a little for the
 * next few bench players. Filling narrow slots first, then wider flex slots, is optimal because
 * each later slot accepts everything an earlier one does.
 */
export function bestLineup(players: ValuedPlayer[], slots: string[]): { strength: number; slotOf: Map<string, string> } {
  const order = slots.filter((x) => SLOT_POS[x]).sort((a, b) => SLOT_POS[a]!.length - SLOT_POS[b]!.length);
  const pool = players.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
  const slotOf = new Map<string, string>();
  let strength = 0;
  for (const slot of order) {
    const hit = pool.find((p) => !slotOf.has(p.id) && SLOT_POS[slot]!.includes(p.pos));
    if (!hit) continue;
    slotOf.set(hit.id, slot);
    strength += hit.value;
  }
  const bench = pool.filter((p) => !slotOf.has(p.id)).slice(0, BENCH_DEPTH);
  strength += BENCH_WEIGHT * bench.reduce((t, p) => t + p.value, 0);
  return { strength, slotOf };
}

// A sample has to be one the other team could say yes to: they lose by at most FAIR, and you
// overpay by at most OVERPAY.
const OVERPAY = 0.15;

/**
 * Ways to get `target` from the team that rosters him, built only from real rosters:
 * one of yours for him, two of yours for him, and one of yours for him plus another of theirs:
 * "1-for-2" when the other piece is worth less than him (he's the main piece), "throw-in" when
 * it's worth more (a bigger deal he rides along in, often the only way to get a cheap player),
 * and two of yours for him plus another of theirs ("2-for-2").
 * `mine` and `theirs` are the two full rosters' valued players. With `slots`, an idea only counts if
 * the other team's best lineup gets better: nobody takes two tight ends to sit behind the league's
 * best one. Each of your players shows up at most
 * once per kind, so the ideas differ; within a kind the most even trades come first.
 */
export function sampleTrades(
  target: ValuedPlayer, mine: ValuedPlayer[], theirs: ValuedPlayer[], pool: ValuedPlayer[], s: Settings, perKind = 3,
  /** The league's lineup slots (Sleeper roster_positions). Given, a trade has to make their lineup better. */
  slots?: string[],
): SampleTrade[] {
  const yours = mine.filter((p) => p.id !== target.id && p.value > 0);
  const others = theirs.filter((p) => p.id !== target.id && p.value > 0);
  const candidates: Omit<SampleTrade, "result" | "edge">[] = [];
  for (const m of yours) {
    candidates.push({ kind: "1-for-1", give: [m], get: [target] });
    for (const x of others) candidates.push({ kind: x.value <= target.value ? "1-for-2" : "throw-in", give: [m], get: [target, x] });
  }
  // Two for one is a consolidation: each piece alone is worth less than the target.
  const smaller = yours.filter((p) => p.value < target.value);
  for (let i = 0; i < smaller.length; i++)
    for (let j = i + 1; j < smaller.length; j++)
      candidates.push({ kind: "2-for-1", give: [smaller[i]!, smaller[j]!], get: [target] });
  for (let i = 0; i < yours.length; i++)
    for (let j = i + 1; j < yours.length; j++)
      for (const x of others) candidates.push({ kind: "2-for-2", give: [yours[i]!, yours[j]!], get: [target, x] });

  const youBefore = slots ? bestLineup(mine, slots) : null;
  const themBefore = slots ? bestLineup(theirs, slots) : null;
  const scored: SampleTrade[] = [];
  for (const c of candidates) {
    const result = gradeTrade(c.get, c.give, pool, s);
    if (!result) continue;
    const big = Math.max(result.a.adjusted, result.b.adjusted) || 1;
    const edge = (result.a.adjusted - result.b.adjusted) / big;
    if (edge > FAIR || edge < -OVERPAY) continue;
    let lineup: SampleTrade["lineup"];
    if (slots) {
      const out = new Set(c.give.map((p) => p.id)), inn = new Set(c.get.map((p) => p.id));
      const youAfter = bestLineup([...mine.filter((p) => !out.has(p.id)), ...c.get], slots);
      const themAfter = bestLineup([...theirs.filter((p) => !inn.has(p.id)), ...c.give], slots);
      const theirGain = themAfter.strength - themBefore!.strength;
      if (theirGain <= 0) continue;
      const where = (ids: ValuedPlayer[], l: { slotOf: Map<string, string> }) =>
        Object.fromEntries(ids.map((p) => [p.id, l.slotOf.get(p.id) ?? null]));
      lineup = {
        yourGain: youAfter.strength - youBefore!.strength, theirGain,
        yourSlots: where(c.get, youAfter), theirSlots: where(c.give, themAfter),
      };
    }
    scored.push({ ...c, result, edge, lineup });
  }
  scored.sort((x, y) => Math.abs(x.edge) - Math.abs(y.edge));

  const out: SampleTrade[] = [];
  for (const kind of SAMPLE_KINDS) {
    const used = new Set<string>();
    for (const t of scored) {
      if (t.kind !== kind) continue;
      if (t.give.some((p) => used.has(p.id))) continue;
      t.give.forEach((p) => used.add(p.id));
      out.push(t);
      if (out.filter((o) => o.kind === kind).length >= perKind) break;
    }
  }
  return out;
}
