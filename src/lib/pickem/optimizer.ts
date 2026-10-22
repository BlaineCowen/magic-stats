/**
 * Confidence pool math, ported from the original /nfl/pickem assistant.
 *
 * A confidence pool: pick every game, give each pick a distinct point value
 * (n for your surest game down to 1), and score the points of the picks you
 * get right. Ranking purely by win probability maximises expected points, but
 * the pool only pays the winner, so fading a popular pick can raise your
 * chance of finishing first: when the crowd is wrong you pass all of them at
 * once. The optimizer simulates the pool (game outcomes from Vegas, opponents'
 * picks from how your office actually picked) and hill-climbs flips and point
 * swaps to maximise P(win the pool).
 */

export type Side = "home" | "away";

/** What the optimizer needs per game. */
export type OptGame = {
  id: string;
  /** Chance the home team wins. */
  pHome: number;
  /** Share of your office picking the home team (defaults to pHome). */
  officeHomeShare: number;
};

export type Entry = {
  picks: Record<string, Side>;
  /** n = most confident ... 1 = least. */
  points: Record<string, number>;
};

/** American odds to implied probability. */
export function mlToProb(ml: number): number {
  if (ml === 0) return 0.5;
  return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
}

/** Standard normal CDF (Abramowitz-Stegun erf). */
export function normCdf(x: number): number {
  const z = x / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * Math.abs(z));
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + (z >= 0 ? erf : -erf));
}

/**
 * Home win probability: de-vigged moneylines when both are posted, else the
 * spread (NFL margins are roughly normal with sd ~13.86), else a coin flip.
 * `spread` is the home line: negative means home is favoured.
 */
export function winProb(
  homeMl: number | null,
  awayMl: number | null,
  spread: number | null,
): { pHome: number; source: "moneyline" | "spread" | "none" } {
  if (homeMl !== null && awayMl !== null) {
    const h = mlToProb(homeMl);
    const a = mlToProb(awayMl);
    const sum = h + a;
    return {
      pHome: Number.isFinite(sum) && sum > 0 ? h / sum : 0.5,
      source: "moneyline",
    };
  }
  if (spread !== null)
    return { pHome: normCdf(-spread / 13.86), source: "spread" };
  return { pHome: 0.5, source: "none" };
}

export const clamp01 = (p: number, eps = 0.001) =>
  Math.min(1 - eps, Math.max(eps, p));

/** Straight-odds entry: pick every favourite, most points on the surest. */
export function rankByOdds(games: OptGame[]): Entry {
  const n = games.length;
  const picks: Record<string, Side> = {};
  const points: Record<string, number> = {};
  [...games]
    .map((g) => ({ g, p: Math.max(g.pHome, 1 - g.pHome) }))
    .sort((a, b) => b.p - a.p)
    .forEach(({ g }, rank) => {
      picks[g.id] = g.pHome >= 0.5 ? "home" : "away";
      points[g.id] = n - rank;
    });
  return { picks, points };
}

/** Small fast seeded PRNG (mulberry32) so a run is repeatable. */
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

type Sims = {
  sims: number;
  n: number;
  /** outcomes[s*n+i] = 1 if the home team won game i in sim s. */
  outcomes: Uint8Array;
  /** Best opponent score per sim and how many opponents tied on it. */
  oppMax: Int32Array;
  oppMaxCount: Int32Array;
};

/**
 * Simulate games and the other `poolSize - 1` entries. Each opponent picks a
 * side per game in proportion to the office split and orders confidence by
 * how lopsided the office is on that game, plus noise.
 */
function simulate(
  games: OptGame[],
  poolSize: number,
  sims: number,
  noise: number,
  seed: number,
): Sims {
  const n = games.length;
  const opps = Math.max(0, poolSize - 1);
  const rand = rng(seed);
  const pH = Float64Array.from(games, (g) => clamp01(g.pHome));
  const oH = Float64Array.from(games, (g) => clamp01(g.officeHomeShare));
  const lean = Float64Array.from(oH, (p) => Math.abs(p - 0.5));
  const outcomes = new Uint8Array(sims * n);
  const oppMax = new Int32Array(sims);
  const oppMaxCount = new Int32Array(sims);
  const pick = new Uint8Array(n);
  const conf = new Float64Array(n);
  const order = new Int32Array(n);
  for (let s = 0; s < sims; s++) {
    const base = s * n;
    for (let i = 0; i < n; i++) outcomes[base + i] = rand() < pH[i]! ? 1 : 0;
    let best = -1;
    let ties = 0;
    for (let o = 0; o < opps; o++) {
      for (let i = 0; i < n; i++) {
        pick[i] = rand() < oH[i]! ? 1 : 0;
        // Box-Muller normal noise on top of the office's lean.
        const u = rand();
        conf[i] =
          lean[i]! +
          Math.sqrt(-2 * Math.log(1 - u)) *
            Math.cos(2 * Math.PI * rand()) *
            noise;
        order[i] = i;
      }
      // Insertion sort by confidence, descending (n is ~16).
      for (let i = 1; i < n; i++) {
        const k = order[i]!;
        const v = conf[k]!;
        let j = i - 1;
        while (j >= 0 && conf[order[j]!]! < v) {
          order[j + 1] = order[j]!;
          j--;
        }
        order[j + 1] = k;
      }
      let score = 0;
      for (let r = 0; r < n; r++) {
        const i = order[r]!;
        if (pick[i] === outcomes[base + i]) score += n - r;
      }
      if (score > best) {
        best = score;
        ties = 1;
      } else if (score === best) ties++;
    }
    oppMax[s] = best;
    oppMaxCount[s] = ties;
  }
  return { sims, n, outcomes, oppMax, oppMaxCount };
}

/** P(finish first) for an entry, splitting ties evenly. */
function poolWinProb(
  sim: Sims,
  pickHome: Uint8Array,
  points: Int32Array,
): number {
  let wins = 0;
  for (let s = 0; s < sim.sims; s++) {
    const base = s * sim.n;
    let score = 0;
    for (let i = 0; i < sim.n; i++)
      if (pickHome[i] === sim.outcomes[base + i]) score += points[i]!;
    const best = sim.oppMax[s]!;
    if (score > best) wins += 1;
    else if (score === best) wins += 1 / (1 + sim.oppMaxCount[s]!);
  }
  return wins / sim.sims;
}

function toArrays(games: OptGame[], e: Entry) {
  const n = games.length;
  const pickHome = new Uint8Array(n);
  const points = new Int32Array(n);
  games.forEach((g, i) => {
    pickHome[i] = e.picks[g.id] === "home" ? 1 : 0;
    points[i] = e.points[g.id] ?? n - i;
  });
  return { pickHome, points };
}

export type GameResult = {
  gameId: string;
  pick: Side;
  points: number;
  /** The straight-odds pick, to flag fades. */
  evPick: Side;
  /** Chance your pick wins, and the share of your office on it. */
  pPick: number;
  officeSharePick: number;
  /** pPick - officeSharePick: positive = the crowd underrates your side. */
  leverage: number;
  faded: boolean;
};

export type OptimizeResult = {
  entry: Entry;
  evEntry: Entry;
  winProb: number;
  evWinProb: number;
  perGame: GameResult[];
  /** True when hedging couldn't beat the straight-odds entry. */
  usedBaseline: boolean;
};

/**
 * Hill-climb from the straight-odds entry: each round tries every pick flip
 * and every pair swap of points (pinned games stay put) and keeps the best
 * improvement, then re-scores the result and the baseline on fresh sims so
 * the reported chance isn't overfit to the search sims.
 */
export function optimize(
  games: OptGame[],
  poolSize: number,
  opts: {
    sims?: number;
    finalSims?: number;
    noise?: number;
    seed?: number;
    maxRounds?: number;
    pinned?: Set<string>;
    current?: Entry;
  } = {},
): OptimizeResult {
  const {
    sims = 6000,
    finalSims = 20000,
    noise = 0.15,
    seed = 12345,
    maxRounds = 25,
    pinned = new Set<string>(),
  } = opts;
  const n = games.length;
  const ev = rankByOdds(games);
  const start: Entry = { picks: { ...ev.picks }, points: { ...ev.points } };
  // Pinned games keep the pick and points you gave them; the rest take the
  // remaining point values in straight-odds order.
  if (opts.current && pinned.size) {
    const cur = opts.current;
    const held = games.filter(
      (g) => pinned.has(g.id) && cur.picks[g.id] && cur.points[g.id],
    );
    const used = new Set<number>();
    for (const g of held) {
      start.picks[g.id] = cur.picks[g.id]!;
      start.points[g.id] = cur.points[g.id]!;
      used.add(cur.points[g.id]!);
    }
    const free = Array.from({ length: n }, (_, i) => n - i).filter(
      (v) => !used.has(v),
    );
    games
      .filter((g) => !held.includes(g))
      .sort((a, b) => ev.points[b.id]! - ev.points[a.id]!)
      .forEach((g, i) => {
        start.points[g.id] = free[i]!;
      });
  }
  if (n === 0 || poolSize <= 1) {
    return {
      entry: start,
      evEntry: ev,
      winProb: poolSize <= 1 ? 1 : 0,
      evWinProb: poolSize <= 1 ? 1 : 0,
      perGame: [],
      usedBaseline: true,
    };
  }

  const sim = simulate(games, poolSize, sims, noise, seed);
  const { pickHome, points } = toArrays(games, start);
  const fixed = games.map((g) => pinned.has(g.id));
  let score = poolWinProb(sim, pickHome, points);
  for (let round = 0; round < maxRounds; round++) {
    let best = score;
    let move: { flip: number } | { a: number; b: number } | null = null;
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      pickHome[i] = pickHome[i]! ^ 1;
      const s = poolWinProb(sim, pickHome, points);
      pickHome[i] = pickHome[i]! ^ 1;
      if (s > best) {
        best = s;
        move = { flip: i };
      }
    }
    for (let a = 0; a < n; a++) {
      if (fixed[a]) continue;
      for (let b = a + 1; b < n; b++) {
        if (fixed[b]) continue;
        [points[a], points[b]] = [points[b]!, points[a]!];
        const s = poolWinProb(sim, pickHome, points);
        [points[a], points[b]] = [points[b]!, points[a]!];
        if (s > best) {
          best = s;
          move = { a, b };
        }
      }
    }
    if (!move) break;
    if ("flip" in move) pickHome[move.flip] = pickHome[move.flip]! ^ 1;
    else [points[move.a], points[move.b]] = [points[move.b]!, points[move.a]!];
    score = best;
  }

  const found: Entry = { picks: {}, points: {} };
  games.forEach((g, i) => {
    found.picks[g.id] = pickHome[i] ? "home" : "away";
    found.points[g.id] = points[i]!;
  });
  const check = simulate(games, poolSize, finalSims, noise, seed + 1);
  const f = toArrays(games, found);
  const b = toArrays(games, start);
  let winP = poolWinProb(check, f.pickHome, f.points);
  const baseP = poolWinProb(check, b.pickHome, b.points);
  let entry = found;
  let usedBaseline = false;
  if (baseP >= winP) {
    entry = start;
    winP = baseP;
    usedBaseline = true;
  }
  const perGame = games.map((g) => {
    const pick = entry.picks[g.id] ?? "home";
    const evPick = ev.picks[g.id] ?? "home";
    const pPick = pick === "home" ? g.pHome : 1 - g.pHome;
    const officeSharePick =
      pick === "home" ? g.officeHomeShare : 1 - g.officeHomeShare;
    return {
      gameId: g.id,
      pick,
      points: entry.points[g.id] ?? 0,
      evPick,
      pPick,
      officeSharePick,
      leverage: pPick - officeSharePick,
      faded: pick !== evPick,
    };
  });
  return {
    entry,
    evEntry: ev,
    winProb: winP,
    evWinProb: baseP,
    perGame,
    usedBaseline,
  };
}
