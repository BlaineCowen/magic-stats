import type { Row } from "../../src/lib/sports/db";
import type { ChartType } from "../../src/lib/nfl/chart-spec";

export type Expect = { strings?: string[]; oneOf?: string[]; numbers?: number[] };

/** Every name tied with the leader (reference SQL must ORDER BY v DESC without LIMIT 1). */
export const leaders = (r: Row[]): Expect => ({
  oneOf: r.filter((x) => x.v === r[0]!.v).map((x) => String(x.n)),
  numbers: [Number(r[0]!.v)],
});

export type ChartExpect = { type: ChartType; x?: RegExp; y?: RegExp; series?: RegExp };

export type Case = {
  q: string;
  // Hand-written reference SQL and the values the answer must contain.
  // Optional: chart cases may only check the chart.
  ref?: string;
  // `oneOf`: at least one must appear (for ties at the top of a leaderboard).
  pick?: (rows: Row[]) => Expect;
  // "top1": expected values must be in the answer's first row; "any": anywhere.
  scope?: "top1" | "any";
  /** Omitted: the answer must come back without a chart. "any": not checked. */
  chart?: ChartExpect | "any";
};
