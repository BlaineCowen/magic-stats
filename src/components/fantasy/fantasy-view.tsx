"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Projection } from "@/lib/nfl/fantasy";
import { cn } from "@/lib/utils";
import { RangeBar } from "./range-bar";
import { fmtPct, matchup, signals } from "./signals";

type Tab = "breakouts" | "projections" | "usage";
type Pos = "all" | "QB" | "RB" | "WR" | "TE";

const TABS: { key: Tab; label: string }[] = [
  { key: "breakouts", label: "Breakout watch" },
  { key: "projections", label: "Projections" },
  { key: "usage", label: "Usage trends" },
];
const POSITIONS: Pos[] = ["all", "RB", "WR", "TE", "QB"];

export type BacktestMeta = {
  mae?: number;
  mae_ppr?: number;
  rank_corr?: number;
  rank_corr_xfp?: number;
  breakout_auc?: number;
  breakout_base?: number;
  breakout_top10?: number;
  generated?: string;
};

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";

function PlayerCell({ p }: { p: Projection }) {
  return (
    <Link
      href={`/magic-stats/players/${p.player_id}`}
      className={cn("group flex min-w-0 items-center gap-2.5", focusCls)}
    >
      {p.headshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.headshot}
          alt=""
          loading="lazy"
          className="size-9 shrink-0 rounded-full bg-slate-100 object-cover object-top"
        />
      ) : (
        <span className="size-9 shrink-0 rounded-full bg-slate-100" />
      )}
      <span className="min-w-0">
        <span className="group-hover:text-turf-800 block truncate font-semibold text-slate-900 group-hover:underline">
          {p.name}
        </span>
        <span className="block text-xs text-slate-500">
          {p.position}, {p.team} · {matchup(p)}
        </span>
      </span>
    </Link>
  );
}

function Breakouts({ rows, meta }: { rows: Projection[]; meta: BacktestMeta }) {
  // QB breakouts barely beat a coin flip in backtests (AUC ~0.6), so "All"
  // leaves them out; the QB filter still shows them.
  const allPositions = new Set(rows.map((p) => p.position)).size > 1;
  const list = rows
    .filter((p) => p.breakout_prob != null)
    .filter((p) => !allPositions || p.position !== "QB")
    .sort((a, b) => b.breakout_prob! - a.breakout_prob!)
    .slice(0, 30);
  const max = Math.max(30, ...list.map((p) => p.ceiling));
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Players who aren&apos;t weekly starters yet, ranked by the chance they
        average starter-level PPR over their next four games (15+ for RB and WR,
        11+ for TE, 20+ for QB). In backtests on 2021 to 2025, each week&apos;s
        top 10 hit{" "}
        {meta.breakout_top10 ? fmtPct(meta.breakout_top10) : "about 1 in 4"} of
        the time against a{" "}
        {meta.breakout_base ? fmtPct(meta.breakout_base) : "6%"} base rate. QB
        breakouts are much harder to call, so they only show under the QB
        filter.
      </p>
      {list.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-3">
          {list.map((p, i) => {
            const sig = signals(p);
            return (
              <li
                key={p.player_id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[2.5rem_minmax(0,14rem)_6rem_minmax(0,1fr)] sm:items-start"
              >
                <span className="font-display text-2xl font-bold text-slate-300 tabular-nums">
                  {i + 1}
                </span>
                <PlayerCell p={p} />
                <div>
                  <div className="font-display text-turf-800 text-3xl leading-none font-bold tabular-nums">
                    {fmtPct(p.breakout_prob)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    breakout chance
                  </div>
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-slate-600 tabular-nums">
                      Next: {p.proj.toFixed(1)}{" "}
                      <span className="text-slate-400">
                        ({p.floor.toFixed(0)}–{p.ceiling.toFixed(0)})
                      </span>
                    </span>
                    <RangeBar
                      floor={p.floor}
                      proj={p.proj}
                      ceiling={p.ceiling}
                      max={max}
                      color={p.team_color ?? undefined}
                    />
                  </div>
                  {sig.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {sig.map((s) => (
                        <li
                          key={s.text}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            s.good
                              ? "bg-turf-50 text-turf-900"
                              : "bg-amber-50 text-amber-900",
                          )}
                        >
                          {s.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

type SortKey = "proj" | "ceiling" | "floor";

function Projections({ rows }: { rows: Projection[] }) {
  const [sort, setSort] = useState<SortKey>("proj");
  const list = [...rows].sort((a, b) => b[sort] - a[sort]).slice(0, 150);
  const max = Math.max(30, ...list.map((p) => p.ceiling));
  const th =
    "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-600";
  const sortBtn = (k: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      aria-pressed={sort === k}
      className={cn(
        "font-medium underline-offset-2 hover:underline",
        sort === k ? "text-slate-900 underline" : "text-slate-600",
        focusCls,
      )}
    >
      {label}
    </button>
  );
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        PPR points for each player&apos;s next game. Floor and ceiling are the
        10th and 90th percentile outcomes: one game in ten should land below the
        floor and one in ten above the ceiling. Sort by ceiling to find upside
        plays.
      </p>
      {list.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className={th}>Player</th>
                <th className={cn(th, "text-right")}>
                  {sortBtn("proj", "Proj")}
                </th>
                <th className={cn(th, "text-right")}>
                  {sortBtn("floor", "Floor")}
                </th>
                <th className={cn(th, "text-right")}>
                  {sortBtn("ceiling", "Ceiling")}
                </th>
                <th className={cn(th, "w-1/3")}>Range</th>
                <th className={cn(th, "text-right")}>Team total</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-slate-100">
              {list.map((p) => (
                <tr key={p.player_id}>
                  <td className="px-3 py-2">
                    <PlayerCell p={p} />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {p.proj.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                    {p.floor.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                    {p.ceiling.toFixed(1)}
                  </td>
                  <td className="px-3 py-2">
                    <RangeBar
                      floor={p.floor}
                      proj={p.proj}
                      ceiling={p.ceiling}
                      max={max}
                      color={p.team_color ?? undefined}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                    {p.implied_total?.toFixed(1) ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Usage({ rows }: { rows: Projection[] }) {
  const withTrend = rows.filter(
    (p) => p.xfp_l3 != null && p.xfp_pg != null && p.games >= 4,
  );
  const delta = (p: Projection) => p.xfp_l3! - p.xfp_pg!;
  const risers = [...withTrend]
    .sort((a, b) => delta(b) - delta(a))
    .slice(0, 15);
  const fallers = [...withTrend]
    .sort((a, b) => delta(a) - delta(b))
    .slice(0, 15);
  const change = (now: number | null, then: number | null) =>
    now == null || then == null
      ? "–"
      : `${fmtPct(now)} (${now - then >= 0 ? "+" : ""}${Math.round((now - then) * 100)})`;
  const table = (title: string, list: Projection[]) => (
    <section>
      <h3 className="font-display mb-2 text-xl font-semibold text-slate-900">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 text-right font-medium">
                Expected pts, last 3
              </th>
              <th className="px-3 py-2 text-right font-medium">
                Snaps, last 3
              </th>
              <th className="px-3 py-2 text-right font-medium">
                Target share (carries for RBs), last 3
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const rb = p.position === "RB";
              return (
                <tr
                  key={p.player_id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-3 py-2">
                    <PlayerCell p={p} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="font-semibold">
                      {p.xfp_l3!.toFixed(1)}
                    </span>{" "}
                    <span
                      className={cn(
                        "text-xs",
                        delta(p) >= 0 ? "text-turf-800" : "text-red-700",
                      )}
                    >
                      {delta(p) >= 0 ? "+" : ""}
                      {delta(p).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                    {change(p.snap_l3, p.snap_pct)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">
                    {rb
                      ? change(p.car_share_l3, p.car_share)
                      : change(p.tgt_share_l3, p.tgt_share)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Change in expected PPR points per game over each player&apos;s last 3
        games compared with his season average, with snap share and target or
        carry share for the same games (change in points in brackets). Expected
        points measure usage, so these move before the box scores do.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {table("Rising", risers)}
        {table("Fading", fallers)}
      </div>
    </>
  );
}

function Empty() {
  return (
    <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
      No projections yet. They update every morning during the season.
    </p>
  );
}

export function FantasyView({
  projections,
  meta,
}: {
  projections: Projection[];
  meta: BacktestMeta;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    TABS.find((t) => t.key === params.get("tab"))?.key ?? "breakouts",
  );
  const [pos, setPos] = useState<Pos>(
    POSITIONS.find((p) => p === params.get("pos")) ?? "all",
  );
  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== "breakouts") q.set("tab", tab);
    if (pos !== "all") q.set("pos", pos);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [tab, pos, pathname, router]);

  const rows = useMemo(
    () =>
      pos === "all"
        ? projections
        : projections.filter((p) => p.position === pos),
    [projections, pos],
  );
  const weeks = [...new Set(projections.map((p) => p.week))].sort(
    (a, b) => a - b,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="View"
          className="inline-flex rounded-lg border border-slate-300 bg-white p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "font-display rounded-md px-4 py-1.5 text-lg font-semibold whitespace-nowrap transition-colors",
                focusCls,
                tab === t.key
                  ? "bg-turf-950 text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Position"
          className="flex overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pos === p}
              onClick={() => setPos(p)}
              className={cn(
                "font-display border-l border-slate-300 px-3 py-1 text-base font-semibold first:border-l-0 focus-visible:-outline-offset-2",
                focusCls,
                pos === p
                  ? "bg-turf-950 text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
      </div>
      {weeks.length > 0 && (
        <p className="mb-3 text-sm font-medium text-slate-500">
          Week {weeks.join(" and ")}
          {meta.generated &&
            ` · updated ${new Date(meta.generated).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </p>
      )}
      {tab === "breakouts" && <Breakouts rows={rows} meta={meta} />}
      {tab === "projections" && <Projections rows={rows} />}
      {tab === "usage" && <Usage rows={rows} />}
    </div>
  );
}
