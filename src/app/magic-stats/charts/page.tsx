import { Suspense } from "react";
import type { Metadata } from "next";
import { ChartsView } from "@/components/charts/charts-view";

export const metadata: Metadata = {
  title: "NFL Charts",
  description:
    "Team tiers and quarterback efficiency by season, week and situation.",
};

export default function ChartsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Charts
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          How good each offense, defense and quarterback really is, measured in
          expected points added per play. Up and right is better.
        </p>
      </header>
      {/* ChartsView reads the URL's search params, which needs a Suspense boundary. */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-10 w-72 animate-pulse rounded-lg bg-slate-200/70" />
            <div className="h-32 animate-pulse rounded-lg bg-slate-200/70" />
            <div className="aspect-[1000/680] animate-pulse rounded-lg bg-slate-200/70" />
          </div>
        }
      >
        <ChartsView />
      </Suspense>
    </main>
  );
}
