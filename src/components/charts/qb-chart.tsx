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
  makeAxis,
  pct,
  PLOT,
  signed,
  TipRow,
  useChartTooltip,
  weightedMean,
} from "./chart-kit";

const LABEL_PX = 12;
// Rough glyph width for the label font; only used to avoid overlaps.
const CHAR_W = 6.8;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Label = { x: number; y: number; anchor: "start" | "middle" | "end" };

const overlaps = (a: Box, b: Box) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function labelBox(l: Label, text: string): Box {
  const w = text.length * CHAR_W;
  const x0 =
    l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
  return { x0, y0: l.y - LABEL_PX, x1: x0 + w, y1: l.y + 2 };
}

/** Greedy placement: above, below, right, left; first spot that's free wins. */
function placeLabels(
  points: { key: string; name: string; cx: number; cy: number; r: number }[],
): Map<string, Label> {
  const taken: Box[] = points.map((p) => ({
    x0: p.cx - p.r,
    y0: p.cy - p.r,
    x1: p.cx + p.r,
    y1: p.cy + p.r,
  }));
  const placed = new Map<string, Label>();
  for (const p of points) {
    const options: Label[] = [
      { x: p.cx, y: p.cy - p.r - 4, anchor: "middle" },
      { x: p.cx, y: p.cy + p.r + LABEL_PX + 2, anchor: "middle" },
      { x: p.cx + p.r + 4, y: p.cy + 4, anchor: "start" },
      { x: p.cx - p.r - 4, y: p.cy + 4, anchor: "end" },
    ];
    // Every option sits outside the point's own bubble, so it can be checked
    // against all taken boxes.
    const fits = (l: Label) => {
      const b = labelBox(l, p.name);
      return (
        b.x0 >= PLOT.x0 &&
        b.x1 <= PLOT.x1 + 20 &&
        b.y0 >= PLOT.y0 - 16 &&
        !taken.some((t) => overlaps(b, t))
      );
    };
    const pick = options.find(fits) ?? options[0]!;
    placed.set(p.key, pick);
    taken.push(labelBox(pick, p.name));
  }
  return placed;
}

function regression(qbs: QbPoint[]) {
  const n = qbs.length;
  if (n < 3) return null;
  const mx = qbs.reduce((s, q) => s + q.cpoe, 0) / n;
  const my = qbs.reduce((s, q) => s + q.epa, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const q of qbs) {
    sxy += (q.cpoe - mx) * (q.epa - my);
    sxx += (q.cpoe - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return (v: number) => my + slope * (v - mx);
}

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
  const fit = regression(qbs);
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
