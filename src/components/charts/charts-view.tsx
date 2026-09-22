"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { NflNav } from "@/components/nfl-nav";
import { cn } from "@/lib/utils";
import {
  ALL_DOWNS,
  ALL_QTRS,
  type ChartData,
  type ChartFilters,
  type ChartKind,
  type PlayType,
  type Playoffs,
} from "@/lib/nfl/chart-types";
import { downloadSvgAsPng, pct, signed } from "./chart-kit";
import { QbChart } from "./qb-chart";
import { TeamTiersChart } from "./team-tiers-chart";

const TABS: { kind: ChartKind; label: string }[] = [
  { kind: "teams", label: "Team Tiers" },
  { kind: "qbs", label: "Quarterbacks" },
];

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const WP_STEPS = Array.from({ length: 21 }, (_, i) => i * 5);

function toQuery(f: ChartFilters): string {
  const p = new URLSearchParams({
    seasonFrom: String(f.seasonFrom),
    seasonTo: String(f.seasonTo),
    weekFrom: String(f.weekFrom),
    weekTo: String(f.weekTo),
    playoffs: f.playoffs,
    wpMin: String(f.wpMin),
    wpMax: String(f.wpMax),
    downs: f.downs.join(","),
    qtrs: f.qtrs.join(","),
    plays: f.plays,
  });
  if (f.minPlays) p.set("minPlays", String(f.minPlays));
  return p.toString();
}

const selectCls =
  "rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chips({
  values,
  selected,
  label = String,
  onChange,
}: {
  values: number[];
  selected: number[];
  label?: (v: number) => string;
  onChange: (next: number[]) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-gray-300">
      {values.map((v) => {
        const on = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on
                ? selected.filter((s) => s !== v)
                : [...selected, v];
              // Keep at least one selected; an empty filter would match nothing.
              if (next.length) onChange(next.sort((a, b) => a - b));
            }}
            className={cn(
              "min-w-8 border-l border-gray-300 px-2 py-1 text-sm first:border-l-0",
              on
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            {label(v)}
          </button>
        );
      })}
    </div>
  );
}

/** Commits on blur or Enter so typing doesn't refetch on every keystroke. */
function MinPlaysInput({
  value,
  auto,
  onCommit,
}: {
  value: number | null;
  auto: number | null;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  useEffect(() => setDraft(value ? String(value) : ""), [value]);
  const commit = () => {
    const n = parseInt(draft, 10);
    onCommit(Number.isFinite(n) && n > 0 ? n : null);
  };
  return (
    <input
      type="number"
      min={1}
      inputMode="numeric"
      value={draft}
      placeholder={auto ? `auto (${auto})` : "auto"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className={cn(selectCls, "w-28")}
    />
  );
}

function DataTable({ data }: { data: ChartData }) {
  const head = "px-2 py-1.5 text-left font-medium text-gray-500";
  const cell = "px-2 py-1 tabular-nums";
  if (data.teams) {
    return (
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200">
          <tr>
            {[
              "#",
              "Team",
              "Off EPA/play",
              "Def EPA/play",
              "Net",
              "Off SR",
              "Def SR",
              "Games",
            ].map((h) => (
              <th key={h} className={head}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.teams.map((t, i) => (
            <tr key={t.team} className="border-b border-gray-100">
              <td className={cell}>{i + 1}</td>
              <td className={cn(cell, "font-medium")}>
                {t.team_name ?? t.team}
              </td>
              <td className={cell}>{signed(t.off_epa)}</td>
              <td className={cell}>{signed(t.def_epa)}</td>
              <td className={cell}>{signed(t.off_epa - t.def_epa)}</td>
              <td className={cell}>{pct(t.off_success)}</td>
              <td className={cell}>{pct(t.def_success)}</td>
              <td className={cell}>{t.games}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-gray-200">
        <tr>
          {[
            "#",
            "Quarterback",
            "Team",
            "EPA/play",
            "CPOE",
            "Success",
            "Plays",
          ].map((h) => (
            <th key={h} className={head}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(data.qbs ?? []).map((q, i) => (
          <tr key={q.id} className="border-b border-gray-100">
            <td className={cell}>{i + 1}</td>
            <td className={cn(cell, "font-medium")}>{q.full_name ?? q.name}</td>
            <td className={cell}>{q.team}</td>
            <td className={cell}>{signed(q.epa)}</td>
            <td
              className={cell}
            >{`${q.cpoe > 0 ? "+" : ""}${q.cpoe.toFixed(1)}`}</td>
            <td className={cell}>{pct(q.success)}</td>
            <td className={cell}>{q.plays}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);

  const [chart, setChart] = useState<ChartKind>(
    searchParams.get("chart") === "qbs" ? "qbs" : "teams",
  );
  // Whatever the URL asked for; the server fills in defaults it leaves out.
  const [query, setQuery] = useState(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("chart");
    return p.toString();
  });
  const [filters, setFilters] = useState<ChartFilters | null>(null);
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set("chart", chart);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/charts?${params.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = (await res.json()) as ChartData & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load chart");
        setData(body);
        setFilters(body.filters);
        setError("");
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load chart");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [chart, query, pathname, router]);

  const update = (patch: Partial<ChartFilters>) => {
    if (!filters) return;
    const next = { ...filters, ...patch };
    setFilters(next);
    setQuery(toQuery(next));
  };

  const download = async () => {
    if (!svgRef.current || !data) return;
    setExporting(true);
    try {
      const f = data.filters;
      const seasons =
        f.seasonFrom === f.seasonTo
          ? `${f.seasonFrom}`
          : `${f.seasonFrom}-${f.seasonTo}`;
      await downloadSvgAsPng(
        svgRef.current,
        `${chart === "teams" ? "team-tiers" : "quarterbacks"}-${seasons}.png`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const seasons: number[] = [];
  if (data) {
    for (let s = data.seasons.max; s >= data.seasons.min; s--) seasons.push(s);
  }
  // Only show a chart that matches the selected tab (not the previous one).
  const shown = data?.chart === chart ? data : null;
  const empty = shown && (shown.teams ?? shown.qbs ?? []).length === 0;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <NflNav />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.kind}
                type="button"
                onClick={() => setChart(t.kind)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium",
                  chart === t.kind
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void download()}
            disabled={!shown || exporting || loading}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-400"
          >
            {exporting ? "Exporting…" : "Download PNG"}
          </button>
        </div>

        {filters && data && (
          <div className="mb-4 flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <Field label="Seasons">
              <select
                className={selectCls}
                value={filters.seasonFrom}
                onChange={(e) => update({ seasonFrom: Number(e.target.value) })}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-gray-400">–</span>
              <select
                className={selectCls}
                value={filters.seasonTo}
                onChange={(e) => update({ seasonTo: Number(e.target.value) })}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Weeks">
              <select
                className={selectCls}
                value={filters.weekFrom}
                disabled={filters.playoffs === "only"}
                onChange={(e) => update({ weekFrom: Number(e.target.value) })}
              >
                {WEEKS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
              <span className="text-gray-400">–</span>
              <select
                className={selectCls}
                value={filters.weekTo}
                disabled={filters.playoffs === "only"}
                onChange={(e) => update({ weekTo: Number(e.target.value) })}
              >
                {WEEKS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Playoffs">
              <select
                className={selectCls}
                value={filters.playoffs}
                onChange={(e) =>
                  update({ playoffs: e.target.value as Playoffs })
                }
              >
                <option value="none">Exclude</option>
                <option value="include">Include</option>
                <option value="only">Only playoffs</option>
              </select>
            </Field>

            <Field label="Win probability">
              <select
                className={selectCls}
                value={filters.wpMin}
                onChange={(e) => update({ wpMin: Number(e.target.value) })}
              >
                {WP_STEPS.map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
              <span className="text-gray-400">–</span>
              <select
                className={selectCls}
                value={filters.wpMax}
                onChange={(e) => update({ wpMax: Number(e.target.value) })}
              >
                {WP_STEPS.map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  filters.wpMin === 20 && filters.wpMax === 80
                    ? update({ wpMin: 0, wpMax: 100 })
                    : update({ wpMin: 20, wpMax: 80 })
                }
                className={cn(
                  "rounded-md border px-2 py-1 text-xs",
                  filters.wpMin === 20 && filters.wpMax === 80
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50",
                )}
                title="Neutral game script: win probability 20–80%"
              >
                Neutral
              </button>
            </Field>

            <Field label="Downs">
              <Chips
                values={ALL_DOWNS}
                selected={filters.downs}
                onChange={(downs) => update({ downs })}
              />
            </Field>

            <Field label="Quarters">
              <Chips
                values={ALL_QTRS}
                selected={filters.qtrs}
                label={(q) => (q === 5 ? "OT" : String(q))}
                onChange={(qtrs) => update({ qtrs })}
              />
            </Field>

            <Field label="Plays">
              <select
                className={selectCls}
                value={filters.plays}
                onChange={(e) => update({ plays: e.target.value as PlayType })}
              >
                <option value="all">
                  {chart === "qbs" ? "Dropbacks + QB runs" : "Dropbacks + runs"}
                </option>
                <option value="pass">Dropbacks only</option>
                {chart === "teams" && <option value="run">Runs only</option>}
              </select>
            </Field>

            {chart === "qbs" && (
              <Field label="Min plays">
                <MinPlaysInput
                  value={filters.minPlays}
                  auto={shown?.minPlays ?? null}
                  onCommit={(minPlays) => update({ minPlays })}
                />
              </Field>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div
          className={cn(
            "overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-opacity",
            loading && shown && "opacity-60",
          )}
        >
          {!shown ? (
            <div className="flex aspect-[1000/680] items-center justify-center text-sm text-gray-500">
              {loading ? "Loading chart…" : "No chart"}
            </div>
          ) : empty ? (
            <div className="flex aspect-[1000/680] items-center justify-center p-6 text-center text-sm text-gray-500">
              No {chart === "teams" ? "teams" : "quarterbacks"} match these
              filters
              {chart === "qbs" && " — try lowering the minimum plays"}.
            </div>
          ) : chart === "teams" ? (
            <TeamTiersChart data={shown} svgRef={svgRef} />
          ) : (
            <QbChart data={shown} svgRef={svgRef} />
          )}
        </div>

        {shown && !empty && (
          <details className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Show data
              <span className="ml-2 font-normal text-gray-400">
                {(shown.teams ?? shown.qbs ?? []).length} rows · {shown.ms} ms
              </span>
            </summary>
            <div className="mt-3 overflow-x-auto">
              <DataTable data={shown} />
            </div>
          </details>
        )}

        <p className="mt-4 text-xs text-gray-500">
          EPA/play counts dropbacks (passes, sacks, scrambles) and runs. Win
          probability is from each team&apos;s own side, so on defense it is the
          defending team&apos;s chance of winning. Charts in the style of Ben
          Baldwin&apos;s rbsdm.com.
        </p>
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}
