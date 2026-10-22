"use client";

import { Toaster } from "react-hot-toast";
import { SPORT_ASK } from "@/components/ask/examples";
import { ProofResults } from "@/components/ask/proof-results";
import { hideIdColumns, ResultsTable } from "@/components/ask/results-table";
import { QueryChart } from "@/components/charts/query-chart";
import type { Share } from "@/lib/sports/shares";
import { SPORT_LABEL } from "@/lib/sports/types";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** A shared answer, frozen as it was when shared. Read-only. */
export function SharedAnswer({ share }: { share: Share }) {
  const { answer } = share;
  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <p className="text-sm text-slate-500">
        {SPORT_LABEL[share.sport]} question, answered {dateLabel(share.created)}
      </p>
      {"kind" in answer ? (
        <>
          <h1 className="font-display mt-1 text-3xl leading-tight font-bold text-slate-900 sm:text-4xl">
            {share.question}
          </h1>
          <ProofResults proof={answer} />
        </>
      ) : (
        <>
          <h1 className="font-display mt-1 text-3xl leading-tight font-bold text-slate-900 sm:text-4xl">
            {share.question}
          </h1>
          {answer.explain && (
            <p className="mt-3 max-w-prose text-lg text-slate-700">
              {answer.explain}
            </p>
          )}
          <section className="mt-6 min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
            {share.chart && (
              <div className="mb-4">
                <QueryChart
                  rows={answer.results}
                  columns={answer.columns}
                  initial={share.chart}
                  teamColors={answer.team_colors}
                  question={share.question}
                  truncated={answer.truncated}
                  source={SPORT_ASK[share.sport].source}
                />
              </div>
            )}
            <ResultsTable data={hideIdColumns(answer.results)} />
            {answer.truncated && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the first {answer.results.length} rows.
              </p>
            )}
          </section>
        </>
      )}
      <p className="mt-8 text-sm text-slate-500">
        Answered by Magic Stats from {SPORT_ASK[share.sport].source} data.
      </p>
      <Toaster position="bottom-center" />
    </main>
  );
}
