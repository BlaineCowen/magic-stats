import {
  getLlmModelName,
  nativeChat,
  openaiCompatibleChat,
  type NativeChatStats,
} from "@/lib/magic-llm";
import { dataVersion, runSafeSelect, type Row } from "./db";
import { extractSqlBlock, parseFast } from "./llm-output";
import { buildSystemPrompt, type PromptMode } from "./prompt";

export type QueryMode = PromptMode;

export type Attempt = {
  mode: QueryMode;
  sql: string;
  plan: string | null;
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
  mode: QueryMode;
  attempts: Attempt[];
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

// `plan` comes first so the model states its approach before writing SQL;
// without it the 9B model skips reasoning entirely (no thinking under a grammar).
const FAST_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "nfl_sql",
    strict: true,
    schema: {
      type: "object",
      properties: {
        plan: { type: "string", maxLength: 300 },
        sql: { type: "string" },
      },
      required: ["plan", "sql"],
    },
  },
};

const MAX_ATTEMPTS = 3;

/** Extra guidance for errors the 9B model tends to repeat verbatim. */
function errorHint(error: string, sql: string): string {
  // Most common mix-up: pbp's passer_/rusher_/receiver_ columns used on player_week.
  if (
    /Referenced column "(passer|rusher|receiver)_\w+"/.test(error) &&
    /\bplayer_week\b/i.test(sql)
  ) {
    return "\nHint: player_week has no passer_/rusher_/receiver_ columns. Players there are player_id and player_display_name, with stats like completions, attempts, passing_yards, carries, rushing_yards, targets, receptions.";
  }
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

function withFeedback(question: string, attempts: Attempt[]): string {
  const prev = attempts.at(-1);
  if (!prev) return question;
  const problem = prev.error
    ? prev.error + errorHint(prev.error, prev.sql)
    : "It ran but returned 0 rows. Names contain punctuation (e.g. 'C.J. Stroud'), so match players on last name only (ILIKE '%stroud%'). Also check team codes, season_type and season filters.";
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
  mode: QueryMode,
  question: string,
  attempts: Attempt[],
): Promise<{
  sql: string | null;
  plan: string | null;
  stats?: NativeChatStats;
}> {
  const system = await buildSystemPrompt(mode);
  const input = withFeedback(question, attempts);
  if (mode === "deep") {
    const r = await nativeChat({ systemPrompt: system, input });
    return { sql: extractSqlBlock(r.content), plan: null, stats: r.stats };
  }
  const raw = await openaiCompatibleChat(
    [
      { role: "system", content: system },
      { role: "user", content: input },
    ],
    {
      model: getLlmModelName(),
      maxTokens: 900,
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
): Promise<PipelineResult> {
  const started = Date.now();
  const attempts: Attempt[] = [];
  let llmStats: NativeChatStats | undefined;
  let retriedEmpty = false;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const attemptMode: QueryMode = i === 0 ? mode : "fast";
    const t0 = Date.now();
    const gen = await generate(attemptMode, question, attempts);
    if (i === 0) llmStats = gen.stats;
    const attempt: Attempt = {
      mode: attemptMode,
      sql: gen.sql ?? "",
      plan: gen.plan,
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
      const out = await runSafeSelect(gen.sql);
      attempt.db_ms = Date.now() - t1;
      attempt.rows = out.rows.length;
      if (out.rows.length === 0 && !retriedEmpty && i < MAX_ATTEMPTS - 1) {
        retriedEmpty = true;
        continue;
      }
      return {
        results: out.rows,
        columns: out.columns,
        truncated: out.truncated,
        sql: gen.sql,
        plan: gen.plan ?? attempts.find((a) => a.plan)?.plan ?? null,
        mode,
        attempts,
        timings: {
          llm_ms: attempts.reduce((s, a) => s + a.llm_ms, 0),
          db_ms: attempts.reduce((s, a) => s + a.db_ms, 0),
          total_ms: Date.now() - started,
        },
        data_version: dataVersion(),
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
