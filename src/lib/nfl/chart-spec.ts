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
  const firstText = infos.find((c) => c.text)?.name ?? "";
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
      series: series?.name ?? "",
      title,
    };
  }

  const label =
    pick.label ||
    (x?.text ? x.name : "") ||
    firstText ||
    (infos.find((c) => c.time)?.name ?? "");
  if (!label || label === y.name) return null;
  if (rows.filter((r) => isNum(r[y.name])).length < 2) return null;
  return { type: "bar", x: "", y: y.name, label, series: "", title };
}

// Words that say nothing about which stat a column holds.
const STOP = new Set([
  "per",
  "play",
  "plays",
  "rate",
  "pct",
  "avg",
  "total",
  "the",
  "of",
  "and",
  "by",
  "vs",
  "in",
  "on",
  "to",
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Where the question first mentions one of the column's name tokens, or Infinity. */
function mention(question: string[], column: string): number {
  const hits = words(column)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map((t) => question.indexOf(t))
    .filter((i) => i >= 0);
  return hits.length ? Math.min(...hits) : Infinity;
}

/** Column names, earliest mention in the question first, then column order. */
function byMention(question: string[], cols: ColumnInfo[]): string[] {
  return cols
    .map((c, i) => ({ name: c.name, i, m: mention(question, c.name) }))
    .sort((a, b) => (a.m === b.m ? a.i - b.i : a.m - b.m))
    .map((e) => e.name);
}

/** Candidate axis columns: metrics first, then sample sizes. */
function rankNumbers(question: string[], cols: ColumnInfo[]): string[] {
  return [
    ...byMention(
      question,
      cols.filter((c) => c.metric),
    ),
    ...byMention(
      question,
      cols.filter((c) => c.sample),
    ),
  ];
}

/** "" when x never repeats; else the first text/time column that makes (x, column) unique. */
function seriesFor(rows: ChartRow[], cols: ColumnInfo[], x: string): string {
  const unique = (key: (r: ChartRow) => string) =>
    new Set(rows.map(key)).size === rows.length;
  if (!x || unique((r) => String(r[x]))) return "";
  return (
    cols.find(
      (c) =>
        (c.text || c.time) &&
        c.name !== x &&
        unique((r) => `${String(r[x])}|${String(r[c.name])}`),
    )?.name ?? ""
  );
}

/** The chart type a question names or implies, if any. */
export function chartIntent(question: string): ChartType | null {
  const q = question.toLowerCase();
  if (/\bscatter/.test(q)) return "scatter";
  if (/\bline (chart|graph|plot)/.test(q)) return "line";
  if (/\bbar (chart|graph|plot)|\bbars\b/.test(q)) return "bar";
  if (/\b(vs\.?|versus)(\s|$)/.test(q)) return "scatter";
  if (/over time|trend|\b(by|each|per) (season|week|year)\b/.test(q)) {
    return "line";
  }
  if (/\b(top|most|best|worst|lowest|highest|rank\w*|leaders?)\b/.test(q)) {
    return "bar";
  }
  return null;
}

/** Does the question ask for a picture rather than a table? */
export function asksForChart(question: string): boolean {
  return /\b(chart|plot|graph|visuali[sz]e|scatter|trend)|over time|\b(vs\.?|versus)(\s|$)/i.test(
    question,
  );
}

/** The best spec of one type for these rows, or null if that type can't be drawn. */
export function inferSpecOfType(
  type: ChartType,
  question: string,
  rows: ChartRow[],
  columns: string[],
): ChartSpec | null {
  const cols = classifyColumns(rows, columns);
  const q = words(question);
  const numbers = rankNumbers(q, cols);
  const firstText = cols.find((c) => c.text)?.name ?? "";
  const blank = { x: "", y: "", label: "", series: "", title: "" };

  if (type === "scatter") {
    const [x = "", y = ""] = numbers;
    return validateSpec(
      { ...blank, type, x, y, label: firstText },
      rows,
      columns,
    );
  }
  if (type === "line") {
    const times = cols.filter((c) => c.time && c.numeric && c.distinct >= 2);
    const x = byMention(q, times)[0] ?? "";
    const y = numbers[0] ?? "";
    return validateSpec(
      { ...blank, type, x, y, series: seriesFor(rows, cols, x) },
      rows,
      columns,
    );
  }
  // Bars follow the query's ORDER BY when they can find it.
  const y =
    numbers.find((n) => isSorted(rows.map((r) => r[n]))) ?? numbers[0] ?? "";
  const label = firstText || (cols.find((c) => c.time)?.name ?? "");
  return validateSpec({ ...blank, type, y, label }, rows, columns);
}

/**
 * Rules for when the model's pick is missing or wrong. The question's wording
 * picks the type first; otherwise the shape does: a sorted time column means
 * a line, two metrics a scatter, else bars. Falls through the other types.
 */
export function inferSpec(
  question: string,
  rows: ChartRow[],
  columns: string[],
): ChartSpec | null {
  const cols = classifyColumns(rows, columns);
  const timeLine = cols.some(
    (c) =>
      c.time &&
      c.numeric &&
      c.distinct >= 2 &&
      isSorted(rows.map((r) => r[c.name])),
  );
  const shape: ChartType[] = timeLine
    ? ["line", "scatter", "bar"]
    : cols.filter((c) => c.metric).length >= 2
      ? ["scatter", "bar", "line"]
      : ["bar", "line", "scatter"];
  const intent = chartIntent(question);
  const order = intent ? [intent, ...shape.filter((t) => t !== intent)] : shape;
  for (const type of order) {
    const spec = inferSpecOfType(type, question, rows, columns);
    if (spec) return spec;
  }
  return null;
}

/**
 * The chart to return with an answer: the model's pick if it fits, else the
 * rules (trying the model's type first) when the model or the question wanted
 * a chart. Never throws.
 */
export function chooseChart(
  question: string,
  pick: ChartPick | null | undefined,
  rows: ChartRow[],
  columns: string[],
): { chart: ChartSpec | null; chart_source: ChartSource | null } {
  try {
    const fromModel = validateSpec(pick, rows, columns);
    if (fromModel) return { chart: fromModel, chart_source: "model" };
    const wanted = pick && pick.type !== "none" ? pick.type : null;
    if (wanted ?? asksForChart(question)) {
      const inferred =
        (wanted && inferSpecOfType(wanted, question, rows, columns)) ??
        inferSpec(question, rows, columns);
      if (inferred) return { chart: inferred, chart_source: "inferred" };
    }
  } catch (e) {
    console.error("Chart selection failed:", e);
  }
  return { chart: null, chart_source: null };
}
