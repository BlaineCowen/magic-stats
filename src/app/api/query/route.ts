import { NextResponse } from "next/server";
import { dataVersion } from "@/lib/nfl/db";
import {
  answerQuestion,
  PipelineError,
  type PipelineResult,
  type QueryMode,
} from "@/lib/nfl/pipeline";

// Deep mode waits on the model's thinking (~2-3 min on qwen 9B).
export const maxDuration = 300;
export const runtime = "nodejs";

type QueryRequest = { query?: string; mode?: QueryMode; nocache?: boolean };

// Bounded LRU keyed by mode + question + data version, so a data refresh
// naturally invalidates old answers.
const CACHE_MAX = 200;
const CACHE_TTL = 1000 * 60 * 60 * 24;
const queryCache = new Map<string, { data: PipelineResult; at: number }>();

function cacheKey(mode: QueryMode, query: string) {
  return `${mode}|${dataVersion()}|${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function getCached(key: string) {
  const hit = queryCache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL) return null;
  queryCache.delete(key);
  queryCache.set(key, hit); // refresh LRU position
  return hit.data;
}

function setCache(key: string, data: PipelineResult) {
  queryCache.set(key, { data, at: Date.now() });
  if (queryCache.size > CACHE_MAX) {
    queryCache.delete(queryCache.keys().next().value!);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as QueryRequest;
  const query = body.query?.trim();
  const mode: QueryMode = body.mode === "deep" ? "deep" : "fast";
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const key = cacheKey(mode, query);
  const cached = body.nocache ? null : getCached(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  try {
    const result = await answerQuestion(query, mode);
    setCache(key, result);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process query";
    console.error("Query error:", message);
    if (error instanceof PipelineError) {
      return NextResponse.json(
        {
          error: message,
          sql: error.attempts.at(-1)?.sql ?? "",
          attempts: error.attempts,
          mode,
        },
        { status: 422 },
      );
    }
    // LLM unreachable / timed out, or the data directory is missing.
    return NextResponse.json({ error: message, mode }, { status: 503 });
  }
}
