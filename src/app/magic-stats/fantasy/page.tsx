import fs from "node:fs/promises";
import path from "node:path";
import { Suspense } from "react";
import type { Metadata } from "next";
import {
  FantasyView,
  type BacktestMeta,
} from "@/components/fantasy/fantasy-view";
import { NFL_DATA_DIR } from "@/lib/nfl/db";
import { getProjections } from "@/lib/nfl/fantasy";

export const metadata: Metadata = {
  title: "Fantasy",
  description:
    "NFL breakout watch, next-game projections with floor and ceiling, and usage trends, from a model backtested on 2021 to 2025.",
};

// Projections are rebuilt every morning.
export const dynamic = "force-dynamic";

async function readMeta(): Promise<BacktestMeta> {
  try {
    return JSON.parse(
      await fs.readFile(
        path.join(NFL_DATA_DIR, "projections-meta.json"),
        "utf8",
      ),
    ) as BacktestMeta;
  } catch {
    return {};
  }
}

export default async function FantasyPage() {
  const [projections, meta] = await Promise.all([getProjections(), readMeta()]);
  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Fantasy
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Who&apos;s about to break out, what everyone should score this week,
          and whose usage is moving. PPR scoring.
        </p>
      </header>
      <Suspense>
        <FantasyView projections={projections} meta={meta} />
      </Suspense>
      <p className="mt-8 max-w-3xl text-sm text-slate-500">
        The model learns from every game since 2016: recent and season usage
        (expected fantasy points, snap, target and carry share, red-zone work),
        tracking stats (separation, YAC and rush yards over expected), the Vegas
        team total and spread, opponent strength against the position,
        quarterback play, weather, rest, and teammates who are out.
        {meta.mae != null &&
          ` Backtested on 2021 to 2025, its average miss is ${meta.mae.toFixed(2)} points a game against ${meta.mae_ppr?.toFixed(2)} for season averages.`}{" "}
        Injury news after the morning update isn&apos;t in it.
      </p>
    </main>
  );
}
