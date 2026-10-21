"use client";

import { useEffect, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import type { FourthDownPlay, GameAnalysis } from "@/lib/fourth/games";
import { cn } from "@/lib/utils";
import { yardText } from "./decision-card";
import { chance, CHOICE, ChanceBars, Expand, StrengthTag } from "./ui";

export type Nfl4thRow = { go: number; fg: number | null; punt: number | null };

type Verdict = "right" | "close" | "wrong" | "none";
const VERDICT_COLOR: Record<Verdict, string> = {
  right: "#059669",
  close: "#9ca3af",
  wrong: "#dc2626",
  none: "#cbd5e1",
};

/** Within a point of the best choice is a coin flip, not a mistake. */
export function verdictOf(p: FourthDownPlay): Verdict {
  if (!p.decision) return "none";
  if (p.decision.best === p.actual) return "right";
  return p.cost > -1 ? "close" : "wrong";
}

const H = 170;
const W = 720;
const PAD = { l: 34, r: 10, t: 10, b: 24 };

/** One team's chance to win across the game, with each of its 4th downs marked. */
function WpTimeline({ g, focus }: { g: GameAnalysis; focus: string }) {
  const focusHome = g.home === focus;
  const maxEl = Math.max(3600, ...g.timeline.map((p) => p.elapsed));
  const x = (el: number) => PAD.l + (el / maxEl) * (W - PAD.l - PAD.r);
  const y = (wp: number) => PAD.t + (1 - wp) * (H - PAD.t - PAD.b);
  const wpFocus = (homeWp: number) => (focusHome ? homeWp : 1 - homeWp);
  const path = g.timeline
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(p.elapsed).toFixed(1)},${y(wpFocus(p.homeWp)).toFixed(1)}`,
    )
    .join("");
  const wpAt = (el: number) =>
    g.timeline.reduce(
      (best, t) =>
        Math.abs(t.elapsed - el) < Math.abs(best.elapsed - el) ? t : best,
      g.timeline[0]!,
    ).homeWp;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${focus} chance to win during the game`}
    >
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 0.5 ? "#d1d5db" : "#f3f4f6"}
          />
          <text
            x={PAD.l - 6}
            y={y(v) + 3}
            fontSize={10}
            textAnchor="end"
            fill="#6b7280"
          >
            {v * 100}%
          </text>
        </g>
      ))}
      {[0, 900, 1800, 2700].map((s, i) => (
        <text
          key={s}
          x={(x(s) + x(s + 900)) / 2}
          y={H - 8}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          Q{i + 1}
        </text>
      ))}
      {maxEl > 3600 && (
        <text
          x={(x(3600) + x(maxEl)) / 2}
          y={H - 8}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          OT
        </text>
      )}
      <path d={path} fill="none" stroke="#111827" strokeWidth={1.75} />
      {g.plays
        .filter((p) => p.posteam === focus)
        .map((p) => (
          <circle
            key={p.playId}
            cx={x(p.elapsed)}
            cy={y(wpFocus(wpAt(p.elapsed)))}
            r={5}
            fill={VERDICT_COLOR[verdictOf(p)]}
            stroke="#fff"
            strokeWidth={2}
          >
            <title>{`${p.qtr > 4 ? "OT" : `Q${p.qtr}`} ${p.time}: ${CHOICE[p.actual]}`}</title>
          </circle>
        ))}
    </svg>
  );
}

/** "4th & 3 at the KC 15, down 3" */
export function situationText(p: FourthDownPlay): string {
  const s = p.decision?.situation;
  if (!s) return "";
  const togo = s.ydstogo >= s.yardline ? "goal" : s.ydstogo;
  const score =
    s.scoreDiff === 0
      ? "tied"
      : s.scoreDiff > 0
        ? `up ${s.scoreDiff}`
        : `down ${-s.scoreDiff}`;
  return `4th & ${togo} at ${yardText(s.yardline, p.posteam, p.defteam)}, ${score}`;
}

const when = (p: FourthDownPlay) =>
  p.qtr > 4 ? `Overtime, ${p.time} left` : `Q${p.qtr}, ${p.time} left`;

/** What they did, as a phrase: "Kicked a field goal (good)". */
function didText(p: FourthDownPlay): string {
  if (p.actual === "go")
    return `Went for it${p.worked == null ? "" : p.worked ? " and made it" : " and came up short"}`;
  if (p.actual === "fg")
    return `Kicked a field goal${p.worked == null ? "" : p.worked ? " (good)" : " (missed)"}`;
  return "Punted";
}

/** One decision told as a short story, with the chance-to-win bars. */
export function FeaturedCall({
  p,
  heading,
}: {
  p: FourthDownPlay;
  heading?: string;
}) {
  const d = p.decision!;
  const v = verdictOf(p);
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      {heading && (
        <div className="mb-1 font-semibold text-gray-900">{heading}</div>
      )}
      <div className="text-sm text-gray-600">
        {when(p)}: {situationText(p)}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-gray-900">
        <span className="font-medium">{didText(p)}.</span>
        <span
          className={cn(
            "font-semibold",
            v === "wrong"
              ? "text-red-700"
              : v === "right"
                ? "text-emerald-700"
                : "text-gray-700",
          )}
        >
          {v === "right"
            ? "Right call."
            : v === "close"
              ? "A coin flip either way."
              : `They should have chosen: ${CHOICE[d.best].toLowerCase()}.`}
        </span>
        {v !== "close" && <StrengthTag strength={d.strength} />}
      </div>
      <div className="mt-3 max-w-xl">
        <ChanceBars
          options={d.options.map((o) => ({ key: o.key, wp: o.wp }))}
          best={d.best}
          actual={p.actual}
          size="sm"
        />
      </div>
    </div>
  );
}

function PlayRow({ p, nfl4th }: { p: FourthDownPlay; nfl4th?: Nfl4thRow }) {
  const [open, setOpen] = useState(false);
  const d = p.decision;
  const v = verdictOf(p);
  const Icon = v === "right" ? Check : v === "wrong" ? X : Minus;
  return (
    <div
      className={cn(
        "border-b border-gray-100 last:border-0",
        open && "bg-slate-50",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        disabled={!d}
        onClick={() => setOpen(!open)}
        className="grid w-full grid-cols-[1.25rem_1fr_auto] items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
      >
        <Icon
          className="mt-0.5 size-4"
          style={{ color: VERDICT_COLOR[v] }}
          aria-label={v}
        />
        <span className="text-sm">
          <span className="font-medium text-gray-900">{p.posteam}</span>{" "}
          <span className="text-gray-700">
            {d ? situationText(p) : "overtime 4th down"}
          </span>
          <span className="block text-xs text-gray-600">
            {when(p)}. {didText(p)}.
          </span>
        </span>
        <span className="text-right text-sm whitespace-nowrap">
          {v === "wrong" ? (
            <span className="text-red-700">
              Should{" "}
              {d!.best === "go"
                ? "go for it"
                : d!.best === "fg"
                  ? "kick"
                  : "punt"}
              <span className="block text-xs text-gray-600">
                cost {Math.max(1, Math.round(-p.cost))}% chance to win
              </span>
            </span>
          ) : v === "close" ? (
            <span className="text-gray-600">Coin flip</span>
          ) : v === "right" ? (
            <span className="text-emerald-700">Right call</span>
          ) : (
            <span className="text-gray-400">see overtime</span>
          )}
        </span>
      </button>
      {open && d && (
        <div className="grid gap-4 px-3 pb-4 pl-11 text-sm sm:grid-cols-2">
          <ChanceBars
            options={d.options.map((o) => ({ key: o.key, wp: o.wp }))}
            best={d.best}
            actual={p.actual}
            size="sm"
          />
          <div className="space-y-2 text-gray-600">
            <p className="italic">{p.desc}</p>
            {nfl4th && (
              <p className="text-xs">
                Ben Baldwin&apos;s nfl4th had: go {chance(nfl4th.go)}
                {nfl4th.fg != null && `, field goal ${chance(nfl4th.fg)}`}
                {nfl4th.punt != null && `, punt ${chance(nfl4th.punt)}`}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GameStudy({
  gameId,
  focus,
  title,
  verdict,
  featured = [],
  children,
}: {
  gameId: string;
  /** team whose decisions the story is about */
  focus: string;
  title: string;
  /** one plain-English sentence; generated when omitted */
  verdict?: React.ReactNode;
  /** play ids to show as featured calls, each with an optional heading */
  featured?: { playId: number; heading?: string }[];
  /** the longer write-up, behind "The full story" */
  children?: React.ReactNode;
}) {
  const [g, setG] = useState<GameAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bothTeams, setBothTeams] = useState(false);

  useEffect(() => {
    setG(null);
    fetch(`/api/fourth-down?game=${gameId}`)
      .then((r) => r.json())
      .then((j: GameAnalysis & { error?: string }) =>
        j.error ? setError(j.error) : setG(j),
      )
      .catch((e: Error) => setError(e.message));
  }, [gameId]);

  if (error)
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  if (!g) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;

  const theirs = g.plays.filter((p) => p.posteam === focus && p.decision);
  const count = (v: Verdict) => theirs.filter((p) => verdictOf(p) === v).length;
  const lost = -theirs.reduce((a, p) => a + p.cost, 0);
  const wrong = count("wrong");
  const autoVerdict =
    wrong === 0
      ? `${focus} made the right call on every 4th down that mattered.`
      : `${focus} got ${wrong} 4th down ${wrong === 1 ? "call" : "calls"} wrong, giving up about ${Math.max(1, Math.round(lost))}% in chance to win.`;
  const plays = bothTeams
    ? g.plays
    : g.plays.filter((p) => p.posteam === focus);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <span className="text-sm text-gray-600">
          Final: {g.away} {g.awayScore}, {g.home} {g.homeScore}
        </span>
      </div>
      <p className="mt-2 max-w-3xl text-xl leading-snug font-semibold text-gray-900">
        {verdict ?? autoVerdict}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-700">
        <span className="flex items-center gap-1.5">
          <Check className="size-4 text-emerald-600" aria-hidden />{" "}
          {count("right")} right calls
        </span>
        <span className="flex items-center gap-1.5">
          <X className="size-4 text-red-600" aria-hidden /> {wrong} wrong
        </span>
        {count("close") > 0 && (
          <span className="flex items-center gap-1.5">
            <Minus className="size-4 text-gray-400" aria-hidden />{" "}
            {count("close")} coin {count("close") === 1 ? "flip" : "flips"}
          </span>
        )}
      </div>

      {featured.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {featured.map((f) => {
            const p = g.plays.find((x) => x.playId === f.playId);
            return p?.decision ? (
              <FeaturedCall key={f.playId} p={p} heading={f.heading} />
            ) : null;
          })}
        </div>
      )}

      <div className="mt-4 space-y-1 border-t border-gray-100 pt-3">
        {children && (
          <Expand label="The full story">
            <div className="max-w-3xl space-y-2 text-sm leading-relaxed text-gray-700">
              {children}
            </div>
          </Expand>
        )}
        <Expand
          label={`Every 4th down in this game (${theirs.length} for ${focus})`}
        >
          <div className="mb-2 text-xs text-gray-600">
            {focus}&apos;s chance to win as the game went on. Dots are its 4th
            downs.
          </div>
          <WpTimeline g={g} focus={focus} />
          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>Tap a play for the numbers.</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={bothTeams}
                onChange={(e) => setBothTeams(e.target.checked)}
              />{" "}
              show both teams
            </label>
          </div>
          <div className="mt-2 rounded-md border border-gray-100">
            {plays.map((p) => (
              <PlayRow
                key={p.playId}
                p={p}
                nfl4th={g.nfl4th?.[String(p.playId)]}
              />
            ))}
          </div>
        </Expand>
      </div>
    </section>
  );
}
