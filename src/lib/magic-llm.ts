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

/** Server root (e.g. http://100.94.166.110:1234), whether or not the env var ends in /v1. */
export function getLlmRootUrl(): string {
  return getOpenAIBaseUrl().replace(/\/(api\/)?v1$/, "");
}

/** Build an LM Studio URL: llmUrl("/v1/chat/completions"), llmUrl("/api/v1/chat"). */
export function llmUrl(path: string): string {
  return `${getLlmRootUrl()}${path}`;
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
    process.env.LLM_MODEL ?? process.env.LMSTUDIO_MODEL_ID ?? "local-model"
  );
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.LLM_API_KEY ?? "lm-studio"}`,
  };
}

function joinContent(raw: unknown): string | null {
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

/**
 * Parse string or multimodal-style content arrays from OpenAI-compatible JSON.
 * LM Studio puts grammar-constrained (response_format) output from Qwen thinking
 * models in `reasoning_content` and leaves `content` empty, so fall back to it.
 */
export function extractOpenAIChatContent(data: unknown): string | null {
  const d = data as {
    choices?: Array<{
      message?: { content?: unknown; reasoning_content?: unknown };
      text?: string;
    }>;
  };
  const ch = d.choices?.[0];
  if (!ch) return null;
  if (typeof ch.text === "string" && ch.text.trim()) return ch.text.trim();
  return (
    joinContent(ch.message?.content) ??
    joinContent(ch.message?.reasoning_content)
  );
}

export type ResponseFormat = {
  type: "json_schema";
  json_schema: { name: string; strict?: boolean; schema: object };
};

const OPENAI_RETRIES = 3;
const OPENAI_RETRY_DELAY_MS = 300;

export async function openaiCompatibleChat(
  messages: ChatMessage[],
  opts: {
    model: string;
    maxTokens: number;
    temperature?: number;
    responseFormat?: ResponseFormat;
    timeoutMs?: number;
  },
): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < OPENAI_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(llmUrl("/v1/chat/completions"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: opts.model,
          messages,
          max_tokens: opts.maxTokens,
          temperature: opts.temperature ?? 0.15,
          ...(opts.responseFormat
            ? { response_format: opts.responseFormat }
            : {}),
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      });
    } catch (e) {
      // Timeouts won't get better by retrying; connection blips might.
      if (e instanceof Error && e.name === "TimeoutError") {
        throw new Error("LLM request timed out");
      }
      lastErr = new Error(
        `LLM unreachable at ${getLlmRootUrl()}: ${(e as Error).message}`,
      );
      await new Promise((r) =>
        setTimeout(r, OPENAI_RETRY_DELAY_MS * (attempt + 1)),
      );
      continue;
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 800)}`);
    }

    const data: unknown = await res.json();
    const content = extractOpenAIChatContent(data);
    if (content) return content;

    lastErr = new Error("LLM returned empty content");
    if (attempt < OPENAI_RETRIES - 1) {
      console.warn(
        `openaiCompatibleChat: empty response, retry ${attempt + 1}/${OPENAI_RETRIES}`,
      );
      await new Promise((r) =>
        setTimeout(r, OPENAI_RETRY_DELAY_MS * (attempt + 1)),
      );
    }
  }
  throw lastErr ?? new Error("LLM returned empty content");
}

export type NativeChatStats = {
  input_tokens?: number;
  total_output_tokens?: number;
  reasoning_output_tokens?: number;
  tokens_per_second?: number;
  time_to_first_token_seconds?: number;
  model_load_time_seconds?: number;
};

/**
 * LM Studio's native REST API (POST /api/v1/chat). Thinking models reason before
 * answering here (it can't be disabled for Qwen 3.5), so this is slow but more
 * careful than the grammar-constrained OpenAI-compatible path.
 */
export async function nativeChat(opts: {
  systemPrompt: string;
  input: string;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{ content: string; reasoning: string; stats: NativeChatStats }> {
  let res: Response;
  try {
    res = await fetch(llmUrl("/api/v1/chat"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: opts.model ?? getLlmModelName(),
        system_prompt: opts.systemPrompt,
        input: opts.input,
        temperature: opts.temperature ?? 0,
        store: false,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error("LLM request timed out");
    }
    throw new Error(
      `LLM unreachable at ${getLlmRootUrl()}: ${(e as Error).message}`,
    );
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 800)}`);
  }
  const data = (await res.json()) as {
    output?: Array<{ type: string; content?: string }>;
    stats?: NativeChatStats;
  };
  const items = data.output ?? [];
  const content = items
    .filter((o) => o.type === "message")
    .map((o) => o.content ?? "")
    .join("\n")
    .trim();
  const reasoning = items
    .filter((o) => o.type === "reasoning")
    .map((o) => o.content ?? "")
    .join("\n");
  if (!content) throw new Error("LLM returned empty content");
  return { content, reasoning, stats: data.stats ?? {} };
}
