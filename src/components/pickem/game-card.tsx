"use client";

import { ChevronDown, ChevronUp, Minus, Pin, Plus } from "lucide-react";
import type { GameResult, Side } from "@/lib/pickem/optimizer";
import type { PickemGame, TeamSide } from "@/lib/pickem/scoreboard";
import { cn } from "@/lib/utils";
import { pickChance, pickStatus, type PickStatus } from "./tally";

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";
const pct = (p: number) => `${Math.round(p * 100)}%`;

function kickoffLabel(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLE: Record<PickStatus, string> = {
  pre: "border-slate-200",
  winning: "border-emerald-400 ring-1 ring-emerald-400/40",
  losing: "border-red-300 ring-1 ring-red-300/40",
  tied: "border-amber-300",
  won: "border-emerald-500 bg-emerald-50/40",
  lost: "border-red-200 bg-red-50/40",
  push: "border-slate-300",
};

function TeamButton({
  t,
  side,
  chosen,
  chance,
  state,
  hasBall,
  onPick,
}: {
  t: TeamSide;
  side: Side;
  chosen: boolean;
  chance: number;
  state: PickemGame["state"];
  hasBall: boolean;
  onPick: (s: Side) => void;
}) {
  const color = t.color ?? "#1e5a3a";
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={() => onPick(side)}
      className={cn(
        "relative flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border-2 px-2.5 py-2 text-left transition-colors sm:px-3",
        focusCls,
        chosen
          ? "text-white"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
      )}
      style={chosen ? { background: color, borderColor: color } : undefined}
    >
      {t.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={t.logo}
          alt=""
          className={cn(
            "size-9 shrink-0 rounded-full object-contain p-0.5 sm:size-10",
            chosen && "bg-white",
          )}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="font-display flex items-center gap-1.5 text-lg leading-tight font-bold">
          {t.abbr}
          {hasBall && (
            <span
              aria-label="has the ball"
              className={cn(
                "size-1.5 rounded-full",
                chosen ? "bg-white" : "bg-amber-500",
              )}
            />
          )}
        </span>
        <span
          className={cn(
            "block text-xs",
            chosen ? "text-white/80" : "text-slate-500",
          )}
        >
          {state === "pre" ? `${t.record ?? ""} · ${pct(chance)}` : t.record}
        </span>
      </span>
      {state !== "pre" && t.score !== null && (
        <span className="font-display text-2xl font-bold tabular-nums">
          {t.score}
        </span>
      )}
    </button>
  );
}

export function GameCard({
  g,
  pick,
  shownRank,
  points,
  n,
  office,
  result,
  pinned,
  onPick,
  onMove,
  onOffice,
  onUnpin,
}: {
  g: PickemGame;
  pick: Side;
  /** The confidence number as your pool writes it. */
  shownRank: number;
  points: number;
  n: number;
  office: { home: number; away: number };
  result: GameResult | undefined;
  pinned: boolean;
  onPick: (s: Side) => void;
  onMove: (dir: 1 | -1) => void;
  onOffice: (o: { home: number; away: number }) => void;
  onUnpin: () => void;
}) {
  const status = pickStatus(g, pick);
  const live = g.state === "in";
  const chosenTeam = pick === "home" ? g.home : g.away;
  const myChance = pickChance(g, pick);
  const liveHome = live && g.liveHome !== null ? g.liveHome : null;
  const spreadText =
    g.spread === null
      ? "No line"
      : g.spread < 0
        ? `${g.home.abbr} ${g.spread}`
        : g.spread > 0
          ? `${g.away.abbr} -${g.spread}`
          : "Pick'em";
  const officeTotal = office.home + office.away;

  return (
    <li
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm sm:p-4",
        STATUS_STYLE[status],
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "font-display flex h-9 min-w-9 items-center justify-center rounded-lg px-1.5 text-xl font-bold tabular-nums",
            status === "won"
              ? "bg-emerald-600 text-white"
              : status === "lost"
                ? "bg-red-600 text-white line-through"
                : "bg-turf-950 text-white",
          )}
          title={`${points} point${points === 1 ? "" : "s"}`}
        >
          {shownRank}
        </span>
        <span className="text-xs text-slate-500">
          {points === n
            ? "Surest pick"
            : points === 1
              ? "Least sure"
              : `${points} pts`}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
          {live && (
            <span className="flex items-center gap-1 text-red-600">
              <span className="size-1.5 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />
              {g.detail}
            </span>
          )}
          {g.state === "post" && (
            <span className="text-slate-600">{g.detail}</span>
          )}
          {g.state === "pre" && (
            <span className="text-slate-500">{kickoffLabel(g.kickoff)}</span>
          )}
        </span>
      </div>

      <div className="flex gap-2">
        <TeamButton
          t={g.away}
          side="away"
          chosen={pick === "away"}
          chance={1 - g.pHome}
          state={g.state}
          hasBall={live && g.possession === "away"}
          onPick={onPick}
        />
        <TeamButton
          t={g.home}
          side="home"
          chosen={pick === "home"}
          chance={g.pHome}
          state={g.state}
          hasBall={live && g.possession === "home"}
          onPick={onPick}
        />
      </div>

      {liveHome !== null && (
        <div className="mt-2.5">
          <div
            className="flex h-2 overflow-hidden rounded-full bg-slate-100"
            aria-hidden
          >
            {/* Your side in its team colour, the other grey, so two navy
                teams stay readable. */}
            <div
              style={{
                width: pct(1 - liveHome),
                background:
                  pick === "away" ? (g.away.color ?? "#1e5a3a") : "#cbd5e1",
              }}
            />
            <div
              style={{
                width: pct(liveHome),
                background:
                  pick === "home" ? (g.home.color ?? "#1e5a3a") : "#cbd5e1",
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-500 tabular-nums">
            <span>
              {g.away.abbr} {pct(1 - liveHome)}
            </span>
            <span>
              {g.downDistance}
              {g.redZone && (
                <span className="ml-1 font-semibold text-red-600">
                  Red zone
                </span>
              )}
            </span>
            <span>
              {g.home.abbr} {pct(liveHome)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
        {(g.spread !== null || g.state === "pre") && <span>{spreadText}</span>}
        {g.overUnder !== null && <span>O/U {g.overUnder}</span>}
        <span
          className={cn(status !== "pre" && "font-semibold text-slate-800")}
        >
          {chosenTeam.abbr}{" "}
          {status === "won"
            ? "won"
            : status === "lost"
              ? "lost"
              : `${pct(myChance)} to win`}
        </span>
        {result?.faded && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
            Fading the crowd
          </span>
        )}
        {pinned && (
          <button
            type="button"
            onClick={onUnpin}
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700",
              focusCls,
            )}
            title="Held when you optimize. Tap to unpin."
          >
            <Pin className="size-3" aria-hidden /> Pinned
          </button>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={points >= n}
            aria-label="More confident"
            className={cn(
              "rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30",
              focusCls,
            )}
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={points <= 1}
            aria-label="Less confident"
            className={cn(
              "rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-30",
              focusCls,
            )}
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      <details className="group mt-2 text-xs text-slate-600">
        <summary
          className={cn(
            "cursor-pointer list-none font-medium text-slate-500 hover:text-slate-800 [&::-webkit-details-marker]:hidden",
            focusCls,
          )}
        >
          Office picks
          {officeTotal > 0
            ? `: ${g.away.abbr} ${office.away}, ${g.home.abbr} ${office.home}`
            : " (tap to enter)"}
          {result && officeTotal > 0 && (
            <span
              className={cn(
                "ml-2",
                result.leverage > 0.05
                  ? "text-emerald-700"
                  : result.leverage < -0.05
                    ? "text-red-700"
                    : "",
              )}
              title="Your pick's chance to win minus the share of your office on it"
            >
              leverage {result.leverage > 0 ? "+" : ""}
              {Math.round(result.leverage * 100)}
            </span>
          )}
        </summary>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {(["away", "home"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1.5">
              <span className="w-9 font-semibold text-slate-700">
                {g[side].abbr}
              </span>
              <button
                type="button"
                aria-label={`One fewer picking ${g[side].abbr}`}
                onClick={() =>
                  onOffice({ ...office, [side]: Math.max(0, office[side] - 1) })
                }
                className={cn(
                  "rounded-md border border-slate-200 p-1 hover:bg-slate-50",
                  focusCls,
                )}
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={office[side] || ""}
                placeholder="0"
                onChange={(e) =>
                  onOffice({
                    ...office,
                    [side]: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                aria-label={`People picking ${g[side].abbr}`}
                className="w-12 rounded-md border border-slate-300 px-1.5 py-1 text-center tabular-nums"
              />
              <button
                type="button"
                aria-label={`One more picking ${g[side].abbr}`}
                onClick={() =>
                  onOffice({ ...office, [side]: office[side] + 1 })
                }
                className={cn(
                  "rounded-md border border-slate-200 p-1 hover:bg-slate-50",
                  focusCls,
                )}
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </details>
    </li>
  );
}
