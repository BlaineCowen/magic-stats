import fs from "node:fs";
import path from "node:path";
import type { OptionKey } from "./engine";

/** Written by scripts/fourth-down/coach_report.py from a full run of the engine over every 4th down. */

export type CoachSummary = {
  games: number;
  decisions: number;
  mistakes: number;
  /** win probability given up versus the best choice, summed, in points (100 = one expected win) */
  lost: number;
  lostPerGame: number;
  passiveLost: number;
  aggressiveLost: number;
  otherLost: number;
  passive: number;
  aggressive: number;
  strongGoSpots: number;
  wentInStrongGoSpots: number;
  nfl4thLost: number;
  nfl4thGraded: number;
};

export type CoachDecision = {
  gameId: string;
  season: number;
  week: number;
  post: boolean;
  team: string;
  opp: string;
  qtr: number;
  time: string;
  ydstogo: number;
  yardline: number;
  scoreDiff: number;
  actual: OptionKey;
  worked: boolean | null;
  best: OptionKey;
  gap: number;
  cost: number;
  conv: number | null;
  breakeven: number | null;
  n4Best: OptionKey | null;
  n4Cost: number | null;
  desc: string;
};

export type Coach = CoachSummary & {
  coach: string;
  teams: string[];
  rank: number;
  seasons: (CoachSummary & { season: number })[];
  worst: CoachDecision[];
};

export type CoachReport = {
  seasons: [number, number];
  through: string;
  minGames: number;
  league: CoachSummary & { coaches: number };
  coaches: Coach[];
};

let cached: CoachReport | null = null;

export function coachReport(): CoachReport {
  cached ??= JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "src/lib/fourth/data/coaches.json"),
      "utf8",
    ),
  ) as CoachReport;
  return cached;
}
