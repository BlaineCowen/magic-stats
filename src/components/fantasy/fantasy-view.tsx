"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Projection } from "@/lib/nfl/fantasy";
import { cn } from "@/lib/utils";
import { RangeBar } from "./range-bar";
import {
  FilterSelect,
  SortableTable,
  type Column,
} from "@/components/sortable-table";
import { fmtPct, matchup, signals } from "./signals";

type Tab = "breakouts" | "projections" | "ros" | "usage";
type Pos = "all" | "QB" | "RB" | "WR" | "TE";

const TABS: { key: Tab; label: string }[] = [
  { key: "breakouts", label: "Breakout watch" },
  { key: "projections", label: "This week" },
  { key: "ros", label: "Rest of season" },
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
  ros_mae?: number;
  ros_mae_base?: number;
  generated?: string;
};

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";

function PlayerCell({ p, compact }: { p: Projection; compact?: boolean }) {
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
          className={cn(
            "size-8 shrink-0 rounded-full bg-slate-100 object-cover object-top sm:size-9",
            compact && "max-sm:hidden",
          )}
        />
      ) : (
        <span
          className={cn(
            "size-8 shrink-0 rounded-full bg-slate-100 sm:size-9",
            compact && "max-sm:hidden",
          )}
        />
      )}
      <span className="min-w-0">
        <span
          className={cn(
            "group-hover:text-turf-800 block truncate font-semibold text-slate-900 group-hover:underline",
            // On phones the name wraps rather than losing its last letters.
            compact && "max-sm:leading-tight max-sm:whitespace-normal",
          )}
        >
          {p.name}
        </span>
        <span className="block text-xs text-slate-500">
          <span className="whitespace-nowrap">
            {p.position}, {p.team} · {matchup(p)}
          </span>
          {p.injury_status && p.injury_status !== "Active" && (
            <span
              className={cn(
                "ml-1.5 font-semibold",
                p.injury_status === "Questionable"
                  ? "text-amber-700"
                  : "text-red-700",
              )}
              title={p.injury_note ?? undefined}
            >
              {p.injury_status === "Injured Reserve" ? "IR" : p.injury_status}
            </span>
          )}
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
    .filter((p) => p.breakout_prob != null && !p.out_next)
    .filter((p) => !allPositions || p.position !== "QB")
    .sort((a, b) => b.breakout_prob! - a.breakout_prob!)
    .slice(0, 30);
  const max = Math.max(30, ...list.map((p) => p.ceiling));
  return (
    <>
      <Note>
        Players who aren&apos;t weekly starters yet, ranked by the chance they
        average starter-level PPR over their next four games (15+ for RB and WR,
        11+ for TE, 20+ for QB). In backtests on 2021 to 2025, each week&apos;s
        top 10 hit{" "}
        {meta.breakout_top10 ? fmtPct(meta.breakout_top10) : "about 1 in 4"} of
        the time against a{" "}
        {meta.breakout_base ? fmtPct(meta.breakout_base) : "6%"} base rate. QB
        breakouts are much harder to call, so they only show under the QB
        filter.
      </Note>
      {list.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-3">
          {list.map((p, i) => {
            const sig = signals(p);
            return (
              <li
                key={p.player_id}
                className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-3 gap-y-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[2.5rem_minmax(0,14rem)_6rem_minmax(0,1fr)] sm:items-start sm:p-4"
              >
                <span className="font-display self-center text-xl font-bold text-slate-300 tabular-nums sm:self-auto sm:text-2xl">
                  {i + 1}
                </span>
                <PlayerCell p={p} />
                <div className="text-right sm:text-left">
                  <div className="font-display text-turf-800 text-2xl leading-none font-bold tabular-nums sm:text-3xl">
                    {fmtPct(p.breakout_prob)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    <span className="sm:hidden">breakout</span>
                    <span className="hidden sm:inline">breakout chance</span>
                  </div>
                </div>
                <div className="col-span-3 min-w-0 space-y-2 sm:col-span-1">
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

const nameCol: Column<Projection> = {
  key: "name",
  label: "Player",
  align: "left",
  value: (p) => p.name,
  ascFirst: true,
  render: (p) => <PlayerCell p={p} compact />,
  className: "max-sm:min-w-32 max-sm:max-w-36",
};
const playerSearch = {
  text: (p: Projection) => `${p.name} ${p.team} ${p.opp}`,
  placeholder: "Search players or teams",
};
const n1 = (v: number | null) => (v == null ? "–" : v.toFixed(1));
const signed1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

function Projections({
  rows,
  filters,
}: {
  rows: Projection[];
  filters: React.ReactNode;
}) {
  const list = rows.filter((p) => !p.out_next);
  const max = Math.max(30, ...list.map((p) => p.ceiling));
  const columns: Column<Projection>[] = [
    nameCol,
    {
      key: "proj",
      label: "Proj",
      value: (p) => p.proj,
      render: (p) => <span className="font-semibold">{p.proj.toFixed(1)}</span>,
    },
    {
      key: "floor",
      label: "Floor",
      value: (p) => p.floor,
      render: (p) => n1(p.floor),
    },
    {
      key: "ceiling",
      label: "Ceiling",
      value: (p) => p.ceiling,
      render: (p) => n1(p.ceiling),
    },
    {
      key: "range",
      label: "Range",
      align: "left",
      className: "w-1/4 min-w-32",
      render: (p) => (
        <RangeBar
          floor={p.floor}
          proj={p.proj}
          ceiling={p.ceiling}
          max={max}
          color={p.team_color ?? undefined}
        />
      ),
    },
    {
      key: "xfp_l3",
      label: "Exp pts, last 3",
      value: (p) => p.xfp_l3,
      render: (p) => n1(p.xfp_l3),
    },
    {
      key: "implied",
      label: "Team total",
      value: (p) => p.implied_total,
      render: (p) => n1(p.implied_total),
    },
    {
      key: "opp",
      label: "Opp allows",
      value: (p) => p.opp_pos_allowed,
      render: (p) => n1(p.opp_pos_allowed),
    },
  ];
  return (
    <>
      <Note>
        PPR points for each player&apos;s next game. Floor and ceiling are the
        10th and 90th percentile outcomes: one game in ten should land below the
        floor and one in ten above the ceiling. &ldquo;Opp allows&rdquo; is the
        PPR the opponent gives up to the position per game. Click a column to
        sort.
      </Note>
      <SortableTable
        rows={list}
        columns={columns}
        rowKey={(p) => p.player_id}
        defaultSort={{ key: "proj", desc: true }}
        search={playerSearch}
        filters={filters}
        label="This week's projections"
        empty="No players match. Try another team or position."
        minWidth={820}
      />
    </>
  );
}

function RestOfSeason({
  rows,
  meta,
  filters,
}: {
  rows: Projection[];
  meta: BacktestMeta;
  filters: React.ReactNode;
}) {
  // Deep backups (under 3 a game) only clutter a season-long view.
  const list = rows.filter((p) => p.ros_proj != null && (p.ros_ppg ?? 0) >= 3);
  const weeks = [...new Set(list.flatMap((p) => p.upcoming.map(([w]) => w)))]
    .sort((a, b) => a - b)
    .slice(0, 5);
  const columns: Column<Projection>[] = [
    nameCol,
    {
      key: "ros",
      label: "ROS pts",
      value: (p) => p.ros_proj,
      render: (p) => <span className="font-semibold">{n1(p.ros_proj)}</span>,
    },
    {
      key: "ppg",
      label: "Per game",
      value: (p) => p.ros_ppg,
      render: (p) => n1(p.ros_ppg),
    },
    {
      key: "games",
      label: "Games",
      value: (p) => p.ros_games,
      render: (p) => p.ros_games ?? "–",
    },
    {
      key: "sos",
      label: "Schedule",
      value: (p) => p.ros_sos,
      render: (p) =>
        p.ros_sos == null ? (
          "–"
        ) : (
          <span
            className={cn(
              p.ros_sos >= 1
                ? "text-turf-800"
                : p.ros_sos <= -1
                  ? "text-red-700"
                  : "text-slate-600",
            )}
            title="Remaining opponents' PPR allowed to the position vs the league average"
          >
            {p.ros_sos >= 1 ? "Easy" : p.ros_sos <= -1 ? "Hard" : "Avg"} (
            {signed1(p.ros_sos)})
          </span>
        ),
    },
    ...weeks.map(
      (w): Column<Projection> => ({
        key: `w${w}`,
        label: `Wk ${w}`,
        value: (p) => {
          const g = p.upcoming.find(([x]) => x === w);
          return g && !g[3] ? g[2] : null;
        },
        render: (p) => {
          const g = p.upcoming.find(([x]) => x === w);
          return g?.[3] ? (
            <span className="text-xs font-semibold text-red-700">
              Out
              <span className="block text-[11px] font-normal text-slate-400">
                {g[1]}
              </span>
            </span>
          ) : g ? (
            <span>
              {g[2].toFixed(1)}
              <span className="block text-[11px] text-slate-400">{g[1]}</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              {p.out_next && w === p.week ? "Out" : "Bye"}
            </span>
          );
        },
      }),
    ),
  ];
  return (
    <>
      <Note>
        Projected PPR for every remaining regular-season game, added up. Each
        game uses the player&apos;s numbers as of now with that game&apos;s
        opponent, venue and rest; betting lines and weather only count once
        they&apos;re out (about two weeks ahead). It assumes he plays every
        game, so injuries will cut into these.
        {meta.ros_mae != null &&
          ` Backtested from weeks 4, 8 and 12 of 2021 to 2025, the per-game miss is ${meta.ros_mae.toFixed(2)} points against ${meta.ros_mae_base?.toFixed(2)} for season-to-date averages.`}
      </Note>
      <SortableTable
        rows={list}
        columns={columns}
        rowKey={(p) => p.player_id}
        defaultSort={{ key: "ros", desc: true }}
        search={playerSearch}
        filters={filters}
        label="Rest of season projections"
        empty="No players match. Try another team or position."
        minWidth={900}
      />
    </>
  );
}

function Usage({
  rows,
  filters,
}: {
  rows: Projection[];
  filters: React.ReactNode;
}) {
  const list = rows.filter(
    (p) => p.xfp_l3 != null && p.xfp_pg != null && p.games >= 4,
  );
  const delta = (p: Projection) => p.xfp_l3! - p.xfp_pg!;
  const share = (p: Projection) =>
    p.position === "RB"
      ? [p.car_share_l3, p.car_share]
      : [p.tgt_share_l3, p.tgt_share];
  const diffPct = (
    now: number | null | undefined,
    then: number | null | undefined,
  ) => (now == null || then == null ? null : now - then);
  const pctCell = (
    now: number | null | undefined,
    then: number | null | undefined,
  ) => {
    const d = diffPct(now, then);
    return now == null ? (
      "–"
    ) : (
      <span>
        {fmtPct(now)}{" "}
        {d != null && (
          <span
            className={cn("text-xs", d >= 0 ? "text-turf-800" : "text-red-700")}
          >
            {d >= 0 ? "+" : ""}
            {Math.round(d * 100)}
          </span>
        )}
      </span>
    );
  };
  const columns: Column<Projection>[] = [
    nameCol,
    {
      key: "delta",
      label: "Exp pts change",
      value: delta,
      render: (p) => (
        <span
          className={cn(
            "font-semibold",
            delta(p) >= 0 ? "text-turf-800" : "text-red-700",
          )}
        >
          {signed1(delta(p))}
        </span>
      ),
    },
    {
      key: "l3",
      label: "Exp pts, last 3",
      value: (p) => p.xfp_l3,
      render: (p) => n1(p.xfp_l3),
    },
    {
      key: "season",
      label: "Season",
      value: (p) => p.xfp_pg,
      render: (p) => n1(p.xfp_pg),
    },
    {
      key: "snaps",
      label: "Snaps, last 3",
      value: (p) => diffPct(p.snap_l3, p.snap_pct),
      render: (p) => pctCell(p.snap_l3, p.snap_pct),
    },
    {
      key: "share",
      label: "Target share (RB: carries)",
      value: (p) => diffPct(...(share(p) as [number | null, number | null])),
      render: (p) => pctCell(...(share(p) as [number | null, number | null])),
    },
    {
      key: "yprr",
      label: "Yds per route",
      value: (p) => p.yprr,
      render: (p) =>
        p.yprr == null ? (
          "–"
        ) : (
          <span
            title={
              p.yprr_prev != null
                ? `${p.yprr_prev.toFixed(2)} last season`
                : undefined
            }
          >
            {p.yprr.toFixed(2)}
          </span>
        ),
    },
    {
      key: "tprr",
      label: "Tgts per route",
      value: (p) => p.tprr,
      render: (p) => (p.tprr == null ? "–" : p.tprr.toFixed(2)),
    },
    {
      key: "luck",
      label: "Pts vs expected",
      value: (p) => p.luck_pg,
      render: (p) => (p.luck_pg == null ? "–" : signed1(p.luck_pg)),
    },
  ];
  return (
    <>
      <Note>
        Expected PPR points per game over each player&apos;s last 3 games
        compared with his season, with snap and target or carry share for the
        same games (change in percentage points). Expected points measure usage,
        so they move before the box scores do. Sort the change column either way
        for risers or fallers. Yards and targets per route run cover the season
        so far; routes are estimated from snaps and the team&apos;s pass plays
        until the real counts come out after the season.
      </Note>
      <SortableTable
        rows={list}
        columns={columns}
        rowKey={(p) => p.player_id}
        defaultSort={{ key: "delta", desc: true }}
        search={playerSearch}
        filters={filters}
        label="Usage trends"
        empty="No players match. Try another team or position."
        minWidth={980}
      />
    </>
  );
}

/** Explanation above a list: two lines on phones with a toggle, full on wider screens. */
function Note({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 max-w-3xl text-sm text-slate-600">
      <p className={cn(!open && "line-clamp-2 sm:line-clamp-none")}>
        {children}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "text-turf-800 mt-0.5 text-sm font-medium sm:hidden",
          focusCls,
        )}
      >
        {open ? "Less" : "How this works"}
      </button>
    </div>
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
  const teams = useMemo(
    () => [...new Set(projections.map((p) => p.team))].sort(),
    [projections],
  );
  const [team, setTeam] = useState(params.get("team") ?? "");
  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== "breakouts") q.set("tab", tab);
    if (pos !== "all") q.set("pos", pos);
    if (team) q.set("team", team);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [tab, pos, team, pathname, router]);

  const rows = useMemo(
    () =>
      projections.filter(
        (p) =>
          (pos === "all" || p.position === pos) && (!team || p.team === team),
      ),
    [projections, pos, team],
  );
  const teamFilter = (
    <FilterSelect
      label="Team"
      value={team}
      onChange={setTeam}
      options={[
        { value: "", label: "All teams" },
        ...teams.map((t) => ({ value: t, label: t })),
      ]}
    />
  );
  const weeks = [...new Set(projections.map((p) => p.week))].sort(
    (a, b) => a - b,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="nfl-scroll-fade -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
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
                  "font-display rounded-md px-3 py-1.5 text-base font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-lg",
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
      {tab !== "breakouts" && projections.length === 0 && <Empty />}
      {tab === "projections" && projections.length > 0 && (
        <Projections rows={rows} filters={teamFilter} />
      )}
      {tab === "ros" && projections.length > 0 && (
        <RestOfSeason rows={rows} meta={meta} filters={teamFilter} />
      )}
      {tab === "usage" && projections.length > 0 && (
        <Usage rows={rows} filters={teamFilter} />
      )}
    </div>
  );
}
