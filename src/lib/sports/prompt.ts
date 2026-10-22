import { describeView, getDataInfo } from "./db";
import { mlbPrompt } from "./mlb/prompt";
import { nbaPrompt } from "./nba/prompt";
import { nflPrompt } from "./nfl/prompt";
import type { Col, SportPrompt } from "./prompt-kit";
import type { Sport } from "./types";

/**
 * System prompt for text-to-SQL. Kept to a few thousand tokens per sport: a
 * curated column list per table, the idioms models get wrong, and worked
 * examples. Column lists are filtered against the live parquet schema so a
 * renamed column can't slip in.
 */

const PROMPTS: Record<Sport, SportPrompt> = {
  nfl: nflPrompt,
  nba: nbaPrompt,
  mlb: mlbPrompt,
};

export type PromptMode = "fast" | "deep";

async function renderTable(
  sport: Sport,
  view: string,
  cols: Col[],
): Promise<string> {
  const have = await describeView(sport, view).catch(() => null);
  if (!have) return "";
  const lines = cols
    .map(([names, desc]) => {
      // Prose placeholders (with spaces) pass through; real names must exist.
      const kept = names
        .split(",")
        .map((s) => s.trim())
        .filter((n) => n.includes(" ") || have.has(n));
      if (!kept.length) return null;
      return `  ${kept.join(", ")}${desc ? ` -- ${desc}` : ""}`;
    })
    .filter(Boolean);
  return lines.join("\n");
}

const charts = (teamHint: string) => `CHARTS
Default to "none" (every field ""). Only chart if the question literally asks for a chart/plot/graph, asks for a trend over time, or compares two different stats as two columns per row (e.g. CPOE vs EPA). A same-stat split like "home vs away" is not a chart -- stays "none".
- x, y, label and series are column aliases from your own SELECT.
- scatter: one row per player/team with both stats as columns; x = the first stat named, y = the second, label = the name column. Return every qualifying row (LIMIT 100) with a sensible minimum sample.
- line: one row per season (or week) per player/team, ORDER BY the time column. x = season or week, y = the stat, series = the player/team column ("" for one player or team).
- bar: 10-25 rows ordered by the stat. y = the stat, label = the name column, x = "".
- ${teamHint}
- title: a short chart title, or "".`;

const cache = new Map<string, string>();

export async function buildSystemPrompt(
  sport: Sport,
  mode: PromptMode,
): Promise<string> {
  const info = await getDataInfo(sport);
  const key = `${sport}:${mode}:${info.version}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const p = PROMPTS[sport];
  const tables = await Promise.all(
    p.tables.map(
      async (t) =>
        `${t.view} -- ${t.title(info)}\n${await renderTable(sport, t.view, t.cols)}`,
    ),
  );

  const output =
    mode === "fast"
      ? `OUTPUT: JSON {"plan": one short sentence naming the table, filters and metric, "sql": the query, "chart": see CHARTS}.`
      : `OUTPUT: think it through, then reply with the final query in a \`\`\`sql fenced block, followed by the chart object in a \`\`\`json fenced block, e.g. {"type": "none", "x": "", "y": "", "label": "", "series": "", "title": ""}.`;

  const prompt = `${p.intro}

${p.seasonContext(info)}

RULES
${p.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

TABLES
${tables.join("\n\n")}

${p.idioms}

${charts(p.chartTeamHint)}

${p.examples}

${output}`;
  // Drop older versions of this sport+mode so a refresh doesn't leak prompts.
  for (const k of cache.keys())
    if (k.startsWith(`${sport}:${mode}:`)) cache.delete(k);
  cache.set(key, prompt);
  return prompt;
}

/** Hints for errors models tend to repeat verbatim: the sport's own, then general ones. */
export function errorHint(sport: Sport, error: string, sql: string): string {
  const own = PROMPTS[sport].errorHint(error, sql);
  if (own) return own;
  if (
    error.includes("Binder Error: Referenced column") &&
    /^\s*with\b/i.test(sql)
  ) {
    return "\nHint: a CTE only exposes the columns listed in its SELECT. Add the missing column to the CTE, or compute the value inside it.";
  }
  if (error.includes("Binder Error: Referenced column")) {
    return "\nHint: use only the columns listed for that table in the TABLES section.";
  }
  if (error.includes("must appear in the GROUP BY")) {
    return "\nHint: every non-aggregated column in SELECT must be in GROUP BY.";
  }
  return "";
}

export function emptyHint(sport: Sport): string {
  return PROMPTS[sport].emptyHint;
}
