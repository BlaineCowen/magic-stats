/**
 * Choosing a chart for query results: which columns a chart can use, whether
 * the model's pick fits the rows, and rules that infer a chart when it
 * doesn't. Pure functions with relative imports only, so the API route, the
 * browser and node:test all load this file directly.
 */

export type Cell = string | number | boolean | null;
export type ChartRow = Record<string, Cell>;

export type ChartType = "scatter" | "line" | "bar";
export const CHART_TYPES: readonly ChartType[] = ["scatter", "line", "bar"];

export type ChartSpec = {
  type: ChartType;
  /** scatter: numeric column; line: numeric time column; bar: "". */
  x: string;
  /** The plotted number (bar length for bars). */
  y: string;
  /** Name on each point or bar; "" for none. */
  label: string;
  /** line only: one line per distinct value; "" for a single line. */
  series: string;
  /** "" means chartTitle() derives one. */
  title: string;
};

/** What the model returns: a spec, or type "none". */
export type ChartPick = Omit<ChartSpec, "type"> & { type: ChartType | "none" };

export type ChartSource = "model" | "inferred";

export type TeamColors = Record<
  string,
  { color: string | null; color2: string | null }
>;

export type ColumnInfo = {
  name: string;
  numeric: boolean;
  /** season/week/year/date: the x of a line chart. */
  time: boolean;
  /** A count (plays, attempts, games): pickable, never a default axis. */
  sample: boolean;
  /** Numeric, not time, not a count. */
  metric: boolean;
  text: boolean;
  distinct: number;
};

const TIME_COLUMNS = new Set([
  "season",
  "week",
  "game_date",
  "gameday",
  "year",
]);
const SAMPLE_COLUMN =
  /^(n|n_\w+|num_\w+|\w*plays|\w*dropbacks|\w*attempts|\w*carries|\w*targets|games|games_played|\w*snaps)$/;

const isNum = (v: Cell | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Visible columns (ids are hidden, as in the table), classified by their values. */
export function classifyColumns(
  rows: ChartRow[],
  columns: string[],
): ColumnInfo[] {
  return columns
    .filter((name) => !name.endsWith("_id"))
    .map((name) => {
      const values = rows.map((r) => r[name]).filter((v) => v != null);
      const numeric = values.length > 0 && values.every(isNum);
      const time = TIME_COLUMNS.has(name);
      const sample = numeric && !time && SAMPLE_COLUMN.test(name);
      return {
        name,
        numeric,
        time,
        sample,
        metric: numeric && !time && !sample,
        text: !numeric && !time,
        distinct: new Set(values.map(String)).size,
      };
    });
}

/** Numbers that never go down (or never go up) and aren't all equal. */
export function isSorted(values: (Cell | undefined)[]): boolean {
  const nums = values.filter(isNum);
  if (nums.length < 2 || nums.length !== values.length) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i]! < nums[i - 1]!) up = false;
    if (nums[i]! > nums[i - 1]!) down = false;
  }
  return (up || down) && nums[0] !== nums.at(-1);
}

/**
 * The pick as a drawable spec, or null if it doesn't fit these rows: every
 * named column must exist (ids don't count), plotted columns must be numeric,
 * and there must be enough rows to be worth a chart.
 */
export function validateSpec(
  pick: ChartPick | null | undefined,
  rows: ChartRow[],
  columns: string[],
): ChartSpec | null {
  if (!pick || !CHART_TYPES.includes(pick.type as ChartType)) return null;
  const infos = classifyColumns(rows, columns);
  const cols = new Map(infos.map((c) => [c.name, c]));
  for (const f of [pick.x, pick.y, pick.label, pick.series]) {
    if (f && !cols.has(f)) return null;
  }
  const x = cols.get(pick.x);
  const y = cols.get(pick.y);
  if (!y?.numeric) return null;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- "" must fall through
  const firstText = infos.find((c) => c.text)?.name || "";
  const title = pick.title.trim();

  if (pick.type === "scatter") {
    if (!x?.numeric || x.name === y.name) return null;
    const both = rows.filter((r) => isNum(r[x.name]) && isNum(r[y.name]));
    if (both.length < 3) return null;
    return {
      type: "scatter",
      x: x.name,
      y: y.name,
      label: pick.label || firstText,
      series: "",
      title,
    };
  }

  if (pick.type === "line") {
    if (!x?.numeric || x.name === y.name || x.distinct < 2) return null;
    const series = cols.get(pick.series);
    if (pick.series && !(series?.text || series?.time)) return null;
    if (series?.name === x.name) return null;
    // Two rows at the same x on one line would zigzag.
    const keys = rows.map(
      (r) => `${String(r[x.name])}|${series ? String(r[series.name]) : ""}`,
    );
    if (new Set(keys).size !== keys.length) return null;
    return {
      type: "line",
      x: x.name,
      y: y.name,
      label: "",
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- "" must fall through
      series: series?.name || "",
      title,
    };
  }

  const label =
    pick.label ||
    (x?.text ? x.name : "") ||
    firstText ||
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- "" must fall through
    infos.find((c) => c.time)?.name ||
    "";
  if (!label || label === y.name) return null;
  if (rows.filter((r) => isNum(r[y.name])).length < 2) return null;
  return { type: "bar", x: "", y: y.name, label, series: "", title };
}
