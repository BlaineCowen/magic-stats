"use client";

import type { MouseEvent } from "react";
import {
  formatCell,
  humanize,
  labelsAreTeams,
  teamCode,
} from "@/lib/nfl/chart-spec";
import {
  CHAR_W,
  ChartSvg,
  makeAxis,
  TipRow,
  useChartTooltip,
  type Axis,
  type PlotProps,
} from "./chart-kit";

const LOGO = 20;
const BAR_COLOR = "#2a78d6";

/** Horizontal bar whose far (data) end is rounded and whose base is square. */
function barPath(from: number, to: number, top: number, h: number): string {
  const r = Math.min(4, Math.abs(to - from), h / 2);
  const d = to >= from ? 1 : -1;
  const bottom = top + h;
  return [
    `M${from},${top}`,
    `H${to - d * r}`,
    `Q${to},${top} ${to},${top + r}`,
    `V${bottom - r}`,
    `Q${to},${bottom} ${to - d * r},${bottom}`,
    `H${from}`,
    "Z",
  ].join(" ");
}

/** A ranking: one horizontal bar per row, names on the y axis. */
export function BarPlot({
  rows,
  columns,
  spec,
  teamColors,
  title,
  subtitle,
  footnote,
  svgRef,
}: PlotProps) {
  const tip = useChartTooltip();
  const value = (i: number) => rows[i]![spec.y] as number;
  const names = rows.map((r) => formatCell(r[spec.label]));
  const logos = labelsAreTeams(rows, spec, teamColors);
  const x = makeAxis(
    rows.map((_, i) => value(i)),
    humanize(spec.y),
    { includeZero: true },
  );
  const band: Axis = {
    lo: 0,
    hi: rows.length,
    step: 1,
    ticks: [],
    decimals: 0,
    label: "",
    invert: true,
  };
  const longest = Math.max(...names.map((n) => n.length));
  const left = Math.min(
    320,
    Math.max(84, 24 + longest * CHAR_W + (logos ? LOGO + 8 : 0) + 12),
  );

  return (
    <div ref={tip.wrapRef} className="relative">
      <div className="overflow-x-auto">
        <ChartSvg
          svgRef={svgRef}
          title={title}
          subtitle={subtitle}
          x={x}
          y={band}
          footnote={footnote}
          plot={{ x0: left }}
          yCategories={names}
        >
          {({ sx, sy, plot: p }) => {
            // 72% of each band, leaving a gap between bars.
            const h = Math.max(2, ((p.y1 - p.y0) / rows.length) * 0.72);
            const zero = sx(0);
            return (
              <>
                {rows.map((r, i) => {
                  const team = teamCode(r, spec, teamColors);
                  const show = (e: MouseEvent) =>
                    tip.show(
                      e,
                      <>
                        <div className="mb-1 font-semibold">{names[i]}</div>
                        {columns
                          .filter((c) => c !== spec.label)
                          .map((c) => (
                            <TipRow
                              key={c}
                              label={humanize(c)}
                              value={formatCell(r[c])}
                            />
                          ))}
                      </>,
                    );
                  return (
                    <g key={i} onMouseMove={show} onMouseLeave={tip.hide}>
                      {/* Whole band is the hover target, so thin bars are easy to hit. */}
                      <rect
                        x={p.x0}
                        y={sy(i)}
                        width={p.x1 - p.x0}
                        height={sy(i + 1) - sy(i)}
                        fill="transparent"
                      />
                      <path
                        d={barPath(zero, sx(value(i)), sy(i + 0.5) - h / 2, h)}
                        fill={
                          (team ? teamColors[team]?.color : null) ?? BAR_COLOR
                        }
                      />
                      {logos && (
                        <image
                          href={`/api/charts/logo/${String(r[spec.label])}`}
                          x={p.x0 - 16 - names[i]!.length * CHAR_W - LOGO}
                          y={sy(i + 0.5) - LOGO / 2}
                          width={LOGO}
                          height={LOGO}
                        />
                      )}
                    </g>
                  );
                })}
                {x.lo < 0 && x.hi > 0 && (
                  <line
                    x1={zero}
                    x2={zero}
                    y1={p.y0}
                    y2={p.y1}
                    stroke="#6b7280"
                  />
                )}
              </>
            );
          }}
        </ChartSvg>
      </div>
      {tip.view}
    </div>
  );
}
