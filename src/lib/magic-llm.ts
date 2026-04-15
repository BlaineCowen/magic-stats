export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getOpenAIBaseUrl(): string {
  const u =
    process.env.LLM_BASE_URL ??
    process.env.LMSTUDIO_BASE_URL ??
    process.env.LM_STUDIO_URL ??
    process.env.OPENAI_BASE_URL ??
    "";
  return u.replace(/\/$/, "");
}

export function getAIProvider(): "gemini" | "openai-compatible" {
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

export function getLlmModelName(): string {
  return (
    process.env.LLM_MODEL ??
    process.env.LMSTUDIO_MODEL_ID ??
    "local-model"
  );
}

/** Parse string or multimodal-style content arrays from OpenAI-compatible JSON. */
export function extractOpenAIChatContent(data: unknown): string | null {
  const d = data as {
    choices?: Array<{
      message?: { content?: unknown };
      text?: string;
    }>;
  };
  const ch = d.choices?.[0];
  if (!ch) return null;
  if (typeof ch.text === "string" && ch.text.trim()) return ch.text.trim();

  const raw = ch.message?.content;
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  if (Array.isArray(raw)) {
    let s = "";
    for (const part of raw) {
      if (typeof part === "string") s += part;
      else if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof (part as { text: unknown }).text === "string"
      ) {
        s += (part as { text: string }).text;
      }
    }
    const t = s.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

const OPENAI_EMPTY_RETRIES = 3;
const OPENAI_RETRY_DELAY_MS = 300;

export async function openaiCompatibleChat(
  messages: ChatMessage[],
  opts: { model: string; maxTokens: number; temperature?: number },
): Promise<string> {
  const baseUrl = getOpenAIBaseUrl();
  const apiKey = process.env.LLM_API_KEY ?? "lm-studio";
  const url = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < OPENAI_EMPTY_RETRIES; attempt++) {
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
        temperature: opts.temperature ?? 0.15,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 800)}`);
    }

    const data: unknown = await res.json();
    const content = extractOpenAIChatContent(data);
    if (content) return content;

    lastErr = new Error("LLM returned empty content");
    if (attempt < OPENAI_EMPTY_RETRIES - 1) {
      console.warn(
        `openaiCompatibleChat: empty response, retry ${attempt + 1}/${OPENAI_EMPTY_RETRIES}`,
      );
      await new Promise((r) =>
        setTimeout(r, OPENAI_RETRY_DELAY_MS * (attempt + 1)),
      );
    }
  }
  throw lastErr ?? new Error("LLM returned empty content");
}

export function stripRCodeFence(raw: string): string {
  return raw
    .trim()
    .replace(/```r?\n?/gi, "")
    .replace(/```\n?/g, "")
    .replace(/^R\s*\n?/i, "")
    .trim();
}
