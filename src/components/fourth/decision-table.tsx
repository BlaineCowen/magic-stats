"use client";

import type { Decision, Option, OptionKey } from "@/lib/fourth/engine";
import { cn } from "@/lib/utils";
import { yardText } from "./decision-card";
import { chance, CHOICE, CHOICE_COLOR, StrengthTag, TEAM_NAME } from "./ui";

/**
 * One 4th down decision with every number visible, after Ben Baldwin's nfl4th table:
 * the answer on top, then one row per choice with its chance to win and what happens
 * if it works or doesn't, in words instead of footnoted column names.
 */

const ORDER: OptionKey[] = ["go", "fg", "punt"];

/** What "it works" means for each choice. */
const WORKS: Record<OptionKey, { yes: string; no: string; how: string }> = {
  go: { yes: "if they get it", no: "if they don't", how: "get the first down" },
  fg: { yes: "if it's good", no: "if it's missed", how: "make it" },
  punt: { yes: "", no: "", how: "" },
};

function scoreText(diff: number) {
  return diff === 0 ? "Tied" : diff > 0 ? `Up ${diff}` : `Down ${-diff}`;
}

function clockText(qtr: number, clock: number) {
  const m = Math.floor(clock / 60);
  const s = clock % 60;
  const left = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s} seconds`;
  const end =
    qtr === 2
      ? "the half"
      : qtr === 4
        ? "the game"
        : `the ${qtr === 1 ? "1st" : "3rd"} quarter`;
  return `${left} left in ${end}`;
}

/** "Up 6, 4th & 3 at the opponent's 23" */
export function headline(d: Decision, team?: string, opp?: string): string {
  const s = d.situation;
  const togo = s.ydstogo >= s.yardline ? "goal" : s.ydstogo;
  return `${scoreText(s.scoreDiff)}, 4th & ${togo} at ${yardText(s.yardline, team, opp)}`;
}

function context(d: Decision, team?: string) {
  const s = d.situation;
  const who = team ? (TEAM_NAME[team] ?? team) : "Offense";
  return `${clockText(s.qtr, s.clock)}. Timeouts: ${who} ${s.offTimeouts}, opponent ${s.defTimeouts}.`;
}

function puntNote(o: Option) {
  return `other team starts around its own ${Math.round(o.detail.oppStart ?? 0)}`;
}

/** The per-choice sentence used on phones and in compact mode. */
function rowSentence(o: Option) {
  if (o.key === "punt") return `The ${puntNote(o)}.`;
  const w = WORKS[o.key];
  return `${o.key === "fg" ? `${o.detail.distance} yards, good` : "They convert"} ${chance(o.successProb)} of the time. ${chance(o.wpSuccess)} ${w.yes}, ${chance(o.wpFail)} ${w.no}.`;
}

export function DecisionTable({
  d,
  team,
  opp,
  actual,
  compact = false,
  showHeading = true,
}: {
  d: Decision;
  /** offense and defense codes, for "the KC 23" and timeout labels */
  team?: string;
  opp?: string;
  /** what the team actually did, when grading a real play */
  actual?: OptionKey;
  /** smaller type for lists */
  compact?: boolean;
  showHeading?: boolean;
}) {
  const rows = ORDER.map((k) => d.options.find((o) => o.key === k)).filter(
    (o): o is Option => !!o,
  );
  const best = rows.find((o) => o.key === d.best)!;
  const next = rows
    .filter((o) => o.key !== d.best)
    .sort((a, b) => b.wp - a.wp)[0];
  const tight = d.strength === "toss-up";

  return (
    <div className={cn("text-gray-800", compact ? "text-sm" : "")}>
      {showHeading && (
        <div className="mb-2">
          <div
            className={cn(
              "font-semibold text-gray-900",
              compact ? "text-base" : "text-lg",
            )}
          >
            {headline(d, team, opp)}
          </div>
          <div className="text-sm text-gray-600">{context(d, team)}</div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-gray-600">Best call:</span>
        <span
          className={cn("font-bold", compact ? "text-base" : "text-xl")}
          style={{ color: CHOICE_COLOR[d.best] }}
        >
          {CHOICE[d.best]}
        </span>
        <StrengthTag strength={d.strength} />
        {next && (
          <span className="text-sm text-gray-600">
            {tight ? "Either is fine: " : ""}
            {chance(best.wp)} to win vs {chance(next.wp)} for{" "}
            {next.key === "go"
              ? "going for it"
              : CHOICE[next.key].toLowerCase()}
          </span>
        )}
      </div>

      {/* wide screens: a table with plain-language column names */}
      <table
        className={cn("mt-3 hidden w-full sm:table", compact ? "text-sm" : "")}
      >
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-600">
            <th className="py-1.5 pr-3 font-medium">Choice</th>
            <th className="w-[38%] py-1.5 pr-3 font-medium">Chance to win</th>
            <th className="py-1.5 pr-3 font-medium">How often it works</th>
            <th className="py-1.5 pr-3 font-medium">Win chance if it works</th>
            <th className="py-1.5 font-medium">Win chance if not</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const isBest = o.key === d.best;
            return (
              <tr
                key={o.key}
                className={cn(
                  "border-b border-gray-100 last:border-0",
                  isBest && "bg-slate-50",
                )}
              >
                <td className="py-2 pr-3">
                  <div
                    className={cn(
                      isBest ? "font-semibold text-gray-900" : "text-gray-700",
                    )}
                  >
                    {CHOICE[o.key]}
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[11px] leading-tight whitespace-nowrap">
                    {isBest && (
                      <span className="font-semibold text-emerald-700">
                        Best call
                      </span>
                    )}
                    {actual === o.key && (
                      <span className="font-semibold text-gray-700">
                        What they did
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1 rounded-full bg-gray-100">
                      <div
                        className="h-3 rounded-full"
                        style={{
                          width: `${Math.max(2, o.wp * 100)}%`,
                          background: CHOICE_COLOR[o.key],
                          opacity: isBest ? 1 : 0.45,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-10 text-right tabular-nums",
                        isBest ? "font-bold text-gray-900" : "text-gray-700",
                      )}
                    >
                      {chance(o.wp)}
                    </span>
                  </div>
                </td>
                {o.key === "punt" ? (
                  <td colSpan={3} className="py-2 text-sm text-gray-600">
                    The {puntNote(o)}
                  </td>
                ) : (
                  <>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                      {chance(o.successProb)}{" "}
                      <span className="text-xs text-gray-600">
                        {o.key === "fg"
                          ? `(${o.detail.distance} yd kick)`
                          : "convert"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                      {chance(o.wpSuccess)}
                    </td>
                    <td className="py-2 whitespace-nowrap tabular-nums">
                      {chance(o.wpFail)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* phones: one short paragraph per choice */}
      <div className="mt-3 space-y-2 sm:hidden">
        {rows.map((o) => {
          const isBest = o.key === d.best;
          return (
            <div
              key={o.key}
              className={cn("rounded-md p-2.5", isBest ? "bg-slate-50" : "")}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    isBest ? "font-semibold text-gray-900" : "text-gray-700",
                  )}
                >
                  {CHOICE[o.key]}
                  {isBest && (
                    <span className="ml-2 text-[11px] font-semibold text-emerald-700">
                      Best call
                    </span>
                  )}
                  {actual === o.key && (
                    <span className="ml-2 text-[11px] font-semibold text-gray-700">
                      What they did
                    </span>
                  )}
                </span>
                <span className={cn("tabular-nums", isBest ? "font-bold" : "")}>
                  {chance(o.wp)} to win
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${o.wp * 100}%`,
                    background: CHOICE_COLOR[o.key],
                    opacity: isBest ? 1 : 0.45,
                  }}
                />
              </div>
              <div className="mt-1 text-sm text-gray-600">{rowSentence(o)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
