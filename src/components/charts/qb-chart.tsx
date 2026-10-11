"use client";

import type { Ref } from "react";
import {
  describeFilters,
  type ChartData,
  type QbPoint,
} from "@/lib/nfl/chart-types";
import {
  ChartSvg,
  fmt,
  LABEL_PX,
  makeAxis,
  pct,
  placeLabels,
  regression,
  signed,
  TipRow,
  useChartTooltip,
  weightedMean,
} from "./chart-kit";

/** CPOE (x) against EPA/play (y), bubbles sized by plays, like rbsdm.com. */
export function QbChart({
  data,
  svgRef,
}: {
  data: ChartData;
  svgRef: Ref<SVGSVGElement>;
}) {
  const qbs = data.qbs ?? [];
  const tip = useChartTooltip();
  const x = makeAxis(
    qbs.map((q) => q.cpoe),
    "Completion % over expected (CPOE)",
  );
  const y = makeAxis(
    qbs.map((q) => q.epa),
    "EPA/play",
    { minDecimals: 2 },
  );
  const avgCpoe = weightedMean(
    qbs,
    (q) => q.cpoe,
    (q) => q.plays,
  );
  const avgEpa = weightedMean(
    qbs,
    (q) => q.epa,
    (q) => q.plays,
  );
  const fit = regression(qbs.map((q) => ({ x: q.cpoe, y: q.epa })));
  const maxPlays = Math.max(1, ...qbs.map((q) => q.plays));
  const radius = (q: QbPoint) => 6 + 10 * Math.sqrt(q.plays / maxPlays);
  // Big bubbles first so small ones stay visible on top.
  const drawOrder = [...qbs].sort((a, b) => b.plays - a.plays);

  return (
    <div ref={tip.wrapRef} className="relative">
      <div className="overflow-x-auto">
        <ChartSvg
          svgRef={svgRef}
          title="Quarterbacks"
          subtitle={describeFilters(data.filters, data.minPlays)}
          x={x}
          y={y}
          footnote="Data: nflverse · EPA/play on dropbacks and designed runs · bubble size = plays"
        >
          {({ sx, sy, clip }) => {
            const labels = placeLabels(
              // Label the most extreme QBs first so they get the best spots.
              [...qbs]
                .sort(
                  (a, b) => Math.abs(b.epa - avgEpa) - Math.abs(a.epa - avgEpa),
                )
                .map((q) => ({
                  key: q.id,
                  name: q.name,
                  cx: sx(q.cpoe),
                  cy: sy(q.epa),
                  r: radius(q),
                })),
            );
            return (
              <>
                <g clipPath={clip}>
                  <line
                    x1={sx(avgCpoe)}
                    x2={sx(avgCpoe)}
                    y1={sy(y.lo)}
                    y2={sy(y.hi)}
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={sx(x.lo)}
                    x2={sx(x.hi)}
                    y1={sy(avgEpa)}
                    y2={sy(avgEpa)}
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                  />
                  {fit && (
                    <line
                      x1={sx(x.lo)}
                      y1={sy(fit(x.lo))}
                      x2={sx(x.hi)}
                      y2={sy(fit(x.hi))}
                      stroke="#4b5563"
                      strokeWidth={1.5}
                      strokeOpacity={0.8}
                    />
                  )}
                </g>
                {drawOrder.map((q) => (
                  <circle
                    key={q.id}
                    cx={sx(q.cpoe)}
                    cy={sy(q.epa)}
                    r={radius(q)}
                    fill={q.team_color ?? "#6b7280"}
                    fillOpacity={0.9}
                    stroke={q.team_color2 ?? "#ffffff"}
                    strokeWidth={2}
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <div className="mb-1 font-semibold">
                            {q.full_name ?? q.name}{" "}
                            <span className="font-normal text-gray-500">
                              {q.team}
                            </span>
                          </div>
                          <TipRow label="EPA/play" value={signed(q.epa)} />
                          <TipRow
                            label="CPOE"
                            value={`${q.cpoe > 0 ? "+" : ""}${fmt(q.cpoe, 1)}`}
                          />
                          <TipRow label="Success rate" value={pct(q.success)} />
                          <TipRow label="Plays" value={String(q.plays)} />
                          <TipRow label="Games" value={String(q.games)} />
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                  />
                ))}
                {qbs.map((q) => {
                  const l = labels.get(q.id);
                  if (!l) return null;
                  return (
                    <text
                      key={q.id}
                      x={l.x}
                      y={l.y}
                      textAnchor={l.anchor}
                      fontSize={LABEL_PX}
                      fontWeight={600}
                      fill={q.team_color ?? "#374151"}
                      stroke="#ffffff"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {q.name}
                    </text>
                  );
                })}
              </>
            );
          }}
        </ChartSvg>
      </div>
      {tip.view}
    </div>
  );
}
