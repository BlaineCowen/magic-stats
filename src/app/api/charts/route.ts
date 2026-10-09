import { NextResponse } from "next/server";
import { buildChart, ChartParamsError } from "@/lib/nfl/charts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(await buildChart(params));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build chart";
    if (error instanceof ChartParamsError) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Chart error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
