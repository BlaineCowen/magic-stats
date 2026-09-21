import { NextResponse } from "next/server";
import { getAIProvider, getOpenAIBaseUrl } from "@/lib/magic-llm";

export async function GET() {
  const provider = getAIProvider();

  if (provider !== "openai-compatible") {
    return NextResponse.json({ provider, online: true });
  }

  const baseUrl = getOpenAIBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ provider, online: false });
  }

  const modelsUrl = baseUrl.endsWith("/v1")
    ? `${baseUrl}/models`
    : `${baseUrl}/v1/models`;

  try {
    const res = await fetch(modelsUrl, {
      signal: AbortSignal.timeout(3000),
    });
    return NextResponse.json({ provider, online: res.ok });
  } catch {
    return NextResponse.json({ provider, online: false });
  }
}
