import { describeView, getDataInfo, type DbOpts } from "./db";
import { mlbPrompt } from "./mlb/prompt";
import { nbaPrompt } from "./nba/prompt";
import { nflPrompt } from "./nfl/prompt";
import type { Col, SportPrompt } from "./prompt-kit";
import type { Sport } from "./types";
import { VIEWS } from "./views";

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
  opts: DbOpts = {},
): Promise<string> {
  const have = await describeView(sport, view, opts).catch(() => null);
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
  const today = new Date().toISOString().slice(0, 10);
  const key = `${sport}:${mode}:${info.version}:${today}`;
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
      ? `OUTPUT: JSON {"explain": see EXPLAIN, "plan": one short sentence naming the table, filters and metric, "sql": the query, "chart": see CHARTS}. The examples leave explain out for brevity; always include it.`
      : `OUTPUT: think it through, then reply with the final query in a \`\`\`sql fenced block, followed by a \`\`\`json fenced block with the chart object plus explain, e.g. {"explain": "...", "type": "none", "x": "", "y": "", "label": "", "series": "", "title": ""}.`;

  // Models default to the year their training data ends; pin "now" to the data.
  const prompt = `${p.intro}

TODAY is ${today}. That is later than your training data, so never assume an earlier year: "this season", "this year", "currently" and "so far" mean the current season in DATA below. A question that names no season or span (e.g. "who leads in home runs?") means the current season. "Career" and "all-time" mean every season.

${p.seasonContext(info)}

RULES
${[
  ...p.rules,
  `"How many" or "total" for one player or team over a span is one summed row (with games played as the sample), not a game log. Return one row per game only when asked for each game, a game log or a week-by-week view.`,
  `Totals and per game: when a row covers more than one game, show games played, and next to each main counting stat show both the total and the per-game average (e.g. pts and pts_per_game), even when the question asks for only one of them. Rates and percentages need no per-game version.`,
]
  .map((r, i) => `${i + 1}. ${r}`)
  .join("\n")}

TABLES
${tables.join("\n\n")}

${p.idioms}

FUZZY, OPINION AND JOKE QUESTIONS
People ask goofy things ("biggest fraud", "carried by his receivers", "who's washed"). Never refuse and never return one vague row. Pick one sensible measurable stand-in, rank everyone on it as a leaderboard, and include the columns that show why: the stand-in, what it's built from, and a sample size. explain says what you measured. Stand-ins that fit common ones:
${p.fuzzy}
If the data has nothing close (contracts, injuries, vibes), use the nearest stat you do have and say so in explain.

${charts(p.chartTeamHint)}

${p.examples}

EXPLAIN
One or two plain sentences telling a casual fan what the table shows: who is ranked, on what, over which games or seasons, and any minimum. For a fuzzy question, say how you measured it ("Fraud score = wins minus the wins their point differential predicts."). No table names, column names or SQL words, and no dashes as punctuation.

${output}`;
  // Drop older versions of this sport+mode so a refresh doesn't leak prompts.
  for (const k of cache.keys())
    if (k.startsWith(`${sport}:${mode}:`)) cache.delete(k);
  cache.set(key, prompt);
  return prompt;
}

/**
 * The same table notes, rules and examples, written for an outside agent that
 * writes its own SQL against the licensed database (the connector's
 * describe_data tool). Tables missing from that database are left out.
 */
export async function describeData(sport: Sport): Promise<string> {
  const info = await getDataInfo(sport);
  const p = PROMPTS[sport];
  const tables = (
    await Promise.all(
      p.tables.map(async (t) => {
        const cols = await renderTable(sport, t.view, t.cols, {
          licensed: true,
        });
        return cols ? `${t.view} -- ${t.title(info)}\n${cols}` : null;
      }),
    )
  ).filter(Boolean);
  // Hints that send the model to a left-out table would only cause errors.
  const gone = (VIEWS[sport].restricted ?? []).map((v) =>
    v.replace(/_.*$/, "_"),
  );
  const fuzzy = p.fuzzy
    .split("\n")
    .filter((l) => !gone.some((v) => new RegExp(`\\b${v}`).test(l)))
    .join("\n");
  // The examples carry the Ask page's chart object; outside agents only need the SQL.
  const examples = p.examples.replace(/, "chart": \{[^}]*\}/g, "");
  return `${p.intro.replace(/^You write one/, "Write one")}

${p.seasonContext(info)}

RULES
${p.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

TABLES
${tables.join("\n\n")}

${p.idioms}

STAND-INS FOR SLANG AND OPINION QUESTIONS
${fuzzy}

${examples}`;
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
