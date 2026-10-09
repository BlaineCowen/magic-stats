"use client";

import type { Ref } from "react";
import { describeFilters, type ChartData } from "@/lib/nfl/chart-types";
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

const ordinal = (n: number) =>
  `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;

/**
 * Offense EPA/play (x) against defense EPA/play (y, inverted so good defenses
 * sit at the top). Diagonals are lines of equal net EPA/play, so teams higher
 * up and further right are better overall.
 */
export function TeamTiersChart({
  data,
  svgRef,
}: {
  data: ChartData;
  svgRef: Ref<SVGSVGElement>;
}) {
  const teams = data.teams ?? [];
  const tip = useChartTooltip();
  const x = makeAxis(
    teams.map((t) => t.off_epa),
    "Offense EPA/play",
    { minDecimals: 2 },
  );
  const y = makeAxis(
    teams.map((t) => t.def_epa),
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

  return (
    <div ref={tip.wrapRef} className="relative">
      <div className="overflow-x-auto">
        <ChartSvg
          svgRef={svgRef}
          title="Team Tiers"
          subtitle={describeFilters(data.filters)}
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
              {teams.map((t) => (
                <image
                  key={t.team}
                  href={`/api/charts/logo/${t.team}`}
                  x={sx(t.off_epa) - LOGO / 2}
                  y={sy(t.def_epa) - LOGO / 2}
                  width={LOGO}
                  height={LOGO}
                  style={{ cursor: "default" }}
                  onMouseMove={(e) =>
                    tip.show(
                      e,
                      <>
                        <div className="mb-1 font-semibold">
                          {t.team_name ?? t.team}
                        </div>
                        <TipRow
                          label={`Offense (${ordinal(offRank.get(t.team) ?? 0)})`}
                          value={signed(t.off_epa)}
                        />
                        <TipRow
                          label={`Defense (${ordinal(defRank.get(t.team) ?? 0)})`}
                          value={signed(t.def_epa)}
                        />
                        <TipRow
                          label="Net EPA/play"
                          value={signed(t.off_epa - t.def_epa)}
                        />
                        <TipRow
                          label="Success rate O / D"
                          value={`${pct(t.off_success)} / ${pct(t.def_success)}`}
                        />
                        <TipRow
                          label="Plays O / D"
                          value={`${t.off_plays} / ${t.def_plays}`}
                        />
                        <TipRow label="Games" value={String(t.games)} />
                      </>,
                    )
                  }
                  onMouseLeave={tip.hide}
                />
              ))}
            </>
          )}
        </ChartSvg>
      </div>
      {tip.view}
    </div>
  );
}
