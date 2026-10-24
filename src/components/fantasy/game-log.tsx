"use client";

import type { PlayerWeek } from "@/lib/nfl/fantasy";
import { cn } from "@/lib/utils";
import { SortableTable, type Column } from "@/components/sortable-table";
import { fmtPct } from "./signals";

type Count =
  | "pass_yards"
  | "carries"
  | "rush_yards"
  | "targets"
  | "receptions"
  | "rec_yards"
  | "tds";

const stat = (key: Count, label: string): Column<PlayerWeek> => ({
  key,
  label,
  value: (g) => g[key],
  render: (g) => g[key],
});

/** Week-by-week box score for one player, sortable by any column. */
export function GameLog({
  weeks,
  showPassing,
}: {
  weeks: PlayerWeek[];
  showPassing: boolean;
}) {
  const columns: Column<PlayerWeek>[] = [
    {
      key: "week",
      label: "Week",
      align: "left",
      ascFirst: true,
      value: (g) => g.week,
      render: (g) => (
        <span className="whitespace-nowrap">
          <span className="inline-block w-5 text-slate-900">{g.week}</span>
          <span className="text-slate-500">{g.opponent}</span>
        </span>
      ),
    },
    {
      key: "ppr",
      label: "PPR",
      value: (g) => g.ppr,
      render: (g) => <span className="font-semibold">{g.ppr.toFixed(1)}</span>,
    },
    {
      key: "xfp",
      label: "Expected",
      value: (g) => g.xfp,
      render: (g) => (
        <span
          className={cn(
            g.xfp != null &&
              (g.ppr - g.xfp >= 3
                ? "text-turf-800"
                : g.ppr - g.xfp <= -3
                  ? "text-red-700"
                  : ""),
          )}
        >
          {g.xfp?.toFixed(1) ?? "–"}
        </span>
      ),
    },
    {
      key: "snaps",
      label: "Snaps",
      value: (g) => g.snap_pct,
      render: (g) => fmtPct(g.snap_pct),
    },
    ...(showPassing ? [stat("pass_yards", "Pass yds")] : []),
    stat("carries", "Car"),
    stat("rush_yards", "Rush yds"),
    stat("targets", "Tgt"),
    stat("receptions", "Rec"),
    stat("rec_yards", "Rec yds"),
    stat("tds", "TD"),
  ];
  return (
    <SortableTable
      rows={weeks}
      columns={columns}
      rowKey={(g) => String(g.week)}
      defaultSort={{ key: "week", desc: false }}
      minWidth={showPassing ? 640 : 580}
      label="Game log"
    />
  );
}
