import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Simple in-memory cache for queries (works in Node.js server environment)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

function getCached(query: string) {
  const cached = queryCache.get(query.toLowerCase().trim());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return cached.data;
  }
  return null;
}

function setCache(query: string, data: any) {
  queryCache.set(query.toLowerCase().trim(), {
    data,
    timestamp: Date.now(),
  });
}

const API_BASE_URL =
  process.env.R_API_URL ?? "http://127.0.0.1:18080";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type QueryRequest = {
  query: string;
};

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function getOpenAIBaseUrl(): string {
  const u =
    process.env.LLM_BASE_URL ||
    process.env.LMSTUDIO_BASE_URL ||
    process.env.LM_STUDIO_URL ||
    process.env.OPENAI_BASE_URL ||
    "";
  return u.replace(/\/$/, "");
}

/** Prefer local OpenAI-compatible (LM Studio, vLLM) when a base URL is set or explicitly requested. */
function getAIProvider(): "gemini" | "openai-compatible" {
  const p = process.env.MAGIC_STATS_AI_PROVIDER?.toLowerCase();
  if (p === "gemini") return "gemini";
  if (
    p === "openai" ||
    p === "local" ||
    p === "openai-compatible" ||
    p === "lmstudio"
  ) {
    return "openai-compatible";
  }
  if (
    process.env.LLM_BASE_URL ||
    process.env.LMSTUDIO_BASE_URL ||
    process.env.OPENAI_BASE_URL
  ) {
    return "openai-compatible";
  }
  return "gemini";
}

function useMultiStepPipeline(): boolean {
  return process.env.AI_PIPELINE !== "single";
}

function loadAIPrompt(): string {
  try {
    const scriptPath = join(process.cwd(), "src", "ai_script.md");
    const scriptContent = readFileSync(scriptPath, "utf-8");
    const dictPath = join(process.cwd(), "src", "nflReadRDicts.md");
    const dictContent = readFileSync(dictPath, "utf-8");
    return `${scriptContent.trim()}\n\n## DATA DICTIONARIES:\n\n${dictContent.trim()}`;
  } catch (error) {
    console.error("Error loading AI prompt:", error);
    return `You are an expert at converting natural language queries about NFL statistics into R code using the nflreadr package.

IMPORTANT: Return ONLY the R code, no markdown formatting, no backticks, no explanations.

CRITICAL MEMORY LIMITS: 
- For play-by-play queries spanning more than 2 seasons, use chunking strategy (load in 2-year chunks, filter/select, then combine)
- For "all time" play-by-play queries, use chunking to span many years efficiently
- ALWAYS use select() to choose only needed columns for play-by-play queries
- Always limit results with head() to prevent memory issues

Return ONLY the R code, no markdown formatting, no backticks, no explanations.`;
  }
}

function loadCompactPrompt(): string {
  try {
    const p = join(process.cwd(), "src", "ai_compact.md");
    return readFileSync(p, "utf-8");
  } catch (e) {
    console.error("ai_compact.md missing, using truncated fallback", e);
    return loadAIPrompt().slice(0, 12000);
  }
}

function promptForGemini(): string {
  const mode = process.env.MAGIC_STATS_PROMPT_MODE?.toLowerCase();
  if (mode === "compact") return loadCompactPrompt();
  return loadAIPrompt();
}

console.log("AI prompts: compact file + optional full dict for Gemini");

function generateSimpleInterpretation(query: string, rCode: string): string {
  const lowerQuery = query.toLowerCase();

  if (rCode.includes("load_player_stats") && rCode.includes("arrange(desc(")) {
    if (lowerQuery.includes("top") || lowerQuery.includes("leader")) {
      const match = /head\((\d+)\)/.exec(rCode);
      const limit = match ? match[1] : "10";

      if (rCode.includes("passing_yards")) {
        return `Top ${limit} quarterbacks in passing yards`;
      } else if (rCode.includes("rushing_yards")) {
        return `Top ${limit} running backs in rushing yards`;
      } else if (rCode.includes("receiving_yards")) {
        return `Top ${limit} receivers in receiving yards`;
      } else if (rCode.includes("fantasy_points")) {
        return `Top ${limit} players in fantasy points`;
      } else if (rCode.includes("touchdown")) {
        return `Top ${limit} players in touchdowns`;
      } else if (rCode.includes("sacks")) {
        return `Top ${limit} players in sacks`;
      }
    }
  }

  if (rCode.includes("summarise") && rCode.includes("sum(")) {
    if (lowerQuery.includes("how many") || lowerQuery.includes("total")) {
      if (rCode.includes("touchdown")) {
        return `Total touchdowns`;
      } else if (rCode.includes("yards")) {
        return `Total yards`;
      } else if (rCode.includes("sacks")) {
        return `Total sacks`;
      }
    }
  }

  if (rCode.includes("load_schedules")) {
    return `Game results and schedules`;
  }

  if (rCode.includes("load_rosters")) {
    return `Player roster information`;
  }

  if (rCode.includes("load_pbp")) {
    return `Play-by-play data`;
  }

  return query.replace(/[?]/g, "").trim();
}

async function executeRCode(rCode: string) {
  const response = await fetch(`${API_BASE_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: rCode }),
  });

  if (!response.ok) {
    throw new Error(`R API error: ${response.statusText}`);
  }
  return response.json() as Promise<unknown>;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function openaiCompatibleChat(
  messages: ChatMessage[],
  opts: { model: string; maxTokens: number },
): Promise<string> {
  const baseUrl = getOpenAIBaseUrl();
  const apiKey = process.env.LLM_API_KEY ?? "lm-studio";
  const url = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: 0.15,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 800)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");
  return content;
}

function stripRCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/```r?\n?/gi, "")
    .replace(/```\n?/g, "")
    .replace(/^R\s*\n?/i, "")
    .trim();
}

/**
 * Step 1: small JSON plan (local models handle this better than 130k tokens of dict + R in one shot).
 */
async function planQueryOpenAI(
  query: string,
  model: string,
): Promise<string | null> {
  if (!useMultiStepPipeline()) return null;

  const system = `You are a planner for NFL nflreadr (R) queries. Reply with ONE JSON object only (no markdown fences), keys:
{"datasets":["load_player_stats"|"load_pbp"|"load_schedules"|"load_rosters"],"seasons":[2024],"season_type":"REG"|"POST"|"any","pbp_max_seasons":1,"task":"one short sentence"}
Rules: use at most 2 seasons for load_pbp; prefer 2024 if year unspecified.`;

  const raw = await openaiCompatibleChat(
    [
      { role: "system", content: system },
      { role: "user", content: query },
    ],
    { model, maxTokens: 400 },
  );
  return raw.trim();
}

async function convertToRCodeOpenAI(
  query: string,
  errorContext?: { rCode: string; error: string },
): Promise<{ rCode: string; usageMetadata?: unknown }> {
  const baseUrl = getOpenAIBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "Set LLM_BASE_URL (OpenAI-compatible API base, e.g. http://127.0.0.1:1234/v1 for LM Studio)",
    );
  }

  const model =
    process.env.LLM_MODEL ??
    process.env.LMSTUDIO_MODEL_ID ??
    "local-model";

  const compact = loadCompactPrompt();

  let plan: string | null = null;
  if (!errorContext) {
    try {
      plan = await planQueryOpenAI(query, model);
    } catch (e) {
      console.warn("Plan step failed, continuing with single-shot:", e);
    }
  }

  const parts: string[] = [];
  if (plan) parts.push(`QUERY_PLAN_JSON:\n${plan}`);
  parts.push(`USER_QUERY:\n${query}`);
  if (errorContext) {
    parts.push(
      `PREVIOUS_R:\n${errorContext.rCode}\n\nERROR:\n${errorContext.error}`,
    );
  }

  const system = `${compact}

Return ONLY valid R code. No markdown, no backticks, no commentary.`;

  const rRaw = await openaiCompatibleChat(
    [
      { role: "system", content: system },
      { role: "user", content: parts.join("\n\n") },
    ],
    { model, maxTokens: 4096 },
  );

  const rCode = stripRCodeFence(rRaw);
  console.log("Generated R code (openai-compatible):", rCode);

  return {
    rCode,
    usageMetadata: {
      provider: "openai-compatible",
      model,
      baseUrl: baseUrl.slice(0, 48),
    },
  };
}

async function convertToRCodeGemini(
  query: string,
  errorContext?: { rCode: string; error: string },
): Promise<{ rCode: string; usageMetadata?: unknown }> {
  if (!GEMINI_API_KEY || !genAI) {
    throw new Error(
      "Gemini API key not configured (GEMINI_API_KEY), or switch to local LLM with LLM_BASE_URL + MAGIC_STATS_AI_PROVIDER=openai-compatible",
    );
  }

  const aiPrompt = promptForGemini();

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

  let prompt: string;
  if (errorContext) {
    prompt = `${aiPrompt}\n\nYou just attempted to fill a user's request with ${errorContext.rCode} based on their query "${query}". The server returned this error: ${errorContext.error}. Based on your knowledge of nflReadR, please correct the mistake with the R code only.`;
  } else {
    prompt = `${aiPrompt}\n\nUser query: ${query}`;
  }

  const result = await model.generateContent(prompt);
  const rCode = stripRCodeFence(result.response.text());

  console.log("Generated R code (Gemini):", rCode);

  return {
    rCode,
    usageMetadata: result.response.usageMetadata,
  };
}

async function convertToRCode(
  query: string,
  errorContext?: { rCode: string; error: string },
): Promise<{ rCode: string; usageMetadata?: unknown }> {
  const provider = getAIProvider();
  if (provider === "openai-compatible") {
    return convertToRCodeOpenAI(query, errorContext);
  }
  return convertToRCodeGemini(query, errorContext);
}

export async function POST(request: Request) {
  try {
    console.log("API_BASE_URL:", API_BASE_URL, "AI:", getAIProvider());

    const body = (await request.json()) as QueryRequest & {
      useAIScript?: boolean;
    };
    const query = body.query;
    const useAIScript = body.useAIScript !== false; // default true

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const cachedResponse = getCached(query);
    if (cachedResponse) {
      console.log("Serving query from cache:", query);
      return NextResponse.json({ ...cachedResponse, cached: true });
    }

    if (!useAIScript) {
      const dummyRCode = `# AI script disabled for testing\n# Query: ${query}\nhead(data.frame(test_col = c('testing mode'), query = c('${query}')))`;
      return NextResponse.json({
        results: [{ test_col: "testing mode", query }],
        r_code: dummyRCode,
        note: "AI script was disabled for this request.",
      });
    }

    console.log("Processing query:", query);

    let aiResult = await convertToRCode(query);
    let rCode = aiResult.rCode;
    let retryCount = 0;
    const maxRetries = getAIProvider() === "openai-compatible" ? 2 : 1;
    let vpsData: { success?: boolean[]; error?: string[]; result?: unknown } =
      {};

    while (retryCount <= maxRetries) {
      console.log(`Executing R code on VPS (attempt ${retryCount + 1})...`);
      console.log("R code to execute:", rCode);

      const vpsResponse = await executeRCode(rCode);
      console.log("VPS response:", JSON.stringify(vpsResponse, null, 2));

      vpsData = vpsResponse as {
        success?: boolean[];
        error?: string[];
        result?: unknown;
      };

      const raw = vpsResponse as Record<string, unknown>;
      const succ = raw.success;
      const failed =
        succ === false ||
        (Array.isArray(succ) && succ[0] === false);
      if (failed) {
        const errRaw = raw.error;
        const errorMessage =
          (Array.isArray(errRaw) ? errRaw[0] : errRaw) ??
          "R code execution failed";
        const errorMessageStr =
          typeof errorMessage === "string"
            ? errorMessage
            : String(errorMessage);

        if (retryCount < maxRetries) {
          console.log("R code failed, attempting error correction...");
          aiResult = await convertToRCode(query, {
            rCode,
            error: errorMessageStr,
          });
          rCode = aiResult.rCode;
          retryCount++;
          continue;
        } else {
          return NextResponse.json(
            {
              error: errorMessageStr,
              r_code: rCode,
              usage_metadata: aiResult.usageMetadata,
            },
            { status: 400 },
          );
        }
      }

      break;
    }

    const rawResult = vpsData.result;
    if (
      rawResult === null ||
      rawResult === undefined ||
      (Array.isArray(rawResult) && rawResult.length === 0) ||
      (typeof rawResult === "object" && Object.keys(rawResult).length === 0)
    ) {
      return NextResponse.json(
        {
          error: "No results found for this query",
          r_code: rCode,
          usage_metadata: aiResult.usageMetadata,
        },
        { status: 400 },
      );
    }

    let results;
    if (
      rawResult &&
      typeof rawResult === "object" &&
      !Array.isArray(rawResult)
    ) {
      const firstValue = Object.values(rawResult)[0];
      if (Array.isArray(firstValue)) {
        const keys = Object.keys(rawResult);
        const length = firstValue.length;
        results = Array.from({ length }, (_, i) => {
          const obj: Record<string, any> = {};
          keys.forEach((key) => {
            const value = (rawResult as Record<string, unknown>)[key];
            obj[key] = Array.isArray(value) ? (value as unknown[])[i] : value;
          });
          return obj;
        });
      } else {
        results = [rawResult];
      }
    } else {
      results = rawResult;
    }

    const interpretation = generateSimpleInterpretation(query, rCode);

    const usesPlayByPlay = rCode.includes("load_pbp");
    const dataSourceNote =
      "Data: nflreadr → R executor (not Postgres). PBP coverage follows nflverse releases; for warehouse SQL use a separate DB route.";

    const note = usesPlayByPlay
      ? `Note: Play-by-play queries use small season windows. ${dataSourceNote}`
      : dataSourceNote;

    const responseData = {
      results: results,
      interpretation: interpretation,
      query_type: "ai_generated",
      r_code: rCode,
      note: note,
      usage_metadata: aiResult.usageMetadata,
    };

    setCache(query, responseData);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Query error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process query";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
