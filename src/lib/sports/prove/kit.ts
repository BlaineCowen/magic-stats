/**
 * Split definitions for "prove it" questions ("give me the stats that prove
 * CJ Stroud is the best QB"). A role is one way a player shows up in the data
 * (passer, rusher, hitter...). Each role lists situational splits (dims) and
 * stats (metrics); the engine ranks every player in every split and pair of
 * splits and keeps the ones the asked-about player leads.
 */

export type Fmt = "int" | "1" | "2" | "epa" | "plus1" | "pct" | "avg";

/** A situational split. `sql` is evaluated per base row and returns a phrase that
 * reads after the stat ("on the road", "on 3rd down") or NULL when the row
 * isn't in any bucket worth reporting. */
export type Dim = {
  key: string;
  sql: string;
  /** Below 1 for trivia splits (weekday, month) so real ones rank first. */
  weight?: number;
};

export type Metric = {
  key: string;
  /** Card title prefix: "Most passing yards". */
  lead: string;
  /** Table column header. */
  column: string;
  /** Aggregate over the role's base rows. */
  sql: string;
  /** Rates and averages. Totals must be above zero to count as leading. */
  rate?: boolean;
  /** Lower is better (ERA). */
  low?: boolean;
  fmt: Fmt;
  /** Ranking weight: headline stats float above niche ones. Default 1. */
  weight?: number;
};

export type Role = {
  key: string;
  /** Plural noun for the ranked group: "passers". */
  noun: string;
  /** Aggregate counting the role's opportunities and its label: "dropbacks". */
  sample: { sql: string; label: string };
  /** Minimum sample to qualify, for no split, one split and two splits. A
   * player also needs 40% of the split's busiest player's sample. */
  min: [number, number, number];
  /** Splits with fewer qualified players than this aren't worth bragging about. */
  minPool: number;
  /** Base rows for a season filter. Must select pid, pname, team, every dim
   * (aliased d_<key>) and whatever the metric and sample aggregates read. */
  from: (scope: string) => string;
  /** Just pid, pname and the sample's columns: the cheap version of `from`
   * used to match names. */
  ids: (scope: string) => string;
  /** Phrase order: the first dim's phrase is read first. */
  dims: Dim[];
  /** Dim pairs that overlap or read badly together. */
  skipPairs?: [string, string][];
  metrics: Metric[];
};

export type Scope = { from: number; to: number; type: "REG" | "POST" };

export type SportProof = {
  roles: Role[];
  /** SQL filter for a scope against the role base tables. */
  scopeSql: (s: Scope) => string;
  seasonLabel: (season: number) => string;
  /** Short league name for titles. */
  league: string;
};

export const FRAC = 0.4;

/** Phrase for "on the road"-style booleans. */
export const either = (cond: string, yes: string, no: string | null) =>
  `CASE WHEN ${cond} THEN '${yes}' ${no === null ? "" : `WHEN NOT (${cond}) THEN '${no}'`} END`;

/** CASE over a column's values. */
export const cases = (col: string, map: Record<string, string>) =>
  `CASE ${col} ${Object.entries(map)
    .map(([k, v]) => `WHEN ${/^-?\d+$/.test(k) ? k : `'${k}'`} THEN '${v}'`)
    .join(" ")} END`;

export const MONTHS_SQL = cases("month(game_date::DATE)", {
  "1": "in January",
  "2": "in February",
  "3": "in March",
  "4": "in April",
  "5": "in May",
  "6": "in June",
  "7": "in July",
  "8": "in August",
  "9": "in September",
  "10": "in October",
  "11": "in November",
  "12": "in December",
});

export const WEEKDAYS_SQL = cases("dayname(game_date::DATE)", {
  Monday: "on Mondays",
  Tuesday: "on Tuesdays",
  Wednesday: "on Wednesdays",
  Thursday: "on Thursdays",
  Friday: "on Fridays",
  Saturday: "on Saturdays",
  Sunday: "on Sundays",
});

export const MONTHS: Dim = { key: "month", sql: MONTHS_SQL, weight: 0.75 };
export const WEEKDAYS: Dim = { key: "day", sql: WEEKDAYS_SQL, weight: 0.55 };

export function formatValue(v: number, fmt: Fmt): string {
  switch (fmt) {
    case "int":
      return Math.round(v).toLocaleString("en-US");
    case "1":
      return v.toFixed(1);
    case "2":
      return v.toFixed(2);
    case "epa":
      return (v >= 0 ? "+" : "") + v.toFixed(2);
    case "plus1":
      return (v >= 0 ? "+" : "") + v.toFixed(1);
    case "pct":
      return `${(v * 100).toFixed(1)}%`;
    case "avg":
      return v.toFixed(3).replace(/^0/, "");
  }
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
};
