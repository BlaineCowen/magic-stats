"use client";

import type { Ref } from "react";
import {
  describeFilters,
  type ChartData,
  type LuckPoint,
} from "@/lib/nfl/chart-types";
import {
  ChartSvg,
  fmt,
  LABEL_PX,
  makeAxis,
  placeLabels,
  TipRow,
  useChartTooltip,
} from "./chart-kit";

const plus = (v: number, d = 1) => `${v > 0 ? "+" : ""}${fmt(v, d)}`;

/**
 * Expected PPR points per game (x) against actual (y). The diagonal is "scored
 * exactly what the usage was worth": above it a player is running hot, below
 * it he has been unlucky and is due to bounce back.
 */
export function LuckChart({
  data,
  svgRef,
}: {
  data: ChartData;
  svgRef: Ref<SVGSVGElement>;
}) {
  const players = data.luck ?? [];
  const tip = useChartTooltip();
  const all = players.flatMap((p) => [p.ppg, p.xppg]);
  // Same range on both axes so the diagonal really is 45 degrees of "fair".
  const x = makeAxis(all, "Expected PPR points per game");
  const y = makeAxis(all, "Actual PPR points per game");
  const diff = (p: LuckPoint) => p.ppg - p.xppg;
  // Last names keep 70 labels from colliding ("Smith-Njigba", "Cook").
  const short = (p: LuckPoint) =>
    p.name
      .replace(/ (Jr\.|Sr\.|II|III|IV)$/, "")
      .split(" ")
      .slice(-1)[0] ?? p.name;
  const maxOpp = Math.max(1, ...players.map((p) => p.opportunities / p.games));
  const radius = (p: LuckPoint) =>
    5 + 8 * Math.sqrt(p.opportunities / p.games / maxOpp);

  return (
    <div ref={tip.wrapRef} className="relative">
      <div>
        <ChartSvg
          svgRef={svgRef}
          className="block h-auto w-full"
          title="Fantasy luck"
          subtitle={describeFilters(data.filters, null, "luck")}
          x={x}
          y={y}
          footnote="Data: ffopportunity expected points, nflverse · above the line = scoring more than the usage is worth"
        >
          {({ sx, sy, clip }) => {
            const lo = Math.max(x.lo, y.lo);
            const hi = Math.min(x.hi, y.hi);
            const labels = placeLabels(
              // The luckiest and unluckiest get the best label spots.
              [...players]
                .sort((a, b) => Math.abs(diff(b)) - Math.abs(diff(a)))
                .map((p) => ({
                  key: p.id,
                  name: short(p),
                  cx: sx(p.xppg),
                  cy: sy(p.ppg),
                  r: radius(p),
                })),
              undefined,
              { dropCrowded: true },
            );
            return (
              <>
                <g clipPath={clip}>
                  <line
                    x1={sx(lo)}
                    y1={sy(lo)}
                    x2={sx(hi)}
                    y2={sy(hi)}
                    stroke="#4b5563"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                  <text
                    x={sx(x.lo) + 12}
                    y={sy(y.hi) + 22}
                    fontSize={13}
                    fontWeight={600}
                    fill="#15803d"
                  >
                    Running hot
                  </text>
                  <text
                    x={sx(x.hi) - 12}
                    y={sy(y.lo) - 14}
                    fontSize={13}
                    fontWeight={600}
                    textAnchor="end"
                    fill="#b91c1c"
                  >
                    Due to bounce back
                  </text>
                </g>
                {players.map((p) => (
                  <circle
                    key={p.id}
                    cx={sx(p.xppg)}
                    cy={sy(p.ppg)}
                    r={radius(p)}
                    fill={p.team_color ?? "#6b7280"}
                    fillOpacity={0.9}
                    stroke={p.team_color2 ?? "#ffffff"}
                    strokeWidth={2}
                    onMouseMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <div className="mb-1 font-semibold">
                            {p.name}{" "}
                            <span className="font-normal text-gray-500">
                              {p.position}, {p.team}
                            </span>
                          </div>
                          <TipRow label="PPR per game" value={fmt(p.ppg, 1)} />
                          <TipRow label="Expected" value={fmt(p.xppg, 1)} />
                          <TipRow
                            label="Over expected"
                            value={`${plus(diff(p))}/game, ${plus(p.points - p.expected)} total`}
                          />
                          <TipRow
                            label="Targets + carries"
                            value={`${fmt(p.opportunities / p.games, 1)}/game`}
                          />
                          <TipRow label="Games" value={String(p.games)} />
                        </>,
                      )
                    }
                    onMouseLeave={tip.hide}
                  />
                ))}
                {players.map((p) => {
                  const l = labels.get(p.id);
                  if (!l) return null;
                  return (
                    <text
                      key={p.id}
                      x={l.x}
                      y={l.y}
                      textAnchor={l.anchor}
                      fontSize={LABEL_PX}
                      fontWeight={600}
                      fill={p.team_color ?? "#374151"}
                      stroke="#ffffff"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {short(p)}
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
