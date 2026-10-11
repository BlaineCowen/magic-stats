// Shared by the /api/charts route and the chart components (no server imports).

export type ChartKind = "teams" | "qbs";
export type Playoffs = "none" | "include" | "only";
export type PlayType = "all" | "pass" | "run";

export type ChartFilters = {
  seasonFrom: number;
  seasonTo: number;
  weekFrom: number;
  weekTo: number;
  playoffs: Playoffs;
  /** Win probability range in percent, from the team's own point of view. */
  wpMin: number;
  wpMax: number;
  downs: number[];
  /** 5 = overtime. */
  qtrs: number[];
  plays: PlayType;
  /** QB chart only; null means 40% of a typical team's QB plays in the range. */
  minPlays: number | null;
};

export const ALL_DOWNS = [1, 2, 3, 4];
export const ALL_QTRS = [1, 2, 3, 4, 5];

export type TeamPoint = {
  team: string;
  team_name: string | null;
  team_color: string | null;
  team_color2: string | null;
  off_epa: number;
  def_epa: number;
  off_success: number;
  def_success: number;
  off_plays: number;
  def_plays: number;
  games: number;
};

export type QbPoint = {
  id: string;
  name: string;
  full_name: string | null;
  team: string;
  team_color: string | null;
  team_color2: string | null;
  plays: number;
  games: number;
  epa: number;
  cpoe: number;
  success: number;
};

export type ChartData = {
  chart: ChartKind;
  filters: ChartFilters;
  /** The minimum the QB chart actually applied (resolved from `auto`). */
  minPlays: number | null;
  seasons: { min: number; max: number };
  teams?: TeamPoint[];
  qbs?: QbPoint[];
  ms: number;
};

function describeList(
  values: number[],
  all: number[],
  label: (n: number) => string = String,
) {
  if (values.length === all.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (v, i) => i === 0 || v === sorted[i - 1]! + 1,
  );
  if (contiguous && sorted.length > 2) {
    return `${label(sorted[0]!)}-${label(sorted.at(-1)!)}`;
  }
  return sorted.map(label).join(", ");
}

/** One-line summary under the chart title, in the style of rbsdm.com. */
export function describeFilters(f: ChartFilters, minPlays?: number | null) {
  const parts = [
    f.seasonFrom === f.seasonTo
      ? String(f.seasonFrom)
      : `${f.seasonFrom}-${f.seasonTo}`,
    `win prob ${f.wpMin}-${f.wpMax}%`,
    f.playoffs === "only"
      ? "playoffs only"
      : `reg. weeks ${f.weekFrom}-${f.weekTo} (playoffs: ${f.playoffs === "include" ? "included" : "none"})`,
  ];
  if (minPlays) parts.push(`min ${minPlays} plays`);
  parts.push(`downs: ${describeList(f.downs, ALL_DOWNS) ?? "1-4"}`);
  const q = describeList(f.qtrs, ALL_QTRS, (n) => (n === 5 ? "OT" : String(n)));
  parts.push(`qtrs: ${q ?? "all"}`);
  if (f.plays === "pass") parts.push("dropbacks only");
  if (f.plays === "run") parts.push("runs only");
  return parts.join(", ");
}
