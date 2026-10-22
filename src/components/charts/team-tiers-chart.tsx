"use client";

import { useEffect, useMemo, useState, type Ref } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import {
  describeFilters,
  type ChartData,
  type TeamPoint,
  type TeamWeek,
} from "@/lib/nfl/chart-types";
import { cn } from "@/lib/utils";
import {
  ChartSvg,
  makeAxis,
  pct,
  signed,
  TipRow,
  useChartTooltip,
  weightedMean,
} from "./chart-kit";

const LOGO = 44;
/** The moving logo on a traced path is a little bigger than the rest. */
const PATH_LOGO = 54;
const STEP_MS = 650;
/** Window for the "Last 4 games" path. */
const ROLLING = 4;

export type PathMode = "season" | "rolling";

const ordinal = (n: number) =>
  `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";

type PathPoint = {
  week: number;
  opponent: string | null;
  off: number;
  def: number;
  games: number;
};

/** A team's EPA/play after each week, season to date or over its last 4 games. */
export function teamPath(
  weekly: TeamWeek[],
  team: string,
  mode: PathMode,
): PathPoint[] {
  const games = weekly
    .filter((w) => w.team === team)
    .sort((a, b) => a.week - b.week);
  const out: PathPoint[] = [];
  games.forEach((g, i) => {
    const span =
      mode === "season"
        ? games.slice(0, i + 1)
        : games.slice(Math.max(0, i - ROLLING + 1), i + 1);
    const offN = span.reduce((s, w) => s + w.off_plays, 0);
    const defN = span.reduce((s, w) => s + w.def_plays, 0);
    if (!offN || !defN) return;
    out.push({
      week: g.week,
      opponent: g.opponent,
      off: span.reduce((s, w) => s + w.off_epa_sum, 0) / offN,
      def: span.reduce((s, w) => s + w.def_epa_sum, 0) / defN,
      games: span.length,
    });
  });
  return out;
}

const weekLabel = (w: number) => (w > 18 ? "Playoffs" : `Week ${w}`);

/**
 * Offense EPA/play (x) against defense EPA/play (y, inverted so good defenses
 * sit at the top). Diagonals are lines of equal net EPA/play, so teams higher
 * up and further right are better overall. Clicking a logo traces that team's
 * path through the season, drawn week by week.
 */
export function TeamTiersChart({
  data,
  svgRef,
  traced,
  onTracedChange,
  mode,
  onModeChange,
}: {
  data: ChartData;
  svgRef: Ref<SVGSVGElement>;
  /** Team codes whose season path is drawn. */
  traced: string[];
  onTracedChange: (teams: string[]) => void;
  mode: PathMode;
  onModeChange: (mode: PathMode) => void;
}) {
  const teams = data.teams ?? [];
  const weekly = data.weekly;
  const tip = useChartTooltip();
  const byTeam = new Map(teams.map((t) => [t.team, t]));
  const activeKey = weekly ? traced.filter((t) => byTeam.has(t)).join(",") : "";
  const active = activeKey ? activeKey.split(",") : [];
  const paths = useMemo(
    () =>
      (activeKey ? activeKey.split(",") : []).map((team) => ({
        team,
        points: teamPath(weekly ?? [], team, mode),
      })),
    [weekly, activeKey, mode],
  );
  const weeksKey = [
    ...new Set(paths.flatMap((p) => p.points.map((pt) => pt.week))),
  ]
    .sort((a, b) => a - b)
    .join(",");
  const weeks = useMemo(
    () => (weeksKey ? weeksKey.split(",").map(Number) : []),
    [weeksKey],
  );

  // Animation: `shownWeek` is the last week drawn. A new selection or mode
  // replays from the first week.
  const lastWeek = weeks.at(-1) ?? 0;
  const [shownWeek, setShownWeek] = useState(lastWeek);
  const [playing, setPlaying] = useState(false);
  const replayKey = `${activeKey}|${mode}|${weeksKey}`;
  useEffect(() => {
    if (!weeks.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShownWeek(weeks.at(-1)!);
      setPlaying(false);
      return;
    }
    setShownWeek(weeks[0]!);
    setPlaying(true);
    // Only a new selection, mode or week list restarts the replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setShownWeek((w) => {
        const next = weeks.find((x) => x > w);
        if (next === undefined) {
          setPlaying(false);
          return w;
        }
        return next;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playing, weeks]);

  // Axes cover every path point too, so the frame doesn't jump mid-replay.
  const pathPts = paths.flatMap((p) => p.points);
  const x = makeAxis(
    [...teams.map((t) => t.off_epa), ...pathPts.map((p) => p.off)],
    "Offense EPA/play",
    { minDecimals: 2 },
  );
  const y = makeAxis(
    [...teams.map((t) => t.def_epa), ...pathPts.map((p) => p.def)],
    "Defense EPA/play",
    { minDecimals: 2, invert: true },
  );
  const avgOff = weightedMean(
    teams,
    (t) => t.off_epa,
    (t) => t.off_plays,
  );
  const avgDef = weightedMean(
    teams,
    (t) => t.def_epa,
    (t) => t.def_plays,
  );

  // Tiers: off - def = c, one line per x tick step across the visible range.
  const step = x.step;
  const tiers: number[] = [];
  for (
    let c = Math.ceil((x.lo - y.hi) / step) * step;
    c <= x.hi - y.lo;
    c += step
  ) {
    tiers.push(c);
  }
  const offRank = new Map(
    [...teams]
      .sort((a, b) => b.off_epa - a.off_epa)
      .map((t, i) => [t.team, i + 1]),
  );
  const defRank = new Map(
    [...teams]
      .sort((a, b) => a.def_epa - b.def_epa)
      .map((t, i) => [t.team, i + 1]),
  );

  const toggle = (team: string) => {
    if (!weekly) return;
    onTracedChange(
      traced.includes(team)
        ? traced.filter((t) => t !== team)
        : [...traced, team],
    );
  };
  const color = (t: TeamPoint | undefined) => t?.team_color ?? "#334155";
  const name = (team: string) => byTeam.get(team)?.team_name ?? team;
  const tracing = paths.length > 0;
  const modeLabel =
    mode === "season" ? "season to date" : `last ${ROLLING} games`;
  const subtitle = tracing
    ? `${describeFilters(data.filters)} · path: ${modeLabel}, through ${weekLabel(shownWeek).toLowerCase()}`
    : describeFilters(data.filters);

  const teamTip = (t: TeamPoint) => (
    <>
      <div className="mb-1 font-semibold">{t.team_name ?? t.team}</div>
      <TipRow
        label={`Offense (${ordinal(offRank.get(t.team) ?? 0)})`}
        value={signed(t.off_epa)}
      />
      <TipRow
        label={`Defense (${ordinal(defRank.get(t.team) ?? 0)})`}
        value={signed(t.def_epa)}
      />
      <TipRow label="Net EPA/play" value={signed(t.off_epa - t.def_epa)} />
      <TipRow
        label="Success rate O / D"
        value={`${pct(t.off_success)} / ${pct(t.def_success)}`}
      />
      <TipRow label="Plays O / D" value={`${t.off_plays} / ${t.def_plays}`} />
      <TipRow label="Games" value={String(t.games)} />
      {weekly && (
        <div className="mt-1.5 text-gray-500">Click to trace their season</div>
      )}
    </>
  );

  const pointTip = (team: string, p: PathPoint, last: boolean) => (
    <>
      <div className="mb-1 font-semibold">
        {name(team)}, {weekLabel(p.week)}
        {p.opponent ? ` vs ${p.opponent}` : ""}
      </div>
      <TipRow label={`Offense, ${modeLabel}`} value={signed(p.off)} />
      <TipRow label={`Defense, ${modeLabel}`} value={signed(p.def)} />
      <TipRow label="Net EPA/play" value={signed(p.off - p.def)} />
      <TipRow label="Games" value={String(p.games)} />
      {last && (
        <div className="mt-1.5 text-gray-500">Click to stop tracing</div>
      )}
    </>
  );

  return (
    <div ref={tip.wrapRef} className="relative">
      {weekly ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 text-sm sm:px-4">
          <label className="sr-only" htmlFor="trace-team">
            Trace a team&apos;s season
          </label>
          <select
            id="trace-team"
            value=""
            onChange={(e) => e.target.value && toggle(e.target.value)}
            className={cn(
              "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-700",
              focusCls,
            )}
          >
            <option value="">
              {tracing ? "Add a team…" : "Trace a team's season…"}
            </option>
            {[...teams]
              .filter((t) => !traced.includes(t.team))
              .sort((a, b) =>
                (a.team_name ?? a.team).localeCompare(b.team_name ?? b.team),
              )
              .map((t) => (
                <option key={t.team} value={t.team}>
                  {t.team_name ?? t.team}
                </option>
              ))}
          </select>
          {active.map((team) => (
            <span
              key={team}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white py-1 pr-1 pl-2.5 font-medium text-slate-800"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: color(byTeam.get(team)) }}
              />
              {name(team)}
              <button
                type="button"
                onClick={() => toggle(team)}
                className={cn(
                  "rounded-full p-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                  focusCls,
                )}
                aria-label={`Stop tracing ${name(team)}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          {tracing ? (
            <>
              <div
                role="group"
                aria-label="Path"
                className="flex overflow-hidden rounded-md border border-slate-300"
              >
                {(["season", "rolling"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => onModeChange(m)}
                    className={cn(
                      "border-l border-slate-300 px-2.5 py-1 font-medium first:border-l-0 focus-visible:-outline-offset-2",
                      focusCls,
                      mode === m
                        ? "bg-turf-950 text-white"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {m === "season"
                      ? "Season to date"
                      : `Last ${ROLLING} games`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (playing) setPlaying(false);
                  else {
                    if (shownWeek >= lastWeek) setShownWeek(weeks[0]!);
                    setPlaying(true);
                  }
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50",
                  focusCls,
                )}
              >
                {playing ? (
                  <Pause className="size-3.5" aria-hidden />
                ) : shownWeek >= lastWeek ? (
                  <RotateCcw className="size-3.5" aria-hidden />
                ) : (
                  <Play className="size-3.5" aria-hidden />
                )}
                {playing ? "Pause" : shownWeek >= lastWeek ? "Replay" : "Play"}
              </button>
              <label className="flex min-w-48 flex-1 items-center gap-2 text-slate-600">
                <span className="w-16 shrink-0 tabular-nums">
                  {weekLabel(shownWeek)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, weeks.length - 1)}
                  value={Math.max(0, weeks.indexOf(shownWeek))}
                  onChange={(e) => {
                    setPlaying(false);
                    setShownWeek(weeks[Number(e.target.value)] ?? lastWeek);
                  }}
                  className="accent-turf-800 w-full"
                  aria-label="Week"
                />
              </label>
            </>
          ) : (
            <span className="text-slate-500">
              or click a logo to watch a team move week by week.
            </span>
          )}
        </div>
      ) : (
        <p className="border-b border-slate-200 px-4 py-2.5 text-sm text-slate-500">
          Pick a single season to trace a team week by week.
        </p>
      )}
      <div>
        <ChartSvg
          svgRef={svgRef}
          className="block h-auto w-full"
          title="Team Tiers"
          subtitle={subtitle}
          x={x}
          y={y}
          footnote="Data: nflverse · EPA/play on dropbacks and runs"
        >
          {({ sx, sy, clip }) => (
            <>
              <g clipPath={clip}>
                {tiers.map((c) => {
                  const a = Math.min(x.lo, y.lo + c);
                  const b = Math.max(x.hi, y.hi + c);
                  return (
                    <line
                      key={c}
                      x1={sx(a)}
                      y1={sy(a - c)}
                      x2={sx(b)}
                      y2={sy(b - c)}
                      stroke="#9ca3af"
                      strokeOpacity={0.6}
                    />
                  );
                })}
                <line
                  x1={sx(avgOff)}
                  x2={sx(avgOff)}
                  y1={sy(y.lo)}
                  y2={sy(y.hi)}
                  stroke="#6b7280"
                  strokeDasharray="4 4"
                />
                <line
                  x1={sx(x.lo)}
                  x2={sx(x.hi)}
                  y1={sy(avgDef)}
                  y2={sy(avgDef)}
                  stroke="#6b7280"
                  strokeDasharray="4 4"
                />
              </g>
              {teams
                .filter((t) => !active.includes(t.team))
                .map((t) => (
                  <image
                    key={t.team}
                    href={`/api/charts/logo/${t.team}`}
                    x={sx(t.off_epa) - LOGO / 2}
                    y={sy(t.def_epa) - LOGO / 2}
                    width={LOGO}
                    height={LOGO}
                    opacity={tracing ? 0.2 : 1}
                    style={{ cursor: weekly ? "pointer" : "default" }}
                    onClick={() => toggle(t.team)}
                    onMouseMove={(e) => tip.show(e, teamTip(t))}
                    onMouseLeave={tip.hide}
                  />
                ))}
              {paths.map(({ team, points }) => {
                const t = byTeam.get(team);
                const shown = points.filter((p) => p.week <= shownWeek);
                const head = shown.at(-1);
                if (!t || !head) return null;
                const stroke = color(t);
                return (
                  <g key={team}>
                    <polyline
                      points={shown
                        .map((p) => `${sx(p.off)},${sy(p.def)}`)
                        .join(" ")}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={3}
                      strokeOpacity={0.85}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {shown.slice(0, -1).map((p) => (
                      <g
                        key={p.week}
                        onMouseMove={(e) =>
                          tip.show(e, pointTip(team, p, false))
                        }
                        onMouseLeave={tip.hide}
                      >
                        <circle
                          cx={sx(p.off)}
                          cy={sy(p.def)}
                          r={9}
                          fill="#fff"
                          stroke={stroke}
                          strokeWidth={2}
                        />
                        <text
                          x={sx(p.off)}
                          y={sy(p.def)}
                          dy="0.35em"
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill="#1f2937"
                        >
                          {p.week > 18 ? "P" : p.week}
                        </text>
                      </g>
                    ))}
                    <circle
                      cx={sx(head.off)}
                      cy={sy(head.def)}
                      r={PATH_LOGO / 2 + 3}
                      fill="#fff"
                      stroke={stroke}
                      strokeWidth={3}
                    />
                    <image
                      href={`/api/charts/logo/${team}`}
                      x={sx(head.off) - PATH_LOGO / 2}
                      y={sy(head.def) - PATH_LOGO / 2}
                      width={PATH_LOGO}
                      height={PATH_LOGO}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggle(team)}
                      onMouseMove={(e) =>
                        tip.show(e, pointTip(team, head, true))
                      }
                      onMouseLeave={tip.hide}
                    />
                  </g>
                );
              })}
            </>
          )}
        </ChartSvg>
      </div>
      {tip.view}
    </div>
  );
}
