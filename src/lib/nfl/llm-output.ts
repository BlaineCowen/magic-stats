import { CHART_TYPES, type ChartPick, type ChartType } from "./chart-spec";

/**
 * Parsing the model's replies. Pure (no LM Studio, no DuckDB), so it is
 * unit-tested directly.
 */

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** A chart object from the model, or null if it isn't one. */
export function toChartPick(v: unknown): ChartPick | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const type = o.type;
  if (type !== "none" && !CHART_TYPES.includes(type as ChartType)) return null;
  return {
    type: type as ChartPick["type"],
    x: str(o.x, 60),
    y: str(o.y, 60),
    label: str(o.label, 60),
    series: str(o.series, 60),
    title: str(o.title, 80),
  };
}

/**
 * Last ```sql block, else the last fenced block that isn't JSON, else the
 * text itself if it looks like SQL. Deep mode ends with a ```json chart
 * block, which must never be mistaken for the query.
 */
export function extractSqlBlock(text: string): string | null {
  const sql = [...text.matchAll(/```sql\s*([\s\S]*?)```/gi)];
  const other = [...text.matchAll(/```(?!json\b)\w*\s*([\s\S]*?)```/gi)];
  const last = (sql.length ? sql : other).at(-1)?.[1]?.trim();
  if (last) return last;
  const bare = text.trim();
  return /^(select|with)\b/i.test(bare) ? bare : null;
}

/** The chart object from the last ```json block of a deep-mode reply. */
export function extractChartBlock(text: string): ChartPick | null {
  const block = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].at(-1)?.[1];
  if (!block) return null;
  try {
    return toChartPick(JSON.parse(block));
  } catch {
    return null;
  }
}

export type FastReply = {
  plan: string | null;
  sql: string | null;
  chart: ChartPick | null;
};

export function parseFast(raw: string): FastReply {
  try {
    const j = JSON.parse(raw) as {
      plan?: unknown;
      sql?: unknown;
      chart?: unknown;
    };
    return {
      plan: typeof j.plan === "string" ? j.plan : null,
      sql: typeof j.sql === "string" ? j.sql : null,
      chart: toChartPick(j.chart),
    };
  } catch {
    // Truncated JSON: salvage the sql field if it closed.
    const m = /"sql"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(raw);
    return {
      plan: null,
      sql: m ? (JSON.parse(`"${m[1]}"`) as string) : null,
      chart: null,
    };
  }
}
