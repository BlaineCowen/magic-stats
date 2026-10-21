"use client";

import type { Decision } from "@/lib/fourth/engine";
import {
  chance,
  CHOICE,
  CHOICE_COLOR,
  ChanceBars,
  Expand,
  outOf10,
  StrengthTag,
  verdictLine,
} from "./ui";

// older names, still used across the 4th down components
export const OPTION_LABEL = CHOICE;
export const OPTION_COLOR = CHOICE_COLOR;

export const pct = (v: number | null | undefined, d = 0) =>
  v == null ? "–" : `${(v * 100).toFixed(d)}%`;

/** "their own 25" / "the opponent's 30" reads easier than "own 25" / "opp 30". */
export function yardText(yl: number, team?: string, opp?: string): string {
  if (yl === 50) return "midfield";
  if (yl > 50)
    return team ? `the ${team} ${100 - yl}` : `their own ${100 - yl}`;
  return opp ? `the ${opp} ${yl}` : `the opponent's ${yl}`;
}

export function StrengthBadge({ d }: { d: Decision }) {
  return <StrengthTag strength={d.strength} />;
}

/** Plain-language reasons behind the verdict, shown under "Why?". */
export function WhyDetails({ d }: { d: Decision }) {
  const go = d.options.find((o) => o.key === "go")!;
  const fg = d.options.find((o) => o.key === "fg");
  const punt = d.options.find((o) => o.key === "punt");
  const p = go.successProb ?? 0;
  const be = d.breakeven;
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <ul className="space-y-2">
        <li>
          Teams in this spot pick up the first down about <b>{outOf10(p)}</b>{" "}
          times. If they make it, their chance to win is {chance(go.wpSuccess)};
          if they don&apos;t, {chance(go.wpFail)}.
        </li>
        {fg && (
          <li>
            The field goal would be from {fg.detail.distance} yards, good about{" "}
            <b>{outOf10(fg.successProb ?? 0)}</b> times. Chance to win:{" "}
            {chance(fg.wpSuccess)} if it&apos;s good, {chance(fg.wpFail)} if it
            misses.
          </li>
        )}
        {punt && (
          <li>
            A punt would give the other team the ball around their own{" "}
            {Math.round(punt.detail.oppStart ?? 0)}.
          </li>
        )}
        {be != null && be > 0 && be < 1 && (
          <li>
            Going for it is worth it as long as they make it at least{" "}
            <b>{outOf10(be)}</b> times ({chance(be)}). The usual rate here is{" "}
            {chance(p)}.
          </li>
        )}
      </ul>
      <GainsChart d={d} />
    </div>
  );
}

/** Where the expected conversion rate sits against the rate going needs. */
export function BreakevenBar({ d }: { d: Decision }) {
  const go = d.options.find((o) => o.key === "go")!;
  const p = go.successProb ?? 0;
  const be = d.breakeven;
  if (be == null || be <= 0 || be >= 1) return null;
  return (
    <div>
      <div className="text-xs font-medium text-gray-600">
        How often they need to convert, and how often they do
      </div>
      <div className="relative mt-3 mb-6 h-3 rounded-full bg-gray-100">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-blue-100"
          style={{ width: `${be * 100}%` }}
        />
        <div
          className="absolute -top-1 h-5 w-0.5 bg-gray-700"
          style={{ left: `${be * 100}%` }}
        />
        <div
          className="absolute top-5 -translate-x-1/2 text-[11px] whitespace-nowrap text-gray-600"
          style={{ left: `${Math.min(88, Math.max(12, be * 100))}%` }}
        >
          needed {chance(be)}
        </div>
        <div
          className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${p * 100}%`, background: CHOICE_COLOR.go }}
          title={`usual rate ${chance(p)}`}
        />
      </div>
    </div>
  );
}

/** Distribution of yards gained if they go, split into converted / failed. */
export function GainsChart({ d }: { d: Decision }) {
  const togo = d.situation.ydstogo;
  const yl = d.situation.yardline;
  const bars = d.goGains
    .map((p, i) => ({ g: i - 10, p }))
    .filter((b) => b.g <= Math.min(40, yl));
  const max = Math.max(...bars.map((b) => b.p));
  const W = 360;
  const H = 80;
  const bw = W / bars.length;
  return (
    <div>
      <div className="text-xs font-medium text-gray-600">
        If they go for it: how many yards the play gains
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 16}`}
        className="mt-2 w-full"
        role="img"
        aria-label="Yards gained if they go for it"
      >
        {bars.map((b, i) => {
          const h = (b.p / max) * H;
          return (
            <rect
              key={b.g}
              x={i * bw + 0.5}
              y={H - h}
              width={Math.max(1, bw - 1)}
              height={h}
              rx={1}
              fill={b.g >= togo ? CHOICE_COLOR.go : "#cbd5e1"}
            >
              <title>{`${b.g} yards: ${(b.p * 100).toFixed(1)}%`}</title>
            </rect>
          );
        })}
        <line
          x1={(togo + 10) * bw}
          x2={(togo + 10) * bw}
          y1={0}
          y2={H}
          stroke="#374151"
          strokeDasharray="2 2"
        />
        <text x={0} y={H + 12} fontSize={10} fill="#6b7280">
          loss of 10
        </text>
        <text
          x={10 * bw + bw / 2}
          y={H + 12}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          0
        </text>
        <text x={W} y={H + 12} fontSize={10} textAnchor="end" fill="#6b7280">
          {Math.min(40, yl)}
          {yl <= 40 ? " (touchdown)" : "+"}
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: CHOICE_COLOR.go }}
          />{" "}
          first down
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-slate-300" /> comes up short
        </span>
      </div>
    </div>
  );
}

export function DecisionCard({ d }: { d: Decision }) {
  const rows = d.options.map((o) => ({ key: o.key, wp: o.wp }));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2
          className="text-3xl font-bold"
          style={{ color: CHOICE_COLOR[d.best] }}
        >
          {CHOICE[d.best]}
        </h2>
        <StrengthTag strength={d.strength} />
      </div>
      <p className="mt-1 text-gray-700">{verdictLine(rows, d.best)}</p>
      <div className="mt-5">
        <ChanceBars options={rows} best={d.best} />
      </div>
      <Expand label="Why?" className="mt-4 border-t border-gray-100 pt-3">
        <div className="space-y-4">
          <WhyDetails d={d} />
          <BreakevenBar d={d} />
        </div>
      </Expand>
    </div>
  );
}
