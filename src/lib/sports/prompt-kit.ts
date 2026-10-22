import type { DataInfo } from "./db";

/** A column (or comma-separated columns) and a short description for the prompt. */
export type Col = [name: string, desc: string];

export type PromptTable = {
  view: string;
  /** Text after "view --", e.g. "one row per play, 1999-2025". */
  title: (info: DataInfo) => string;
  cols: Col[];
};

/** Everything sport-specific in the text-to-SQL system prompt. */
export type SportPrompt = {
  /** Opening line: what kind of question, from what data. */
  intro: string;
  seasonContext: (info: DataInfo) => string;
  /** Numbered in order. Shared ones are in RULE. */
  rules: string[];
  tables: PromptTable[];
  idioms: string;
  /** Stand-ins for slang and opinion questions ("biggest fraud", "garbage
   * time"), one "- term: definition" bullet each. */
  fuzzy: string;
  /** CHARTS bullet saying which column gives player rows a team for colors. */
  chartTeamHint: string;
  examples: string;
  /** Extra guidance for a mistake this sport's prompt invites; "" if none. */
  errorHint: (error: string, sql: string) => string;
  /** Feedback when a query ran but returned 0 rows. */
  emptyHint: string;
};

export const NO_CHART = `"chart": {"type": "none", "x": "", "y": "", "label": "", "series": "", "title": ""}`;

/** Rules every sport shares, worded as in the original NFL prompt. */
export const RULE = {
  oneSelect: "Exactly one SELECT statement (CTEs allowed). DuckDB SQL dialect.",
  onlyListed:
    "Use ONLY the tables and columns listed below. Never invent column names.",
  leaderboard:
    "Leaderboards: ORDER BY the requested metric itself (not sample size) and LIMIT 25 unless asked otherwise (max 100). Charts follow the CHARTS row counts.",
  sample: (units: string, columns: string) =>
    `When averaging over ${units}, include a sample-size column (${columns}). When ranking a rate, require a sensible minimum sample unless the user gives one.`,
  round: (example: string) =>
    `ROUND rates to 3 decimals and percentages to 1 in the SELECT list, but ORDER BY the unrounded expression (e.g. ${example}) so rounding does not create ties.`,
};
