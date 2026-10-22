"use client";

import toast from "react-hot-toast";
import { Copy, Share2 } from "lucide-react";
import type { Finding, ProofResult } from "@/lib/sports/prove/engine";
import { cn } from "@/lib/utils";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
};

const placeLabel = (f: Finding, worst = false) =>
  `${f.tied ? "Tied for " : ""}${worst ? (f.rank === 1 ? "last" : `${ordinal(f.rank)}-worst`) : ordinal(f.rank)} of ${f.pool} ${f.noun}`;

/** One line for the group chat. */
function bragText(proof: ProofResult, f: Finding): string {
  const me = f.rows.find((r) => r.target);
  return `${proof.player}: ${f.title.charAt(0).toLowerCase()}${f.title.slice(1)} (${me?.value}), ${placeLabel(f, proof.worst).toLowerCase()} in the ${proof.scope}.`;
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Couldn't copy");
  }
}

const secondaryButton =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-turf-700";

export function ProofResults({
  proof,
  onShare,
}: {
  proof: ProofResult;
  /** Omitted on the public share page. */
  onShare?: () => void;
}) {
  const leads = proof.findings.filter((f) => f.rank === 1).length;
  const who = proof.isTeam ? `the ${proof.player}` : proof.player;
  const Who = who.charAt(0).toUpperCase() + who.slice(1);
  const ranks = proof.isTeam ? "rank" : "ranks";
  return (
    <section className="mt-8 min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-tight font-bold text-slate-900">
            The case {proof.worst ? "against" : "for"} {who}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {proof.worst
              ? proof.findings.length === 0
                ? `Tough case to make: ${who} ${proof.isTeam ? "aren't" : "isn't"} in the bottom 3 of any split in the ${proof.scope}.`
                : leads === proof.findings.length
                  ? `${leads} splits from the ${proof.scope} where ${who} ${ranks} last among qualified ${proof.isTeam ? "teams" : "players"}.`
                  : `${Who} ${proof.isTeam ? "aren't" : "isn't"} dead last in many splits in the ${proof.scope}, so this includes the ones where ${proof.isTeam ? "they're" : "he's"} 2nd- or 3rd-worst.`
              : proof.findings.length === 0
                ? `Couldn't find a split in the ${proof.scope} where ${who} ${ranks} in the top 3.`
                : leads === proof.findings.length
                  ? `${leads} splits from the ${proof.scope} where ${who} ${ranks} first among qualified ${proof.isTeam ? "teams" : "players"}.`
                  : `${Who} ${proof.isTeam ? "don't" : "doesn't"} lead many splits in the ${proof.scope}, so this includes the ones where ${proof.isTeam ? "they're" : "he's"} 2nd or 3rd.`}
          </p>
          {proof.note && (
            <p className="mt-1 text-sm text-amber-800">{proof.note}</p>
          )}
        </div>
        {onShare && (
          <button type="button" onClick={onShare} className={secondaryButton}>
            <Share2 className="size-4" aria-hidden />
            Share
          </button>
        )}
      </div>

      <ol className="mt-5 grid gap-4 lg:grid-cols-2">
        {proof.findings.map((f) => (
          <li
            key={f.title + f.noun}
            className="flex min-w-0 flex-col rounded-lg border border-slate-200 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg leading-snug font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p
                  className={cn(
                    "mt-0.5 text-sm font-medium",
                    f.rank === 1 && !f.tied
                      ? "text-turf-800"
                      : "text-slate-600",
                  )}
                >
                  {placeLabel(f, proof.worst)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copy(bragText(proof, f), "Copied")}
                className="focus-visible:outline-turf-700 shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2"
                title="Copy this stat as a sentence"
              >
                <Copy className="size-4" aria-hidden />
                <span className="sr-only">Copy this stat</span>
              </button>
            </div>
            <table className="mt-3 w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th scope="col" className="w-8 py-1.5 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-1.5 font-medium">
                    {f.entity}
                  </th>
                  <th
                    scope="col"
                    className="py-1.5 pr-3 text-right font-medium"
                  >
                    {f.column}
                  </th>
                  <th scope="col" className="py-1.5 text-right font-medium">
                    {f.sampleLabel.charAt(0).toUpperCase() +
                      f.sampleLabel.slice(1)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {f.rows.map((r) => (
                  <tr
                    key={`${r.player}-${r.team}`}
                    className={cn(
                      "border-b border-slate-100 last:border-0",
                      r.target && "bg-turf-50 font-semibold text-slate-900",
                    )}
                  >
                    <td className="py-1.5 pl-1 text-slate-500">{r.rank}</td>
                    <td className="py-1.5 break-words">
                      {r.player}
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        {r.team}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right">{r.value}</td>
                    <td className="py-1.5 text-right text-slate-500">
                      {r.sample.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-auto pt-2 text-xs text-slate-500">
              Minimum {f.minSample.toLocaleString("en-US")} {f.sampleLabel} to
              qualify.
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
