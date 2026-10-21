"use client";

import { cn } from "@/lib/utils";
import type { Decision, Option, OptionKey } from "@/lib/fourth/engine";

export const OPTION_LABEL: Record<OptionKey, string> = {
  go: "Go for it",
  fg: "Field goal",
  punt: "Punt",
};

export const OPTION_COLOR: Record<OptionKey, string> = {
  go: "#2563eb",
  fg: "#d97706",
  punt: "#64748b",
};

const STRENGTH_STYLE: Record<Decision["strength"], string> = {
  "toss-up": "bg-gray-100 text-gray-700",
  lean: "bg-sky-100 text-sky-800",
  strong: "bg-blue-100 text-blue-800",
  "very strong": "bg-indigo-100 text-indigo-800",
  "no-brainer": "bg-violet-100 text-violet-800",
};

export const pct = (v: number | null | undefined, d = 0) =>
  v == null ? "–" : `${(v * 100).toFixed(d)}%`;

export function yardText(yl: number): string {
  if (yl === 50) return "midfield";
  return yl > 50 ? `own ${100 - yl}` : `opp ${yl}`;
}

export function StrengthBadge({ d }: { d: Decision }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        STRENGTH_STYLE[d.strength],
      )}
    >
      {d.strength}
    </span>
  );
}

function headline(d: Decision): { title: string; sub: string } {
  const best = d.options.find((o) => o.key === d.best)!;
  const second = [...d.options]
    .filter((o) => o.key !== d.best)
    .sort((a, b) => b.wp - a.wp)[0];
  const title =
    d.strength === "toss-up"
      ? `Toss-up: ${OPTION_LABEL[d.best].toLowerCase()} by a hair`
      : OPTION_LABEL[d.best];
  const sub = second
    ? `${d.gap.toFixed(1)} percentage points more likely to win than ${OPTION_LABEL[second.key].toLowerCase()} (${pct(best.wp, 1)} vs ${pct(second.wp, 1)})`
    : "";
  return { title, sub };
}

function OptionRow({
  o,
  best,
  maxWp,
}: {
  o: Option;
  best: boolean;
  maxWp: number;
}) {
  const w = maxWp > 0 ? (o.wp / maxWp) * 100 : 0;
  let detail = "";
  if (o.key === "go") {
    detail = `${pct(o.successProb)} to convert · win ${pct(o.wpSuccess)} if they do, ${pct(o.wpFail)} if not`;
  } else if (o.key === "fg") {
    detail = `${o.detail.distance} yd attempt · ${pct(o.successProb)} to make · win ${pct(o.wpSuccess)} if good, ${pct(o.wpFail)} if missed`;
  } else {
    detail = `opponent starts around their own ${Math.round(o.detail.oppStart ?? 0)}`;
  }
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span
          className={cn(
            "font-medium",
            best ? "text-gray-900" : "text-gray-600",
          )}
        >
          {OPTION_LABEL[o.key]}
          {best && (
            <span className="ml-2 text-xs font-semibold text-emerald-700">
              best
            </span>
          )}
        </span>
        <span className="font-semibold text-gray-900 tabular-nums">
          {pct(o.wp, 1)}
        </span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-gray-100">
        <div
          className="h-2.5 rounded-full"
          style={{
            width: `${w}%`,
            background: OPTION_COLOR[o.key],
            opacity: best ? 1 : 0.55,
          }}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500">{detail}</div>
    </div>
  );
}

/** Where the expected conversion rate sits against the rate going needs. */
export function BreakevenBar({ d }: { d: Decision }) {
  const go = d.options.find((o) => o.key === "go")!;
  const p = go.successProb ?? 0;
  const kicks = d.options.filter((o) => o.key !== "go");
  if (!kicks.length) return null;
  const be = d.breakeven;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-800">
        How often do they need to convert?
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {be == null ? (
          "Even a sure conversion wouldn't beat kicking here."
        ) : be <= 0 ? (
          "Going is better even if they never convert."
        ) : (
          <>
            Going for it is the better call if they convert at least{" "}
            <b className="text-gray-900">{pct(be)}</b> of the time. The model
            expects <b className="text-gray-900">{pct(p)}</b>.
          </>
        )}
      </p>
      {be != null && be > 0 && (
        <div className="relative mt-4 mb-6 h-3 rounded-full bg-gradient-to-r from-gray-200 to-gray-100">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-blue-100"
            style={{ width: `${Math.min(100, be * 100)}%` }}
          />
          <div
            className="absolute -top-1 h-5 w-0.5 bg-gray-700"
            style={{ left: `${be * 100}%` }}
          />
          <div
            className="absolute top-5 -translate-x-1/2 text-[11px] whitespace-nowrap text-gray-600"
            style={{ left: `${Math.min(92, Math.max(8, be * 100))}%` }}
          >
            break-even {pct(be)}
          </div>
          <div
            className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${p * 100}%`, background: OPTION_COLOR.go }}
            title={`expected ${pct(p)}`}
          />
        </div>
      )}
    </div>
  );
}

/** Distribution of yards gained if they go, split into converted / failed. */
export function GainsChart({ d }: { d: Decision }) {
  const togo = d.situation.ydstogo;
  const yl = d.situation.yardline;
  const bars = d.goGains
    .map((p, i) => ({ g: i - 10, p }))
    .filter((b) => b.g >= -10 && b.g <= Math.min(40, yl));
  const max = Math.max(...bars.map((b) => b.p));
  const W = 360;
  const H = 90;
  const bw = W / bars.length;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-800">
        If they go: yards gained
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        className="mt-2 w-full"
        role="img"
        aria-label="Yards gained distribution"
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
              fill={b.g >= togo ? OPTION_COLOR.go : "#cbd5e1"}
            >
              <title>{`${b.g} yds: ${(b.p * 100).toFixed(1)}%`}</title>
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
        <text x={0} y={H + 13} fontSize={10} fill="#6b7280">
          -10
        </text>
        <text
          x={10 * bw + bw / 2}
          y={H + 13}
          fontSize={10}
          textAnchor="middle"
          fill="#6b7280"
        >
          0
        </text>
        <text x={W} y={H + 13} fontSize={10} textAnchor="end" fill="#6b7280">
          {Math.min(40, yl)}
          {yl <= 40 ? " (TD)" : "+"}
        </text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: OPTION_COLOR.go }}
          />{" "}
          converts ({togo}+ yds)
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-slate-300" /> falls short
        </span>
      </div>
    </div>
  );
}

export function DecisionCard({ d }: { d: Decision }) {
  const { title, sub } = headline(d);
  const maxWp = Math.max(...d.options.map((o) => o.wp));
  const order: OptionKey[] = ["go", "fg", "punt"];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
        Model says
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h2
          className="text-3xl font-bold"
          style={{ color: OPTION_COLOR[d.best] }}
        >
          {title}
        </h2>
        <StrengthBadge d={d} />
      </div>
      <p className="mt-1 text-sm text-gray-600">{sub}</p>
      <div className="mt-4 divide-y divide-gray-100">
        {order
          .map((k) => d.options.find((o) => o.key === k))
          .filter((o): o is Option => !!o)
          .map((o) => (
            <OptionRow
              key={o.key}
              o={o}
              best={o.key === d.best}
              maxWp={maxWp}
            />
          ))}
      </div>
    </div>
  );
}
