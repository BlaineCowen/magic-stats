"use client";

import { useEffect, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import type { FourthDownPlay, GameAnalysis } from "@/lib/fourth/games";
import { cn } from "@/lib/utils";
import {
  OPTION_COLOR,
  OPTION_LABEL,
  pct,
  StrengthBadge,
  yardText,
} from "./decision-card";

export type Nfl4thRow = { go: number; fg: number | null; punt: number | null };

const H = 180;

type Verdict = "right" | "close" | "wrong" | "none";
const VERDICT_COLOR: Record<Verdict, string> = {
  right: "#059669",
  close: "#9ca3af",
  wrong: "#dc2626",
  none: "#cbd5e1",
};

/** Within a point of the best choice is a close call, not a mistake. */
export function verdictOf(p: FourthDownPlay): Verdict {
  if (!p.decision) return "none";
  if (p.decision.best === p.actual) return "right";
  return p.cost > -1 ? "close" : "wrong";
}
const W = 720;
const PAD = { l: 34, r: 10, t: 10, b: 24 };

/** Home team's win probability across the game, with each 4th down marked. */
function WpTimeline({
  g,
  focus,
  selected,
  onSelect,
}: {
  g: GameAnalysis;
  focus: string;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
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
      aria-label={`${focus} win probability`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
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
            fill="#9ca3af"
          >
            {v * 100}%
          </text>
        </g>
      ))}
      {[0, 900, 1800, 2700].map((s, i) => (
        <g key={s}>
          <line
            x1={x(s)}
            x2={x(s)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="#f3f4f6"
          />
          <text
            x={(x(s) + x(s + 900)) / 2}
            y={H - 8}
            fontSize={10}
            textAnchor="middle"
            fill="#9ca3af"
          >
            Q{i + 1}
          </text>
        </g>
      ))}
      {maxEl > 3600 && (
        <>
          <line
            x1={x(3600)}
            x2={x(3600)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="#e5e7eb"
          />
          <text
            x={(x(3600) + x(maxEl)) / 2}
            y={H - 8}
            fontSize={10}
            textAnchor="middle"
            fill="#9ca3af"
          >
            OT
          </text>
        </>
      )}
      <path d={path} fill="none" stroke="#111827" strokeWidth={1.75} />
      {g.plays.map((p) => {
        const ours = p.posteam === focus;
        const v = verdictOf(p);
        return (
          <circle
            key={p.playId}
            cx={x(p.elapsed)}
            cy={y(wpFocus(wpAt(p.elapsed)))}
            r={selected === p.playId ? 7 : 5}
            fill={VERDICT_COLOR[v]}
            fillOpacity={ours ? 1 : 0.35}
            stroke="#fff"
            strokeWidth={2}
            className="cursor-pointer"
            onClick={() => onSelect(p.playId)}
          >
            <title>{`${p.posteam} 4th down, ${p.qtr > 4 ? "OT" : `Q${p.qtr}`} ${p.time}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function situationText(p: FourthDownPlay): string {
  const s = p.decision?.situation;
  if (!s) return "";
  const togo = s.ydstogo >= s.yardline ? "goal" : s.ydstogo;
  const score =
    s.scoreDiff === 0
      ? "tied"
      : s.scoreDiff > 0
        ? `up ${s.scoreDiff}`
        : `down ${-s.scoreDiff}`;
  return `4th & ${togo} at ${yardText(s.yardline)}, ${score}`;
}

export function PlayRow({
  p,
  nfl4th,
  open,
  onToggle,
}: {
  p: FourthDownPlay;
  nfl4th?: Nfl4thRow;
  open: boolean;
  onToggle: () => void;
}) {
  const d = p.decision;
  const verdict = verdictOf(p);
  const n4Best = nfl4th
    ? (
        Object.entries({ go: nfl4th.go, fg: nfl4th.fg, punt: nfl4th.punt }) as [
          keyof typeof OPTION_LABEL,
          number | null,
        ][]
      )
        .filter(([, v]) => v != null)
        .sort((a, b) => b[1]! - a[1]!)
    : null;
  return (
    <div
      className={cn(
        "border-b border-gray-100 last:border-0",
        open && "bg-slate-50",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 sm:grid-cols-[4.5rem_3rem_1fr_9rem_9rem]"
      >
        <span className="text-xs text-gray-500 tabular-nums">
          {p.qtr > 4 ? "OT" : `Q${p.qtr}`} {p.time}
        </span>
        <span className="hidden text-sm font-semibold text-gray-800 sm:block">
          {p.posteam}
        </span>
        <span className="text-sm text-gray-800">
          <span className="font-semibold sm:hidden">{p.posteam} </span>
          {d
            ? situationText(p)
            : p.skipped === "overtime"
              ? "Overtime (see below)"
              : ""}
        </span>
        <span className="hidden text-sm sm:block">
          <span className="text-gray-500">did </span>
          <span
            className="font-medium"
            style={{ color: OPTION_COLOR[p.actual] }}
          >
            {OPTION_LABEL[p.actual]}
          </span>
          {p.worked != null && (
            <span
              className={cn(
                "ml-1 text-xs",
                p.worked ? "text-emerald-700" : "text-red-700",
              )}
            >
              {p.worked ? "✓" : "✗"}
            </span>
          )}
        </span>
        <span className="flex items-center justify-end gap-1.5 text-sm">
          {verdict === "none" ? (
            <span className="text-gray-400">–</span>
          ) : verdict === "right" ? (
            <>
              <Check className="size-4 text-emerald-600" aria-hidden />
              <span className="text-gray-700">Right call</span>
            </>
          ) : verdict === "close" ? (
            <>
              <Minus className="size-4 text-gray-400" aria-hidden />
              <span className="text-gray-600">Close call</span>
            </>
          ) : (
            <>
              <X className="size-4 text-red-600" aria-hidden />
              <span className="text-gray-700">
                {OPTION_LABEL[d!.best]}{" "}
                <span className="text-red-700 tabular-nums">
                  {p.cost.toFixed(1)}
                </span>
              </span>
            </>
          )}
        </span>
      </button>
      {open && d && (
        <div className="grid gap-4 px-3 pb-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-gray-600 italic">{p.desc}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-gray-500">Model:</span>
              <span
                className="font-semibold"
                style={{ color: OPTION_COLOR[d.best] }}
              >
                {OPTION_LABEL[d.best]}
              </span>
              <StrengthBadge d={d} />
            </div>
            {d.breakeven != null && d.breakeven > 0 && (
              <p className="mt-1 text-gray-600">
                Needed to convert {pct(d.breakeven)}; expected{" "}
                {pct(d.options.find((o) => o.key === "go")?.successProb)}.
              </p>
            )}
            {n4Best && (
              <p className="mt-1 text-gray-600">
                nfl4th:{" "}
                <span className="font-medium">
                  {OPTION_LABEL[n4Best[0]![0]]}
                </span>{" "}
                {n4Best[1] && (
                  <>
                    by {((n4Best[0]![1]! - n4Best[1][1]!) * 100).toFixed(1)} pts
                  </>
                )}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            {d.options.map((o) => (
              <div key={o.key} className="flex items-center gap-2">
                <span className="w-20 text-gray-600">
                  {OPTION_LABEL[o.key]}
                </span>
                <div className="h-2 flex-1 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${o.wp * 100}%`,
                      background: OPTION_COLOR[o.key],
                      opacity: o.key === d.best ? 1 : 0.5,
                    }}
                  />
                </div>
                <span className="w-12 text-right font-medium tabular-nums">
                  {pct(o.wp, 1)}
                </span>
                {nfl4th && (
                  <span
                    className="w-12 text-right text-xs text-gray-400 tabular-nums"
                    title="nfl4th"
                  >
                    {pct(
                      o.key === "go"
                        ? nfl4th.go
                        : o.key === "fg"
                          ? nfl4th.fg
                          : nfl4th.punt,
                      1,
                    )}
                  </span>
                )}
              </div>
            ))}
            {nfl4th && (
              <div className="text-right text-[11px] text-gray-400">
                grey: nfl4th
              </div>
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
  children,
}: {
  gameId: string;
  /** team whose decisions the story is about; its markers are drawn solid */
  focus: string;
  title: string;
  children?: React.ReactNode;
}) {
  const [g, setG] = useState<
    (GameAnalysis & { nfl4th?: Record<string, Nfl4thRow> }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [onlyFocus, setOnlyFocus] = useState(false);

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

  const plays = onlyFocus
    ? g.plays.filter((p) => p.posteam === focus)
    : g.plays;
  const theirs = g.plays.filter((p) => p.posteam === focus && p.decision);
  const misses = theirs.filter((p) => verdictOf(p) === "wrong");
  const close = theirs.filter((p) => verdictOf(p) === "close");
  const lost = theirs.reduce((a, p) => a + p.cost, 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 p-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="text-sm text-gray-500">
            {g.away} {g.awayScore} – {g.home} {g.homeScore}
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-xs text-gray-500">{focus} 4th downs</div>
            <div className="text-xl font-semibold tabular-nums">
              {misses.length}{" "}
              <span className="text-sm font-normal text-gray-500">
                of {theirs.length} wrong
                {close.length ? `, ${close.length} close` : ""}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Win prob. given up</div>
            <div
              className={cn(
                "text-xl font-semibold tabular-nums",
                lost < -0.05 ? "text-red-700" : "text-gray-900",
              )}
            >
              {lost.toFixed(1)}{" "}
              <span className="text-sm font-normal text-gray-500">pts</span>
            </div>
          </div>
        </div>
      </div>
      {children && (
        <div className="border-b border-gray-100 p-4 text-sm leading-relaxed text-gray-700">
          {children}
        </div>
      )}
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>{focus} win probability (nflfastR)</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-emerald-600" /> right
              call
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-gray-400" /> close call
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-red-600" /> wrong call
            </span>
          </span>
        </div>
        <WpTimeline
          g={g}
          focus={focus}
          selected={open}
          onSelect={(id) => setOpen(id)}
        />
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
        <span>
          Every 4th down · click a row for the numbers · red figure = win
          probability lost, in points · close call = within 1 point
        </span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyFocus}
            onChange={(e) => setOnlyFocus(e.target.checked)}
          />{" "}
          {focus} only
        </label>
      </div>
      <div>
        {plays.map((p) => (
          <PlayRow
            key={p.playId}
            p={p}
            nfl4th={g.nfl4th?.[String(p.playId)]}
            open={open === p.playId}
            onToggle={() => setOpen(open === p.playId ? null : p.playId)}
          />
        ))}
      </div>
    </section>
  );
}
