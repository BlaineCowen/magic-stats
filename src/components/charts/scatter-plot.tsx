"use client";

import type { MouseEvent } from "react";
import {
  formatCell,
  humanize,
  labelsAreTeams,
  shortLabel,
  teamCode,
  type ChartRow,
} from "@/lib/nfl/chart-spec";
import {
  ChartSvg,
  LABEL_PX,
  makeAxis,
  placeLabels,
  regression,
  TipRow,
  useChartTooltip,
  type Label,
  type PlotProps,
} from "./chart-kit";

const R = 6;
const LOGO = 36;
const GRAY = "#6b7280";
const INK = "#374151";

/** Stat vs stat, one mark per row: team logos, or dots in team colors. */
export function ScatterPlot({
  rows,
  columns,
  spec,
  teamColors,
  title,
  subtitle,
  footnote,
  showLabels,
  svgRef,
}: PlotProps) {
  const tip = useChartTooltip();
  const xv = (r: ChartRow) => r[spec.x] as number;
  const yv = (r: ChartRow) => r[spec.y] as number;
  const x = makeAxis(rows.map(xv), humanize(spec.x));
  const y = makeAxis(rows.map(yv), humanize(spec.y));
  const mean = (f: (r: ChartRow) => number) =>
    rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const mx = mean(xv);
  const my = mean(yv);
  const fit = regression(rows.map((r) => ({ x: xv(r), y: yv(r) })));
  const logos = labelsAreTeams(rows, spec, teamColors);
  const name = (r: ChartRow) => shortLabel(spec.label, r[spec.label]);

  const tooltip = (r: ChartRow) => (
    <>
      {spec.label && (
        <div className="mb-1 font-semibold">{formatCell(r[spec.label])}</div>
      )}
      {columns
        .filter((c) => c !== spec.label)
        .map((c) => (
          <TipRow key={c} label={humanize(c)} value={formatCell(r[c])} />
        ))}
    </>
  );

  return (
    <div ref={tip.wrapRef} className="relative">
      <div className="overflow-x-auto">
        <ChartSvg
          svgRef={svgRef}
          title={title}
          subtitle={subtitle}
          x={x}
          y={y}
          footnote={footnote}
        >
          {({ sx, sy, clip, plot }) => {
            const labels: Map<string, Label> =
              showLabels && !logos && spec.label
                ? placeLabels(
                    // Most unusual points first so they get the best spots.
                    rows
                      .map((r, i) => ({
                        key: String(i),
                        name: name(r),
                        cx: sx(xv(r)),
                        cy: sy(yv(r)),
                        r: R,
                        d:
                          Math.abs(xv(r) - mx) / (x.hi - x.lo) +
                          Math.abs(yv(r) - my) / (y.hi - y.lo),
                      }))
                      .sort((a, b) => b.d - a.d),
                    plot,
                    { dropCrowded: true },
                  )
                : new Map<string, Label>();
            return (
              <>
                <g clipPath={clip}>
                  <line
                    x1={sx(mx)}
                    x2={sx(mx)}
                    y1={sy(y.lo)}
                    y2={sy(y.hi)}
                    stroke={GRAY}
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={sx(x.lo)}
                    x2={sx(x.hi)}
                    y1={sy(my)}
                    y2={sy(my)}
                    stroke={GRAY}
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
                {rows.map((r, i) => {
                  const show = (e: MouseEvent) => tip.show(e, tooltip(r));
                  if (logos) {
                    return (
                      <image
                        key={i}
                        href={`/api/charts/logo/${String(r[spec.label])}`}
                        x={sx(xv(r)) - LOGO / 2}
                        y={sy(yv(r)) - LOGO / 2}
                        width={LOGO}
                        height={LOGO}
                        onMouseMove={show}
                        onMouseLeave={tip.hide}
                      />
                    );
                  }
                  const team = teamCode(r, spec, teamColors);
                  return (
                    <circle
                      key={i}
                      cx={sx(xv(r))}
                      cy={sy(yv(r))}
                      r={R}
                      fill={(team ? teamColors[team]?.color : null) ?? GRAY}
                      stroke="#ffffff"
                      strokeWidth={2}
                      onMouseMove={show}
                      onMouseLeave={tip.hide}
                    />
                  );
                })}
                {rows.map((r, i) => {
                  const l = labels.get(String(i));
                  return l ? (
                    <text
                      key={`l${i}`}
                      x={l.x}
                      y={l.y}
                      textAnchor={l.anchor}
                      fontSize={LABEL_PX}
                      fontWeight={600}
                      fill={INK}
                      stroke="#ffffff"
                      strokeWidth={3}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {name(r)}
                    </text>
                  ) : null;
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
