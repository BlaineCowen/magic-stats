import {
  getLlmModelName,
  nativeChat,
  openaiCompatibleChat,
  type NativeChatStats,
} from "@/lib/magic-llm";
import {
  chooseChart,
  type ChartPick,
  type ChartSource,
  type ChartSpec,
  type TeamColors,
} from "@/lib/nfl/chart-spec";
import {
  extractChartBlock,
  extractExplainBlock,
  extractSqlBlock,
  parseFast,
} from "@/lib/nfl/llm-output";
import { dataVersion, getTeamColors, runSafeSelect, type Row } from "./db";
import {
  buildSystemPrompt,
  emptyHint,
  errorHint,
  type PromptMode,
} from "./prompt";
import type { Sport } from "./types";

export type QueryMode = PromptMode;

export type Attempt = {
  mode: QueryMode;
  sql: string;
  plan: string | null;
  explain?: string | null;
  chart?: ChartPick | null;
  error?: string;
  rows?: number;
  llm_ms: number;
  db_ms: number;
};

export type PipelineResult = {
  results: Row[];
  columns: string[];
  truncated: boolean;
  sql: string;
  plan: string | null;
  /** Plain-English summary of what the table shows, for the top of the answer. */
  explain: string | null;
  mode: QueryMode;
  sport: Sport;
  attempts: Attempt[];
  chart: ChartSpec | null;
  chart_source: ChartSource | null;
  team_colors: TeamColors;
  timings: { llm_ms: number; db_ms: number; total_ms: number };
  data_version: string;
  llm_stats?: NativeChatStats;
};

export class PipelineError extends Error {
  constructor(
    message: string,
    readonly attempts: Attempt[],
  ) {
    super(message);
  }
}

// `explain` comes first so a fuzzy question gets its stand-in stat defined
// before the SQL is written. `plan` comes next so the model states its approach before writing SQL;
// without it the 9B model skips reasoning entirely (no thinking under a grammar).
// `chart` comes last so its column names can refer to the SQL's aliases.
// Strict mode requires every property, so unused chart fields are "".
const CHART_FIELD = { type: "string", maxLength: 60 } as const;
const FAST_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "stats_sql",
    strict: true,
    schema: {
      type: "object",
      properties: {
        explain: { type: "string", maxLength: 400 },
        plan: { type: "string", maxLength: 300 },
        sql: { type: "string" },
        chart: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["none", "scatter", "line", "bar"] },
            x: CHART_FIELD,
            y: CHART_FIELD,
            label: CHART_FIELD,
            series: CHART_FIELD,
            title: { type: "string", maxLength: 80 },
          },
          required: ["type", "x", "y", "label", "series", "title"],
        },
      },
      required: ["explain", "plan", "sql", "chart"],
    },
  },
};

const MAX_ATTEMPTS = 3;

function withFeedback(
  sport: Sport,
  question: string,
  attempts: Attempt[],
): string {
  const prev = attempts.at(-1);
  if (!prev) return question;
  const problem = prev.error
    ? prev.error + errorHint(sport, prev.error, prev.sql)
    : emptyHint(sport);
  const repeated = attempts
    .slice(0, -1)
    .some((a) => a.sql.trim() === prev.sql.trim());
  return `${question}

Your previous SQL:
${prev.sql}

Problem: ${problem}
${repeated ? "You already returned this exact query before. Write a different query that avoids the problem.\n" : ""}Write a corrected query.`;
}

async function generate(
  sport: Sport,
  mode: QueryMode,
  question: string,
  attempts: Attempt[],
): Promise<{
  sql: string | null;
  plan: string | null;
  explain: string | null;
  chart: ChartPick | null;
  stats?: NativeChatStats;
}> {
  const system = await buildSystemPrompt(sport, mode);
  const input = withFeedback(sport, question, attempts);
  if (mode === "deep") {
    const r = await nativeChat({ systemPrompt: system, input });
    return {
      sql: extractSqlBlock(r.content),
      plan: null,
      explain: extractExplainBlock(r.content),
      chart: extractChartBlock(r.content),
      stats: r.stats,
    };
  }
  const raw = await openaiCompatibleChat(
    [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
    {
      model: getLlmModelName(),
      // Fuzzy questions can think for a while; the cap keeps room for the JSON.
      maxTokens: 6000,
      reasoningMaxTokens: 3000,
      // Deterministic first try; a little variety on repairs so the model
      // doesn't hand back the same failing query.
      temperature: attempts.length ? 0.4 : 0,
      responseFormat: FAST_FORMAT,
    },
  );
  return parseFast(raw);
}

/**
 * Question -> SQL -> rows. The first attempt uses the requested mode; repairs
 * use fast mode because DuckDB's error text ("column X not found, did you
 * mean Y") makes them easy, and a second deep pass would take minutes.
 */
export async function answerQuestion(
  question: string,
  mode: QueryMode,
  sport: Sport = "nfl",
): Promise<PipelineResult> {
  const started = Date.now();
  const attempts: Attempt[] = [];
  let llmStats: NativeChatStats | undefined;
  let retriedEmpty = false;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const attemptMode: QueryMode = i === 0 ? mode : "fast";
    const t0 = Date.now();
    const gen = await generate(sport, attemptMode, question, attempts);
    if (i === 0) llmStats = gen.stats;
    const attempt: Attempt = {
      mode: attemptMode,
      sql: gen.sql ?? "",
      plan: gen.plan,
      explain: gen.explain,
      chart: gen.chart,
      llm_ms: Date.now() - t0,
      db_ms: 0,
    };
    attempts.push(attempt);

    if (!gen.sql) {
      attempt.error =
        "No SQL found in the response. Reply with a single SELECT.";
      continue;
    }

    const t1 = Date.now();
    try {
      const out = await runSafeSelect(sport, gen.sql);
      attempt.db_ms = Date.now() - t1;
      attempt.rows = out.rows.length;
      if (out.rows.length === 0 && !retriedEmpty && i < MAX_ATTEMPTS - 1) {
        retriedEmpty = true;
        continue;
      }
      const { chart, chart_source } = chooseChart(
        question,
        gen.chart,
        out.rows,
        out.columns,
      );
      return {
        results: out.rows,
        columns: out.columns,
        truncated: out.truncated,
        sql: gen.sql,
        plan: gen.plan ?? attempts.find((a) => a.plan)?.plan ?? null,
        explain:
          gen.explain ?? attempts.find((a) => a.explain)?.explain ?? null,
        mode,
        sport,
        attempts,
        chart,
        chart_source,
        // Sent with every answer so "Chart this" on a table can use them too.
        team_colors: await getTeamColors(sport),
        timings: {
          llm_ms: attempts.reduce((s, a) => s + a.llm_ms, 0),
          db_ms: attempts.reduce((s, a) => s + a.db_ms, 0),
          total_ms: Date.now() - started,
        },
        data_version: dataVersion(sport),
        llm_stats: llmStats,
      };
    } catch (e) {
      attempt.db_ms = Date.now() - t1;
      attempt.error = (e as Error).message.slice(0, 1200);
    }
  }

  throw new PipelineError(
    attempts.at(-1)?.error ?? "Could not produce a working query",
    attempts,
  );
}
