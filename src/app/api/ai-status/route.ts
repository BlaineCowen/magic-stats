import { NextResponse } from "next/server";
import { getLlmModelName, getLlmRootUrl, llmUrl } from "@/lib/magic-llm";

type ModelsResponse = {
  models?: Array<{ key?: string; loaded_instances?: unknown[] }>;
};

export async function GET() {
  const model = getLlmModelName();
  if (!getLlmRootUrl()) {
    return NextResponse.json({ online: false, model, loaded: false });
  }
  try {
    const res = await fetch(llmUrl("/api/v1/models"), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok)
      return NextResponse.json({ online: false, model, loaded: false });
    const data = (await res.json()) as ModelsResponse;
    const entry = data.models?.find((m) => m.key === model);
    return NextResponse.json({
      online: true,
      model,
      // LM Studio can JIT-load an unloaded model, but the first query is slow.
      loaded: Boolean(entry?.loaded_instances?.length),
      available: Boolean(entry),
    });
  } catch {
    return NextResponse.json({ online: false, model, loaded: false });
  }
}
