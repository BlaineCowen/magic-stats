import { NextResponse } from "next/server";
import { dataVersion } from "@/lib/sports/db";
import { cacheKey, getCached, setCache } from "@/lib/sports/answer-cache";
import {
  answerQuestion,
  PipelineError,
  type QueryMode,
} from "@/lib/sports/pipeline";
import { proveClaim } from "@/lib/sports/prove/engine";
import { isProofQuestion } from "@/lib/sports/prove/parse";
import { stashAnswer } from "@/lib/sports/shares";
import { isSport, type Sport } from "@/lib/sports/types";
import { admit, MAX_QUESTION_CHARS, viewerFrom } from "@/lib/query-limits";

// Deep mode waits on the model's thinking (~2-3 min on qwen 9B).
export const maxDuration = 300;
export const runtime = "nodejs";

type QueryRequest = {
  query?: string;
  mode?: QueryMode;
  sport?: string;
  nocache?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as QueryRequest;
  const query = body.query?.trim();
  const mode: QueryMode = body.mode === "deep" ? "deep" : "fast";
  // Older clients don't send a sport; they only ever asked about the NFL.
  const sport: Sport = isSport(body.sport) ? body.sport : "nfl";
  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }
  if (query.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `Keep questions under ${MAX_QUESTION_CHARS} characters.` },
      { status: 400 },
    );
  }

  // "Prove X is the best": searched straight from the data, no model involved,
  // so it doesn't count against the limits. Falls through when no player matches.
  if (isProofQuestion(query)) {
    const proofKey = cacheKey(sport, "prove", dataVersion(sport), query);
    const hit = body.nocache ? null : getCached(proofKey);
    if (hit)
      return NextResponse.json({
        ...hit,
        cached: true,
        answer_id: stashAnswer(sport, query, hit),
      });
    try {
      const proof = await proveClaim(sport, query);
      if (proof) {
        setCache(proofKey, proof);
        return NextResponse.json({
          ...proof,
          answer_id: stashAnswer(sport, query, proof),
        });
      }
    } catch (error) {
      console.error("Proof error:", (error as Error).message);
    }
  }

  const key = cacheKey(sport, mode, dataVersion(sport), query);
  const cached = body.nocache ? null : getCached(key);
  if (cached)
    return NextResponse.json({
      ...cached,
      cached: true,
      answer_id: stashAnswer(sport, query, cached),
    });

  // only questions that reach the paid model count against the limits
  const gate = admit(viewerFrom(request.headers), mode === "deep");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error, mode },
      {
        status: gate.status,
        headers: gate.retryAfter
          ? { "Retry-After": String(gate.retryAfter) }
          : undefined,
      },
    );
  }

  try {
    const result = await answerQuestion(query, mode, sport);
    setCache(key, result);
    return NextResponse.json({
      ...result,
      answer_id: stashAnswer(sport, query, result),
    });
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
  } finally {
    gate.release();
  }
}
