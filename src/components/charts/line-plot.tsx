"use client";

import { useState, type MouseEvent } from "react";
import { formatCell, humanize, type ChartRow } from "@/lib/nfl/chart-spec";
import {
  CHAR_W,
  ChartSvg,
  LABEL_PX,
  makeAxis,
  PALETTE,
  PLOT,
  TipRow,
  useChartTooltip,
  W,
  type PlotProps,
} from "./chart-kit";

type Series = { key: string; color: string; points: ChartRow[] };

const INK = "#374151";
const LEGEND_ROW = 18;
// Direct labels at line ends only while they stay readable.
const MAX_END_LABELS = 4;

/** Push positions apart so none sit closer than `gap`; keeps input order. */
function spread(ys: number[], gap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) {
    const prev = order[k - 1]!;
    const cur = order[k]!;
    if (cur.y - prev.y < gap) cur.y = prev.y + gap;
  }
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

/** Legend items flowed into rows that fit between x0 and maxX. */
function legendLayout(keys: string[], x0: number, maxX: number) {
  const items: { key: string; x: number; row: number }[] = [];
  let x = x0;
  let row = 0;
  for (const key of keys) {
    const w = 18 + key.length * CHAR_W + 18;
    if (x + w > maxX && x > x0) {
      x = x0;
      row++;
    }
    items.push({ key, x, row });
    x += w;
  }
  return { items, rows: row + 1 };
}

/** A stat over seasons or weeks, one line per series, with a crosshair tooltip. */
export function LinePlot({
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
  const [hoverX, setHoverX] = useState<number | null>(null);
  const xv = (r: ChartRow) => r[spec.x] as number;
  const yv = (r: ChartRow) => r[spec.y] as number;

  const keys = spec.series
    ? [...new Set(rows.map((r) => String(r[spec.series])))]
    : [""];
  // Team series wear team colors; others take palette slots in order.
  const series: Series[] = keys.map((key, i) => ({
    key,
    color: teamColors[key]?.color ?? PALETTE[i] ?? PALETTE[0]!,
    points: rows
      .filter((r) => !spec.series || String(r[spec.series]) === key)
      .sort((a, b) => xv(a) - xv(b)),
  }));
  const multi = series.length > 1;
  const endLabels = showLabels && multi && series.length <= MAX_END_LABELS;

  const xs = [...new Set(rows.map(xv))].sort((a, b) => a - b);
  const x = makeAxis(xs, humanize(spec.x), {
    integer: xs.every(Number.isInteger),
    pad: 0.04,
  });
  const y = makeAxis(rows.map(yv), humanize(spec.y));

  const labelW = Math.max(...series.map((s) => s.key.length)) * CHAR_W + 20;
  const legend = legendLayout(keys, PLOT.x0, W - 24);
  const plot = {
    y0: multi ? 80 + legend.rows * LEGEND_ROW + 12 : PLOT.y0,
    x1: endLabels ? W - 16 - labelW : PLOT.x1,
  };

  const tooltipAt = (hx: number) => {
    const at = series.flatMap((s) =>
      s.points.filter((r) => xv(r) === hx).map((r) => ({ s, r })),
    );
    if (!multi && at[0]) {
      const r = at[0].r;
      return (
        <>
          {columns.map((c) => (
            <TipRow key={c} label={humanize(c)} value={formatCell(r[c])} />
          ))}
        </>
      );
    }
    return (
      <>
        <div className="mb-1 font-semibold">
          {humanize(spec.x)} {formatCell(hx)}
        </div>
        {at
          .sort((a, b) => yv(b.r) - yv(a.r))
          .map(({ s, r }) => (
            <div
              key={s.key}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1.5 text-gray-500">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.key}
              </span>
              <span className="font-medium tabular-nums">
                {formatCell(yv(r))}
              </span>
            </div>
          ))}
      </>
    );
  };

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
          plot={plot}
        >
          {({ sx, sy, clip, plot: p }) => {
            const nearest = (px: number) =>
              xs.reduce(
                (best, v) =>
                  Math.abs(sx(v) - px) < Math.abs(sx(best) - px) ? v : best,
                xs[0]!,
              );
            const move = (e: MouseEvent<SVGRectElement>) => {
              const svg = e.currentTarget.ownerSVGElement;
              if (!svg) return;
              const rect = svg.getBoundingClientRect();
              const hx = nearest((e.clientX - rect.left) * (W / rect.width));
              setHoverX(hx);
              tip.show(e, tooltipAt(hx));
            };
            const ends = spread(
              series.map((s) => sy(yv(s.points.at(-1)!))),
              LABEL_PX + 2,
            );
            return (
              <>
                {multi &&
                  legend.items.map((it) => {
                    const color =
                      series.find((s) => s.key === it.key)?.color ?? INK;
                    const top = 80 + it.row * LEGEND_ROW;
                    return (
                      <g key={`k${it.key}`}>
                        <rect
                          x={it.x}
                          y={top}
                          width={12}
                          height={12}
                          rx={2}
                          fill={color}
                        />
                        <text
                          x={it.x + 18}
                          y={top + 10}
                          fontSize={12}
                          fill={INK}
                        >
                          {it.key}
                        </text>
                      </g>
                    );
                  })}
                <g clipPath={clip}>
                  {series.map((s) => (
                    <polyline
                      key={s.key}
                      points={s.points
                        .map((r) => `${sx(xv(r))},${sy(yv(r))}`)
                        .join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                  {hoverX != null && (
                    <line
                      x1={sx(hoverX)}
                      x2={sx(hoverX)}
                      y1={p.y0}
                      y2={p.y1}
                      stroke="#9ca3af"
                    />
                  )}
                </g>
                {series.map((s) =>
                  s.points.map((r, j) => (
                    <circle
                      key={`${s.key}-${j}`}
                      cx={sx(xv(r))}
                      cy={sy(yv(r))}
                      r={xv(r) === hoverX ? 5 : 4}
                      fill={s.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  )),
                )}
                {endLabels &&
                  series.map((s, i) => (
                    <text
                      key={`e${s.key}`}
                      x={sx(xv(s.points.at(-1)!)) + 10}
                      y={ends[i]! + 4}
                      fontSize={LABEL_PX}
                      fontWeight={600}
                      fill={INK}
                    >
                      {s.key}
                    </text>
                  ))}
                <rect
                  x={p.x0}
                  y={p.y0}
                  width={p.x1 - p.x0}
                  height={p.y1 - p.y0}
                  fill="transparent"
                  onMouseMove={move}
                  onMouseLeave={() => {
                    setHoverX(null);
                    tip.hide();
                  }}
                />
              </>
            );
          }}
        </ChartSvg>
      </div>
      {tip.view}
    </div>
  );
}
