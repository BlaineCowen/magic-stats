import {
  loadJson,
  predictBinary,
  predictSoftmax,
  rowFor,
  type XgbModel,
} from "./xgb";

/**
 * 4th down decision engine, after Ben Baldwin's nfl4th: value each choice (go, field goal, punt) as
 * the offense's win probability, averaging the WP model over every outcome each choice can produce.
 *
 * Differences from nfl4th, each checked against held-out seasons (see scripts/fourth-down):
 * - kickoffs after scores start where they actually start that season (the 30 since 2024, not the 25)
 * - punt outcomes come from the next snap, so penalties, muffs, blocks and return TDs are all in, and
 *   the table covers every yardline (nfl4th's has block and return-TD rates swapped and stops at the 30)
 * - the go-for-it model trains on 2006-2025 incl. playoffs (fakes excluded), with a post-2022 era term
 *   and deeper trees that can tell real 4th down attempts from 3rd downs
 * - the field goal model knows temperature and wind
 * - the result says how sure it is and what conversion rate would make going right
 */

export type Roof = "outdoors" | "dome" | "retractable";

export type Situation = {
  season: number;
  qtr: 1 | 2 | 3 | 4;
  /** seconds left in the quarter */
  clock: number;
  /** offense score minus defense score */
  scoreDiff: number;
  ydstogo: number;
  /** yards from the opponent's end zone (1-99) */
  yardline: number;
  offTimeouts: number;
  defTimeouts: number;
  /** 1 = offense is the home team (Super Bowls use the designated home team) */
  home: 0 | 1;
  /** offense's expected margin from the betting line: +3 = favored by 3 */
  spread: number;
  total: number;
  roof: Roof;
  temp?: number | null;
  wind?: number | null;
  /** does the offense receive the second-half kickoff? (ignored after halftime) */
  receive2h: boolean;
};

type State = {
  season: number;
  gameSec: number;
  diff: number;
  down: number;
  ydstogo: number;
  yl: number;
  toOff: number;
  toDef: number;
  home: 0 | 1;
  spread: number;
  total: number;
  recv2h: boolean;
};

export type OptionKey = "go" | "fg" | "punt";

export type Option = {
  key: OptionKey;
  wp: number;
  /** go: conversion probability; fg: make probability; punt: null */
  successProb: number | null;
  wpSuccess: number | null;
  wpFail: number | null;
  detail: Record<string, number>;
};

export type Decision = {
  situation: Situation;
  wpNow: number;
  options: Option[];
  best: OptionKey;
  /** best minus second-best WP, in percentage points */
  gap: number;
  strength: "toss-up" | "lean" | "strong" | "very strong" | "no-brainer";
  /** conversion rate at which going matches the best kick; null if going can't catch up */
  breakeven: number | null;
  /** go-for-it yards-gained distribution, gains -10..65 */
  goGains: number[];
};

const PLAY_SEC = { go: 6, fg: 5, punt: 8 };
const TWO_PT = 0.48;
// last season with play-by-play is reused for later seasons
const KICKOFF_YL: [number, number][] = [
  [1999, 71.6],
  [2006, 72.5],
  [2009, 73.5],
  [2011, 77.5],
  [2016, 74.6],
  [2024, 69.6],
];

export function kickoffYardline(season: number): number {
  let yl = KICKOFF_YL[0]![1];
  for (const [s, v] of KICKOFF_YL) if (season >= s) yl = v;
  return yl;
}

const patProb = (season: number) => (season >= 2015 ? 0.942 : 0.988);

const models = () => ({
  wp: loadJson<XgbModel>("wp.json"),
  go: loadJson<XgbModel>("go.json"),
  fg: loadJson<XgbModel>("fg.json"),
  punt: loadJson<Record<string, [string, number, number][]>>("punt.json"),
});

// timeouts the defense has -> seconds below which a leading offense can kneel out the game
const KNEEL_SEC = [120, 80, 40, 0];

/** Offense's win probability at the snap described by `s`. */
export function wpOf(s: State): number {
  if (s.gameSec <= 0) return s.diff > 0 ? 1 : s.diff < 0 ? 0 : 0.5;
  if (
    s.diff > 0 &&
    s.down === 1 &&
    s.gameSec < KNEEL_SEC[Math.min(3, s.toDef)]!
  )
    return 1;
  const elapsed = (3600 - s.gameSec) / 3600;
  const decay = Math.exp(-4 * elapsed);
  const halfSec = s.gameSec > 1800 ? s.gameSec - 1800 : s.gameSec;
  const { wp } = models();
  return predictBinary(
    wp,
    rowFor(wp, {
      receive_2h_ko: s.gameSec > 1800 && s.recv2h ? 1 : 0,
      spread_time: s.spread * decay,
      home: s.home,
      half_seconds_remaining: halfSec,
      game_seconds_remaining: s.gameSec,
      diff_time_ratio: s.diff / decay,
      score_differential: s.diff,
      down: s.down,
      ydstogo: s.ydstogo,
      yardline_100: s.yl,
      posteam_timeouts_remaining: s.toOff,
      defteam_timeouts_remaining: s.toDef,
    }),
  );
}

function flipped(s: State): State {
  return {
    ...s,
    diff: -s.diff,
    toOff: s.toDef,
    toDef: s.toOff,
    home: s.home === 1 ? 0 : 1,
    spread: -s.spread,
    recv2h: !s.recv2h,
  };
}

/**
 * Offense WP once a play has used `sec` seconds and someone has a fresh 1st down.
 * `offenseBall` says who; `yl` is from that team's perspective; `diffDelta` changes the offense's margin.
 */
function nextSnap(
  s: State,
  sec: number,
  offenseBall: boolean,
  yl: number,
  diffDelta: number,
): number {
  const diff = s.diff + diffDelta;
  const gameSec = s.gameSec - sec;
  if (gameSec <= 0) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  if (s.gameSec > 1800 && gameSec <= 1800) {
    // half ends before the next snap: second-half kickoff, timeouts reset
    const ko = kickoffYardline(s.season);
    const base: State = {
      ...s,
      gameSec: 1800,
      diff,
      down: 1,
      ydstogo: 10,
      yl: ko,
      toOff: 3,
      toDef: 3,
    };
    return s.recv2h ? wpOf(base) : 1 - wpOf(flipped(base));
  }
  const at: State = {
    ...s,
    gameSec,
    diff,
    down: 1,
    ydstogo: Math.min(10, yl),
    yl,
  };
  return offenseBall ? wpOf(at) : 1 - wpOf(flipped(at));
}

/** Offense scored `pts` before the try; the better of kicking the PAT and going for two, then kicking off. */
function afterTouchdown(s: State, sec: number): number {
  const ko = kickoffYardline(s.season);
  const v = (d: number) => nextSnap(s, sec, false, ko, d);
  const pat = patProb(s.season);
  const kick = pat * v(7) + (1 - pat) * v(6);
  const two = TWO_PT * v(8) + (1 - TWO_PT) * v(6);
  return Math.max(kick, two);
}

function situationState(x: Situation): State {
  return {
    season: x.season,
    gameSec: (4 - x.qtr) * 900 + x.clock,
    diff: x.scoreDiff,
    down: 4,
    ydstogo: x.ydstogo,
    yl: x.yardline,
    toOff: x.offTimeouts,
    toDef: x.defTimeouts,
    home: x.home,
    spread: x.spread,
    total: x.total,
    recv2h: x.receive2h,
  };
}

/** Probability of each yards-gained outcome (-10..65) if the offense goes for it. */
export function goGains(x: Situation): number[] {
  const { go } = models();
  return predictSoftmax(
    go,
    rowFor(go, {
      down: 4,
      ydstogo: x.ydstogo,
      yardline_100: x.yardline,
      era3: x.season >= 2014 && x.season <= 2017 ? 1 : 0,
      era4: x.season >= 2018 ? 1 : 0,
      era5: x.season >= 2022 ? 1 : 0,
      outdoors: x.roof === "outdoors" ? 1 : 0,
      retractable: x.roof === "retractable" ? 1 : 0,
      dome: x.roof === "dome" ? 1 : 0,
      posteam_spread: x.spread,
      total_line: x.total,
      posteam_total: (x.total + x.spread) / 2,
    }),
  );
}

function goOption(x: Situation, s: State): { option: Option; gains: number[] } {
  const gains = goGains(x);
  let wp = 0,
    pSucc = 0,
    wpSucc = 0,
    pFail = 0,
    wpFail = 0,
    pTd = 0;
  gains.forEach((p, i) => {
    const g = i - 10;
    let v: number;
    if (g >= x.yardline) {
      v = afterTouchdown(s, PLAY_SEC.go);
      pTd += p;
    } else if (x.yardline - g >= 100) {
      // safety: offense free-kicks, opponent starts around its own 40
      v = nextSnap(s, PLAY_SEC.go, false, 60, -2);
    } else if (g >= x.ydstogo) {
      v = nextSnap(s, PLAY_SEC.go, true, x.yardline - g, 0);
    } else {
      v = nextSnap(s, PLAY_SEC.go, false, 100 - (x.yardline - g), 0);
    }
    wp += p * v;
    if (g >= x.ydstogo) {
      pSucc += p;
      wpSucc += p * v;
    } else {
      pFail += p;
      wpFail += p * v;
    }
  });
  return {
    gains,
    option: {
      key: "go",
      wp,
      successProb: pSucc,
      wpSuccess: pSucc > 0 ? wpSucc / pSucc : null,
      wpFail: pFail > 0 ? wpFail / pFail : null,
      detail: { touchdown: pTd },
    },
  };
}

export function fgMakeProb(
  x: Pick<Situation, "season" | "yardline" | "roof" | "temp" | "wind">,
): number {
  const { fg } = models();
  const distance = x.yardline + 18;
  const indoors = x.roof === "dome";
  const p = predictBinary(
    fg,
    rowFor(fg, {
      kick_distance: distance,
      season: x.season,
      outdoors: x.roof === "outdoors" ? 1 : 0,
      retractable: x.roof === "retractable" ? 1 : 0,
      temp: indoors ? null : (x.temp ?? null),
      wind: indoors ? null : (x.wind ?? null),
    }),
  );
  // the record is 66 yards; fade the model's tail to zero by 72
  return distance <= 66 ? p : p * Math.max(0, (72 - distance) / 6);
}

function fgOption(x: Situation, s: State): Option {
  const p = fgMakeProb(x);
  const make = nextSnap(s, PLAY_SEC.fg, false, kickoffYardline(x.season), 3);
  // miss: opponent takes over at the spot of the kick, or its own 20 if that's further out
  const miss = nextSnap(
    s,
    PLAY_SEC.fg,
    false,
    Math.min(80, 92 - x.yardline),
    0,
  );
  return {
    key: "fg",
    wp: p * make + (1 - p) * miss,
    successProb: p,
    wpSuccess: make,
    wpFail: miss,
    detail: { distance: x.yardline + 18 },
  };
}

function puntOption(x: Situation, s: State): Option {
  const raw = models().punt[String(x.yardline)] ?? [];
  // the table is rounded to 5 decimals, so renormalize
  const total = raw.reduce((a, r) => a + r[2], 0) || 1;
  const rows = raw.map(([k, y, p]) => [k, y, p / total] as const);
  let wp = 0,
    oppStart = 0,
    pOpp = 0,
    pMuff = 0,
    pTd = 0;
  const ko = kickoffYardline(x.season);
  for (const [kind, y, p] of rows) {
    let v: number;
    if (kind === "opp") {
      v = nextSnap(s, PLAY_SEC.punt, false, y, 0);
      oppStart += p * y;
      pOpp += p;
    } else if (kind === "own") {
      v = nextSnap(s, PLAY_SEC.punt, true, y, 0);
      pMuff += p;
    } else {
      v = nextSnap(s, PLAY_SEC.punt, true, ko, -7);
      pTd += p;
    }
    wp += p * v;
  }
  return {
    key: "punt",
    wp,
    successProb: null,
    wpSuccess: null,
    wpFail: null,
    // where the opponent starts, as "their own N"
    detail: {
      oppStart: pOpp ? 100 - oppStart / pOpp : 0,
      muff: pMuff,
      returnTd: pTd,
    },
  };
}

function strengthOf(gap: number): Decision["strength"] {
  if (gap < 1) return "toss-up";
  if (gap < 2.25) return "lean";
  if (gap < 5) return "strong";
  if (gap < 10) return "very strong";
  return "no-brainer";
}

export function decide(x: Situation): Decision {
  const s = situationState(x);
  const { option: go, gains } = goOption(x, s);
  const options = [go, fgOption(x, s), puntOption(x, s)];
  // like nfl4th, no punts from inside the opponent's 30 and no kicks longer than the record
  const live = options.filter(
    (o) =>
      !(o.key === "punt" && x.yardline < 30) &&
      !(o.key === "fg" && x.yardline + 18 > 70),
  );
  const ranked = [...live].sort((a, b) => b.wp - a.wp);
  const gap = (ranked[0]!.wp - (ranked[1]?.wp ?? 0)) * 100;
  const bestKick = Math.max(
    ...live.filter((o) => o.key !== "go").map((o) => o.wp),
    0,
  );
  let breakeven: number | null = null;
  if (go.wpSuccess != null && go.wpFail != null && go.wpSuccess > go.wpFail) {
    const b = (bestKick - go.wpFail) / (go.wpSuccess - go.wpFail);
    breakeven = b <= 1 ? Math.max(0, b) : null;
  }
  return {
    situation: x,
    wpNow: go.wp >= bestKick ? go.wp : bestKick,
    options: live,
    best: ranked[0]!.key,
    gap,
    strength: strengthOf(gap),
    breakeven,
    goGains: gains,
  };
}
