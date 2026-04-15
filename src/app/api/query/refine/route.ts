import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getAIProvider,
  getLlmModelName,
  getOpenAIBaseUrl,
  openaiCompatibleChat,
} from "@/lib/magic-llm";

export const maxDuration = 120;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const REFINE_SYSTEM = `You rewrite NFL / nflverse analytics questions into ONE clear English sentence a data analyst would use to specify the query.

Rules:
- Name the metric (e.g. EPA per play, passing yards, completion %), scope (season, regular season vs playoffs), filters (e.g. vs team NE, min 200 attempts), and rank/limit (e.g. top 20).
- **Years and seasons (critical — do not drift):**
  - If the user gives **explicit years or a range** (e.g. "2023-2025", "2023–2025", "2023 to 2025", "2023 through 2025"), you **must preserve those exact endpoints** in your sentence. **Never substitute** a different start year (e.g. do not change 2023→2022). Only rephrase for clarity (e.g. "2023 through 2025 seasons combined").
  - **"since [YEAR]"**, **"from [YEAR] on"**, **"starting [YEAR]"** = **multiple seasons**: from that year through the most recent season that has data. State the range explicitly (e.g. "since 2024" → "2024 and 2025" when applicable).
  - **"in [YEAR]"**, **"during [YEAR]"**, **"the [YEAR] season"** = **that single season only**.
  - **"between X and Y"**, **"X through Y"** = inclusive range; keep X and Y exactly as the user implied unless they were vague.
- If the user omits a season entirely, assume the most recent completed NFL season or say "last N seasons" when they ask for a range.
- Use standard team abbreviations (e.g. NE for Patriots) when relevant.
- Output ONLY that single sentence. No quotes, no markdown, no bullet points, no preamble.`;

async function refineOpenAI(userQuery: string): Promise<string> {
  const baseUrl = getOpenAIBaseUrl();
  if (!baseUrl) {
    throw new Error(
      "Set LLM_BASE_URL / LMSTUDIO_BASE_URL for OpenAI-compatible API",
    );
  }
  const model = getLlmModelName();
  const raw = await openaiCompatibleChat(
    [
      { role: "system", content: REFINE_SYSTEM },
      { role: "user", content: userQuery },
    ],
    { model, maxTokens: 400, temperature: 0.2 },
  );
  return raw.replace(/^["']|["']$/g, "").trim();
}

async function refineGemini(userQuery: string): Promise<string> {
  if (!GEMINI_API_KEY || !genAI) {
    throw new Error("GEMINI_API_KEY not set for Gemini refine");
  }
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  const prompt = `${REFINE_SYSTEM}\n\nUser question:\n${userQuery}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/^["']|["']$/g, "").trim();
    if (text.length > 0) return text;
    console.warn(`refineGemini: empty text, retry ${attempt + 1}/3`);
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const q = body.query?.trim();
    if (!q) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const provider = getAIProvider();
    let refinedQuery = q;
    try {
      const out =
        provider === "openai-compatible"
          ? await refineOpenAI(q)
          : await refineGemini(q);
      const t = out.trim();
      if (t.length > 0) refinedQuery = t;
      else console.warn("refine: empty output, using original query");
    } catch (e) {
      console.warn("refine: failed, using original query", e);
    }

    return NextResponse.json({ refinedQuery, originalQuery: q });
  } catch (e) {
    console.error("refine error:", e);
    const msg = e instanceof Error ? e.message : "Refine failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
