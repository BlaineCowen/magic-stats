"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { SortableTable, type Column } from "@/components/sortable-table";
import {
  ALL_DOWNS,
  ALL_QTRS,
  type ChartData,
  type ChartFilters,
  type ChartKind,
  type LuckPoint,
  type QbPoint,
  type TeamPoint,
  type PlayType,
  type Playoffs,
  POSITIONS,
} from "@/lib/nfl/chart-types";
import { downloadSvgAsPng, pct, signed } from "./chart-kit";
import { LuckChart } from "./luck-chart";
import { QbChart } from "./qb-chart";
import { TeamTiersChart, type PathMode } from "./team-tiers-chart";

const TABS: { kind: ChartKind; label: string }[] = [
  { kind: "teams", label: "Team tiers" },
  { kind: "qbs", label: "Quarterbacks" },
  { kind: "luck", label: "Fantasy luck" },
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
  if (f.pos !== "all") p.set("pos", f.pos);
  return p.toString();
}

const regWeeks = (season: number) => (season >= 2021 ? 18 : 17);

function listLabel(values: number[], label: (n: number) => string = String) {
  const s = [...values].sort((a, b) => a - b);
  const run = s.every((v, i) => i === 0 || v === s[i - 1]! + 1);
  return run && s.length > 2
    ? `${label(s[0]!)}–${label(s.at(-1)!)}`
    : s.map(label).join(", ");
}

/** Short one-line summary for the collapsed filter bar on phones. */
function summarize(f: ChartFilters, chart: ChartKind): string {
  const parts = [
    f.seasonFrom === f.seasonTo
      ? String(f.seasonFrom)
      : `${f.seasonFrom}–${f.seasonTo}`,
    f.playoffs === "only"
      ? "Playoffs only"
      : `Weeks ${f.weekFrom}–${f.weekTo}${f.playoffs === "include" ? " + playoffs" : ""}`,
  ];
  if (chart === "luck") {
    parts.push(f.pos === "all" ? "All positions" : `${f.pos}s`);
    return parts.join(" · ");
  }
  if (f.wpMin !== 0 || f.wpMax !== 100)
    parts.push(`Win prob ${f.wpMin}–${f.wpMax}%`);
  if (f.downs.length !== ALL_DOWNS.length)
    parts.push(`Downs ${listLabel(f.downs)}`);
  if (f.qtrs.length !== ALL_QTRS.length)
    parts.push(
      `Quarters ${listLabel(f.qtrs, (q) => (q === 5 ? "OT" : String(q)))}`,
    );
  if (f.plays === "pass") parts.push("Dropbacks only");
  if (f.plays === "run") parts.push("Runs only");
  if (chart === "qbs" && f.minPlays) parts.push(`${f.minPlays}+ plays`);
  return parts.join(" · ");
}

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";

const selectCls =
  "min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-turf-700";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chips({
  name,
  values,
  selected,
  label = String,
  onChange,
}: {
  name: string;
  values: number[];
  selected: number[];
  label?: (v: number) => string;
  onChange: (next: number[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label={name}
      className="flex w-full overflow-hidden rounded-md border border-slate-300 bg-white"
    >
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
              "font-display flex-1 border-l border-slate-300 px-2 py-1 text-base font-semibold first:border-l-0 focus-visible:-outline-offset-2",
              focusCls,
              on
                ? "bg-turf-950 text-white"
                : "text-slate-600 hover:bg-slate-50",
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
      aria-label="Minimum plays"
      value={draft}
      placeholder={auto ? `Auto (${auto})` : "Auto"}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className={selectCls}
    />
  );
}

function num<T>(
  key: string,
  label: string,
  get: (r: T) => number,
  fmt: (v: number) => string,
  extra?: Partial<Column<T>>,
): Column<T> {
  return { key, label, value: get, render: (r) => fmt(get(r)), ...extra };
}
const one = (v: number) => v.toFixed(1);
const plus1 = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

function NameCell({
  name,
  short,
  color,
}: {
  name: string;
  /** Shown instead of the name on phones, where the column is narrow. */
  short?: string;
  color: string | null;
}) {
  return (
    <span className="flex items-center gap-2 font-medium whitespace-nowrap text-slate-900">
      <span
        className="size-2.5 shrink-0 rounded-full bg-slate-300"
        style={color ? { background: color } : undefined}
        aria-hidden
      />
      {short ? (
        <>
          <span className="sm:hidden" title={name}>
            {short}
          </span>
          <span className="max-sm:hidden">{name}</span>
        </>
      ) : (
        name
      )}
    </span>
  );
}

const nameSearch = <T extends { team: string }>(
  name: (r: T) => string,
  placeholder: string,
) => ({ text: (r: T) => `${name(r)} ${r.team}`, placeholder });

const teamSearch = nameSearch<TeamPoint>(
  (t) => t.team_name ?? t.team,
  "Search teams",
);
const qbSearch = nameSearch<QbPoint>(
  (q) => q.full_name ?? q.name,
  "Search quarterbacks or teams",
);
const luckSearch = nameSearch<LuckPoint>(
  (p) => p.name,
  "Search players or teams",
);

const TEAM_COLS: Column<TeamPoint>[] = [
  {
    key: "team",
    label: "Team",
    align: "left",
    ascFirst: true,
    value: (t) => t.team_name ?? t.team,
    render: (t) => (
      <NameCell
        name={t.team_name ?? t.team}
        short={t.team}
        color={t.team_color}
      />
    ),
  },
  num("off", "Off EPA/play", (t: TeamPoint) => t.off_epa, signed),
  // Low is good on defense.
  num("def", "Def EPA/play", (t: TeamPoint) => t.def_epa, signed, {
    ascFirst: true,
  }),
  num("net", "Net", (t: TeamPoint) => t.off_epa - t.def_epa, signed, {
    className: "font-semibold",
  }),
  num("offs", "Off success", (t: TeamPoint) => t.off_success, pct),
  num("defs", "Def success", (t: TeamPoint) => t.def_success, pct, {
    ascFirst: true,
  }),
  num("games", "Games", (t: TeamPoint) => t.games, String),
];

const QB_COLS: Column<QbPoint>[] = [
  {
    key: "name",
    label: "Quarterback",
    align: "left",
    ascFirst: true,
    value: (q) => q.full_name ?? q.name,
    render: (q) => (
      <NameCell name={q.full_name ?? q.name} color={q.team_color} />
    ),
  },
  {
    key: "team",
    label: "Team",
    align: "left",
    ascFirst: true,
    value: (q) => q.team,
    render: (q) => q.team,
  },
  num("epa", "EPA/play", (q: QbPoint) => q.epa, signed, {
    className: "font-semibold",
  }),
  num("cpoe", "CPOE", (q: QbPoint) => q.cpoe, plus1),
  num("success", "Success", (q: QbPoint) => q.success, pct),
  num("plays", "Plays", (q: QbPoint) => q.plays, String),
];

const LUCK_COLS: Column<LuckPoint>[] = [
  {
    key: "name",
    label: "Player",
    align: "left",
    ascFirst: true,
    value: (p) => p.name,
    render: (p) => <NameCell name={p.name} color={p.team_color} />,
  },
  {
    key: "pos",
    label: "Pos",
    align: "left",
    ascFirst: true,
    value: (p) => p.position,
    render: (p) => p.position,
  },
  {
    key: "team",
    label: "Team",
    align: "left",
    ascFirst: true,
    value: (p) => p.team,
    render: (p) => p.team,
  },
  num("ppg", "PPR/game", (p: LuckPoint) => p.ppg, one),
  num("xppg", "Expected/game", (p: LuckPoint) => p.xppg, one),
  num("over", "Over expected", (p: LuckPoint) => p.points - p.expected, plus1, {
    className: "font-semibold",
  }),
  num("games", "Games", (p: LuckPoint) => p.games, String),
];

function DataTable({ data }: { data: ChartData }) {
  const common = { rank: true, maxHeight: "28rem", minWidth: 560 } as const;
  if (data.luck)
    return (
      <SortableTable
        {...common}
        rows={data.luck}
        columns={LUCK_COLS}
        rowKey={(p) => p.id}
        defaultSort={{ key: "over", desc: true }}
        search={luckSearch}
        label="Fantasy luck data"
      />
    );
  if (data.teams)
    return (
      <SortableTable
        {...common}
        rows={data.teams}
        columns={TEAM_COLS}
        rowKey={(t) => t.team}
        defaultSort={{ key: "net", desc: true }}
        search={teamSearch}
        label="Team tiers data"
      />
    );
  return (
    <SortableTable
      {...common}
      rows={data.qbs ?? []}
      columns={QB_COLS}
      rowKey={(q) => q.id}
      defaultSort={{ key: "epa", desc: true }}
      search={qbSearch}
      label="Quarterback data"
    />
  );
}

type PresetKey = "this" | "last4" | "last";

export function ChartsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const svgRef = useRef<SVGSVGElement>(null);

  const [chart, setChart] = useState<ChartKind>(
    (["qbs", "luck"] as const).find((k) => k === searchParams.get("chart")) ??
      "teams",
  );
  // Whatever the URL asked for; the server fills in defaults it leaves out.
  const [query, setQuery] = useState(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("chart");
    p.delete("trace");
    p.delete("path");
    return p.toString();
  });
  // Teams whose week-by-week path is drawn, kept in the URL (?trace=HOU,KC)
  // so a traced chart can be shared. Not part of `query`: no refetch needed.
  const [traced, setTraced] = useState<string[]>(() =>
    (searchParams.get("trace") ?? "")
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z]{2,3}$/.test(t)),
  );
  const [pathMode, setPathMode] = useState<PathMode>(
    searchParams.get("path") === "rolling" ? "rolling" : "season",
  );
  const traceParams = useRef({ traced, pathMode });
  traceParams.current = { traced, pathMode };
  const withTrace = (params: URLSearchParams) => {
    const t = traceParams.current;
    if (t.traced.length) params.set("trace", t.traced.join(","));
    else params.delete("trace");
    if (t.traced.length && t.pathMode === "rolling")
      params.set("path", "rolling");
    else params.delete("path");
    return params;
  };
  const [filters, setFilters] = useState<ChartFilters | null>(null);
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Latest regular-season week with plays in the newest season. The server
  // clamps weekTo to it, so we learn it whenever a request asks for more.
  const [latestWeek, setLatestWeek] = useState<number | null>(null);
  // "Last 4 weeks" picked before latestWeek was known: finish it on response.
  const pendingLast4 = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set("chart", chart);
    // Keeps the URL shareable: every filter change lands in the query string.
    router.replace(
      `${pathname}?${withTrace(new URLSearchParams(params)).toString()}`,
      {
        scroll: false,
      },
    );
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/charts?${params.toString()}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = (await res.json()) as ChartData & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to load chart");
        const f = body.filters;
        const askedTo = params.get("weekTo");
        if (
          f.seasonTo === body.seasons.max &&
          (!askedTo || Number(askedTo) >= 18 || Number(askedTo) > f.weekTo)
        ) {
          setLatestWeek(f.weekTo);
          if (pendingLast4.current) {
            pendingLast4.current = false;
            const next = { ...f, weekFrom: Math.max(1, f.weekTo - 3) };
            setFilters(next);
            setQuery(toQuery(next));
            return;
          }
        }
        pendingLast4.current = false;
        setData(body);
        setFilters(f);
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

  // Tracing only changes the URL, so it doesn't go through the router.
  useEffect(() => {
    const url = new URL(window.location.href);
    withTrace(url.searchParams);
    window.history.replaceState(window.history.state, "", url);
  }, [traced, pathMode]);

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
        `${{ teams: "team-tiers", qbs: "quarterbacks", luck: "fantasy-luck" }[chart]}-${seasons}.png`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Copy the address bar instead.");
    }
  };

  const maxSeason = data?.seasons.max ?? null;
  const seasons: number[] = [];
  if (data) {
    for (let s = data.seasons.max; s >= data.seasons.min; s--) seasons.push(s);
  }

  const applyPreset = (key: PresetKey) => {
    if (!filters || maxSeason == null) return;
    const base = { playoffs: "none" as Playoffs, weekFrom: 1 };
    if (key === "this") {
      update({
        ...base,
        seasonFrom: maxSeason,
        seasonTo: maxSeason,
        weekTo: 18,
      });
    } else if (key === "last") {
      const s = maxSeason - 1;
      update({ ...base, seasonFrom: s, seasonTo: s, weekTo: regWeeks(s) });
    } else if (latestWeek != null) {
      update({
        ...base,
        seasonFrom: maxSeason,
        seasonTo: maxSeason,
        weekFrom: Math.max(1, latestWeek - 3),
        weekTo: latestWeek,
      });
    } else {
      // Ask for the whole season; the response tells us the latest week.
      pendingLast4.current = true;
      update({
        ...base,
        seasonFrom: maxSeason,
        seasonTo: maxSeason,
        weekTo: 18,
      });
    }
  };

  const presetOn = (key: PresetKey): boolean => {
    if (!filters || maxSeason == null || filters.playoffs === "only")
      return false;
    const f = filters;
    const one = (s: number) => f.seasonFrom === s && f.seasonTo === s;
    if (key === "last")
      return (
        one(maxSeason - 1) &&
        f.weekFrom === 1 &&
        f.weekTo === regWeeks(maxSeason - 1)
      );
    if (!one(maxSeason) || latestWeek == null || f.weekTo !== latestWeek)
      return false;
    if (key === "this") return f.weekFrom === 1;
    return f.weekFrom === Math.max(1, latestWeek - 3) && latestWeek > 4;
  };
  const neutral = filters?.wpMin === 20 && filters?.wpMax === 80;

  // Only show a chart that matches the selected tab (not the previous one).
  const shown = data?.chart === chart ? data : null;
  const empty =
    shown && (shown.teams ?? shown.qbs ?? shown.luck ?? []).length === 0;
  const busy = loading;

  const presets: {
    key: string;
    label: string;
    on: boolean;
    run: () => void;
  }[] = [
    {
      key: "this",
      label: "This season",
      on: presetOn("this"),
      run: () => applyPreset("this"),
    },
    {
      key: "last4",
      label: "Last 4 weeks",
      on: presetOn("last4"),
      run: () => applyPreset("last4"),
    },
    {
      key: "last",
      label: "Last season",
      on: presetOn("last"),
      run: () => applyPreset("last"),
    },
    ...(chart === "luck"
      ? []
      : [
          {
            key: "neutral",
            label: "Neutral situations (win prob 20–80%)",
            on: neutral,
            run: () =>
              neutral
                ? update({ wpMin: 0, wpMax: 100 })
                : update({ wpMin: 20, wpMax: 80 }),
          },
        ]),
  ];

  const btnCls = cn(
    "rounded-md px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    focusCls,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Chart"
          className="inline-flex rounded-lg border border-slate-300 bg-white p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              role="tab"
              aria-selected={chart === t.kind}
              onClick={() => setChart(t.kind)}
              className={cn(
                "font-display rounded-md px-4 py-1.5 text-lg font-semibold transition-colors",
                focusCls,
                chart === t.kind
                  ? "bg-turf-950 text-white"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className={cn(
              btnCls,
              "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={() => void download()}
            disabled={!shown || !!empty || exporting || busy}
            className={cn(btnCls, "bg-turf-700 hover:bg-turf-800 text-white")}
          >
            {exporting ? "Exporting…" : "Download PNG"}
          </button>
        </div>
      </div>

      {!filters || !data ? (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            {[96, 104, 96, 220].map((w, i) => (
              <div
                key={i}
                style={{ width: w }}
                className="h-8 shrink-0 animate-pulse rounded-full bg-slate-200/70"
              />
            ))}
          </div>
          <div className="hidden h-36 animate-pulse rounded-lg bg-slate-200/70 sm:block" />
          <div className="h-12 animate-pulse rounded-lg bg-slate-200/70 sm:hidden" />
        </div>
      ) : (
        <section aria-label="Filters" className="mb-4 space-y-3">
          <div
            className="nfl-scroll-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
            role="group"
            aria-label="Quick presets"
          >
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={p.on}
                onClick={p.run}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  focusCls,
                  p.on
                    ? "border-turf-950 bg-turf-950 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="chart-filters"
              onClick={() => setFiltersOpen((o) => !o)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left sm:hidden",
                focusCls,
              )}
            >
              <span className="font-display text-lg font-semibold text-slate-900">
                Filters
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                {summarize(filters, chart)}
              </span>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className={cn(
                  "size-4 shrink-0 text-slate-500 transition-transform",
                  filtersOpen && "rotate-180",
                )}
              >
                <path
                  d="M5 8l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <div
              id="chart-filters"
              className={cn(
                "grid gap-x-5 gap-y-4 border-t border-slate-200 p-4 sm:grid sm:grid-cols-2 sm:border-t-0 lg:grid-cols-4",
                filtersOpen ? "grid" : "hidden",
              )}
            >
              <Field label="Seasons">
                <select
                  aria-label="First season"
                  className={selectCls}
                  value={filters.seasonFrom}
                  onChange={(e) =>
                    update({ seasonFrom: Number(e.target.value) })
                  }
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="text-slate-400">to</span>
                <select
                  aria-label="Last season"
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
                  aria-label="First week"
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
                <span className="text-slate-400">to</span>
                <select
                  aria-label="Last week"
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
                  aria-label="Playoffs"
                  className={selectCls}
                  value={filters.playoffs}
                  onChange={(e) =>
                    update({ playoffs: e.target.value as Playoffs })
                  }
                >
                  <option value="none">Regular season only</option>
                  <option value="include">Include playoffs</option>
                  <option value="only">Playoffs only</option>
                </select>
              </Field>

              {chart === "luck" ? (
                <Field label="Position">
                  <div
                    role="group"
                    aria-label="Position"
                    className="flex w-full overflow-hidden rounded-md border border-slate-300 bg-white"
                  >
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        aria-pressed={filters.pos === pos}
                        onClick={() => update({ pos })}
                        className={cn(
                          "font-display flex-1 border-l border-slate-300 px-2 py-1 text-base font-semibold first:border-l-0 focus-visible:-outline-offset-2",
                          focusCls,
                          filters.pos === pos
                            ? "bg-turf-950 text-white"
                            : "text-slate-600 hover:bg-slate-50",
                        )}
                      >
                        {pos === "all" ? "All" : pos}
                      </button>
                    ))}
                  </div>
                </Field>
              ) : (
                <>
                  <Field label="Win probability">
                    <select
                      aria-label="Minimum win probability"
                      className={selectCls}
                      value={filters.wpMin}
                      onChange={(e) =>
                        update({ wpMin: Number(e.target.value) })
                      }
                    >
                      {WP_STEPS.map((v) => (
                        <option key={v} value={v}>
                          {v}%
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400">to</span>
                    <select
                      aria-label="Maximum win probability"
                      className={selectCls}
                      value={filters.wpMax}
                      onChange={(e) =>
                        update({ wpMax: Number(e.target.value) })
                      }
                    >
                      {WP_STEPS.map((v) => (
                        <option key={v} value={v}>
                          {v}%
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Downs">
                    <Chips
                      name="Downs"
                      values={ALL_DOWNS}
                      selected={filters.downs}
                      onChange={(downs) => update({ downs })}
                    />
                  </Field>

                  <Field label="Quarters">
                    <Chips
                      name="Quarters"
                      values={ALL_QTRS}
                      selected={filters.qtrs}
                      label={(q) => (q === 5 ? "OT" : String(q))}
                      onChange={(qtrs) => update({ qtrs })}
                    />
                  </Field>

                  <Field label="Plays">
                    <select
                      aria-label="Plays"
                      className={selectCls}
                      value={filters.plays}
                      onChange={(e) =>
                        update({ plays: e.target.value as PlayType })
                      }
                    >
                      <option value="all">
                        {chart === "qbs"
                          ? "Dropbacks and QB runs"
                          : "Dropbacks and runs"}
                      </option>
                      <option value="pass">Dropbacks only</option>
                      {chart === "teams" && (
                        <option value="run">Runs only</option>
                      )}
                    </select>
                  </Field>
                </>
              )}

              {chart === "qbs" && (
                <Field label="Minimum plays">
                  <MinPlaysInput
                    value={filters.minPlays}
                    auto={shown?.minPlays ?? null}
                    onCommit={(minPlays) => update({ minPlays })}
                  />
                </Field>
              )}
            </div>
          </div>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-lg border border-slate-200 bg-white"
        aria-busy={busy}
      >
        {!shown ? (
          busy ? (
            <div className="relative aspect-[1000/680] animate-pulse bg-slate-100">
              <div className="absolute top-[6%] left-[2.4%] h-[5%] w-1/4 rounded bg-slate-200" />
              <div className="absolute top-[11%] left-[2.4%] h-[2.5%] w-1/2 rounded bg-slate-200" />
              <div className="absolute top-[13.5%] right-[2.4%] bottom-[11%] left-[8.4%] rounded bg-slate-200/70" />
              <p className="absolute inset-x-0 bottom-[3%] text-center text-sm text-slate-500">
                Crunching play-by-play. The first chart can take a few seconds.
              </p>
            </div>
          ) : (
            <div className="flex aspect-[1000/680] items-center justify-center p-6 text-center text-sm text-slate-500">
              The chart didn&apos;t load. Try another filter or reload the page.
            </div>
          )
        ) : empty ? (
          <div className="flex aspect-[1000/680] items-center justify-center p-6 text-center text-sm text-slate-500">
            No {{ teams: "teams", qbs: "quarterbacks", luck: "players" }[chart]}{" "}
            match these filters
            {chart === "qbs" && ". Try lowering the minimum plays"}.
          </div>
        ) : (
          <div
            className={cn(
              "transition-opacity",
              busy && "pointer-events-none opacity-40",
            )}
          >
            {chart === "luck" ? (
              <LuckChart data={shown} svgRef={svgRef} />
            ) : chart === "teams" ? (
              <TeamTiersChart
                data={shown}
                svgRef={svgRef}
                traced={traced}
                onTracedChange={setTraced}
                mode={pathMode}
                onModeChange={setPathMode}
              />
            ) : (
              <QbChart data={shown} svgRef={svgRef} />
            )}
          </div>
        )}
        {shown && busy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
              <span className="border-t-turf-700 size-3.5 animate-spin rounded-full border-2 border-slate-300 motion-reduce:animate-none" />
              Updating
            </span>
          </div>
        )}
      </div>

      {shown && !empty && (
        <details className="group mt-4 rounded-lg border border-slate-200 bg-white">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden",
              focusCls,
            )}
          >
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              className="size-4 text-slate-500 transition-transform group-open:rotate-90"
            >
              <path
                d="M8 5l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            Show data
            <span className="font-normal text-slate-500">
              {(shown.teams ?? shown.qbs ?? shown.luck ?? []).length} rows
            </span>
          </summary>
          <div className="border-t border-slate-200 p-3 sm:p-4">
            <DataTable data={shown} />
          </div>
        </details>
      )}

      {chart === "luck" ? (
        <p className="mt-4 max-w-3xl text-sm text-slate-500">
          Expected points come from the ffopportunity model: what an average
          player would score with the same targets, carries, depth and field
          position. Players far above the line are getting more out of their
          usage than it usually yields, which tends not to last; players below
          it are the buy-low candidates. Shows fantasy-relevant players only (6+
          expected PPR points per game).
        </p>
      ) : (
        <p className="mt-4 max-w-3xl text-sm text-slate-500">
          EPA (expected points added) per play counts dropbacks (passes, sacks,
          scrambles) and runs. On the team chart the defense axis is flipped, so
          defenses that give up fewer points sit higher. Win probability is from
          each team&apos;s own side, so on defense it is the defending
          team&apos;s chance of winning. Charts in the style of Ben
          Baldwin&apos;s rbsdm.com.
        </p>
      )}
      <Toaster position="bottom-center" />
    </div>
  );
}
