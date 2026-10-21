/**
 * Playoff overtime under the 2022 rules: both teams get a possession (even after a first-drive
 * touchdown), then it's sudden death. Too few games exist to train a model, so this is a possession
 * model built from drive outcomes in comparable regulation situations (2015-2025 nflverse pbp).
 * Every rate is an input, so the page can show how the answer moves for a better or worse offense.
 */

export type DriveRates = { td: number; fg: number };

export type OtParams = {
  /** first possession, normal play (2015-25 Q1-3 drives from own 20-30: 21% TD, 15% FG) */
  firstDrive: { a: DriveRates; b: DriveRates };
  /** second possession down 3: a FG ties (Q4 down 0-3 drives with 4-10 min left: 20% TD, 23% FG) */
  down3: { a: DriveRates; b: DriveRates };
  /** second possession down 7: must score a TD (Q4 down 4-8 with 4-10 min left: 31% TD) */
  down7: { a: number; b: number };
  /** second possession tied at 0: any score wins (Q4 down 0-3 drives with 4-10 min left: 42%) */
  anyScore: { a: number; b: number };
  pat: number;
  twoPt: number;
};

export const LEAGUE_AVG: OtParams = {
  firstDrive: { a: { td: 0.21, fg: 0.15 }, b: { td: 0.21, fg: 0.15 } },
  down3: { a: { td: 0.2, fg: 0.23 }, b: { td: 0.2, fg: 0.23 } },
  down7: { a: 0.31, b: 0.31 },
  anyScore: { a: 0.42, b: 0.42 },
  pat: 0.94,
  twoPt: 0.48,
};

/** Win probability for the team with the ball first in sudden death. */
export function suddenDeath(scoreFirst: number, scoreSecond: number): number {
  // alternate possessions until someone scores: p = s1 + (1-s1)(1-s2) p
  return scoreFirst / (1 - (1 - scoreFirst) * (1 - scoreSecond));
}

type Side = "a" | "b";
const other = (s: Side): Side => (s === "a" ? "b" : "a");
const scoreRate = (r: DriveRates) => r.td + r.fg;

/**
 * Win probability for `first` (who had the first possession) once that possession is over,
 * given what it produced. `first` also gets the first sudden-death possession.
 */
export function afterFirstPossession(
  p: OtParams,
  first: Side,
  result: "td" | "fg" | "none",
): number {
  const second = other(first);
  const sd = suddenDeath(
    scoreRate(p.firstDrive[first]),
    scoreRate(p.firstDrive[second]),
  );
  if (result === "td") {
    // up 7 after the PAT (a missed PAT leaves it at 6 and the second team needs only a TD + PAT to win)
    const tdRate = p.down7[second];
    // second team scores: go for two to win, or kick to tie and play sudden death without the ball
    const secondWinsAfterTd = Math.max(p.twoPt, p.pat * (1 - sd));
    const up7 = 1 - tdRate * secondWinsAfterTd;
    const up6 = 1 - tdRate * p.pat;
    return p.pat * up7 + (1 - p.pat) * up6;
  }
  if (result === "fg") {
    const r = p.down3[second];
    return 1 - r.td - r.fg + r.fg * sd;
  }
  return (1 - p.anyScore[second]) * sd;
}

/** Win probability for the team that receives the opening kickoff. */
export function receiveFirst(p: OtParams, side: Side): number {
  const r = p.firstDrive[side];
  return (
    r.td * afterFirstPossession(p, side, "td") +
    r.fg * afterFirstPossession(p, side, "fg") +
    (1 - r.td - r.fg) * afterFirstPossession(p, side, "none")
  );
}

/**
 * 4th down on the first possession: kick the field goal, or go for it.
 * `conv` is the conversion probability, `tdOnPlay` the chance the 4th down play itself scores,
 * `tdAfter` the chance a converted-but-not-scored drive still ends in a TD (else a FG, `fgMake`).
 * A failed attempt hands the other team the ball needing any score.
 */
export function firstPossessionFourth(
  p: OtParams,
  side: Side,
  x: {
    conv: number;
    tdOnPlay: number;
    tdAfter: number;
    fgMake: number;
    anyScoreAfterStop: number;
  },
) {
  const win = (r: "td" | "fg" | "none") => afterFirstPossession(p, side, r);
  const sd = suddenDeath(
    scoreRate(p.firstDrive[side]),
    scoreRate(p.firstDrive[other(side)]),
  );
  const missFg = (1 - p.anyScore[other(side)]) * sd;
  const fg = x.fgMake * win("fg") + (1 - x.fgMake) * missFg;
  const convNoTd = x.conv - x.tdOnPlay;
  const afterConv =
    x.tdAfter * win("td") +
    (1 - x.tdAfter) * (x.fgMake * win("fg") + (1 - x.fgMake) * missFg);
  const failed = (1 - x.anyScoreAfterStop) * sd;
  const go =
    x.tdOnPlay * win("td") + convNoTd * afterConv + (1 - x.conv) * failed;
  return {
    fg,
    go,
    winAfterTd: win("td"),
    winAfterFg: win("fg"),
    winAfterStop: failed,
  };
}

/** 2015-25: share of drives with a 1st & goal at the 1..9 that end in a touchdown. */
const TD_FROM_GOAL_TO_GO = [
  0.884, 0.834, 0.811, 0.768, 0.74, 0.687, 0.666, 0.661, 0.611,
];

/** Turn a yards-gained distribution into the inputs firstPossessionFourth needs. */
export function fourthDownInputs(
  gains: number[],
  ydstogo: number,
  yardline: number,
) {
  let conv = 0,
    tdOnPlay = 0,
    tdAfterSum = 0;
  gains.forEach((p, i) => {
    const g = i - 10;
    if (g < ydstogo) return;
    conv += p;
    if (g >= yardline) tdOnPlay += p;
    else
      tdAfterSum +=
        p * (TD_FROM_GOAL_TO_GO[Math.min(8, yardline - g - 1)] ?? 0.6);
  });
  const convNoTd = conv - tdOnPlay;
  return { conv, tdOnPlay, tdAfter: convNoTd > 0 ? tdAfterSum / convNoTd : 0 };
}
