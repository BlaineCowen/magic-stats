"use client";

import { useId, useRef, useState, type ReactNode, type Ref } from "react";

/**
 * Small SVG chart toolkit. Everything inside the <svg> uses presentation
 * attributes (no Tailwind classes) so the PNG export looks like the page.
 */

export const W = 1000;
export const H = 680;
export const PLOT = { x0: 84, x1: 976, y0: 92, y1: 606 };
export const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type Axis = {
  lo: number;
  hi: number;
  step: number;
  ticks: number[];
  decimals: number;
  label: string;
  /** Larger values drawn lower (for defense, where negative EPA is good). */
  invert?: boolean;
};

function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
}

function decimalsFor(step: number): number {
  for (let d = 0; d < 6; d++) {
    const v = step * 10 ** d;
    if (Math.abs(v - Math.round(v)) < 1e-6) return d;
  }
  return 6;
}

export function makeAxis(
  values: number[],
  label: string,
  opts: { invert?: boolean; minDecimals?: number; pad?: number } = {},
): Axis {
  let min = values.length ? Math.min(...values) : -0.1;
  let max = values.length ? Math.max(...values) : 0.1;
  if (max - min < 1e-9) {
    min -= 0.1;
    max += 0.1;
  }
  const pad = (max - min) * (opts.pad ?? 0.08);
  const lo = min - pad;
  const hi = max + pad;
  const step = niceStep((hi - lo) / 8);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  return {
    lo,
    hi,
    step,
    ticks,
    decimals: Math.max(opts.minDecimals ?? 0, decimalsFor(step)),
    label,
    invert: opts.invert,
  };
}

export function scales(x: Axis, y: Axis) {
  const sx = (v: number) =>
    PLOT.x0 + ((v - x.lo) / (x.hi - x.lo)) * (PLOT.x1 - PLOT.x0);
  const sy = (v: number) => {
    const t = (v - y.lo) / (y.hi - y.lo);
    return y.invert
      ? PLOT.y0 + t * (PLOT.y1 - PLOT.y0)
      : PLOT.y1 - t * (PLOT.y1 - PLOT.y0);
  };
  return { sx, sy };
}

export const fmt = (v: number, decimals: number) =>
  (Math.abs(v) < 1e-9 ? 0 : v).toFixed(decimals);

export const signed = (v: number, decimals = 3) =>
  `${v > 0 ? "+" : ""}${fmt(v, decimals)}`;

export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Play-weighted mean, used for the league-average reference lines. */
export function weightedMean<T>(
  items: T[],
  value: (t: T) => number,
  weight: (t: T) => number,
): number {
  let sum = 0;
  let w = 0;
  for (const it of items) {
    sum += value(it) * weight(it);
    w += weight(it);
  }
  return w ? sum / w : 0;
}

type Scales = ReturnType<typeof scales>;

/** Title, subtitle, plot background, grid, ticks and axis labels. */
export function ChartSvg({
  svgRef,
  title,
  subtitle,
  x,
  y,
  footnote,
  children,
}: {
  svgRef: Ref<SVGSVGElement>;
  title: string;
  subtitle: string;
  x: Axis;
  y: Axis;
  footnote: string;
  children: (s: Scales & { clip: string }) => ReactNode;
}) {
  // useId output contains characters that break url(#...) references.
  const clipId = `plot-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const s = scales(x, y);
  const { x0, x1, y0, y1 } = PLOT;
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      fontFamily={FONT}
      role="img"
      aria-label={`${title}: ${subtitle}`}
      className="block h-auto w-full min-w-[640px]"
    >
      <rect width={W} height={H} fill="#ffffff" />
      <text x={24} y={42} fontSize={28} fontWeight={700} fill="#111827">
        {title}
      </text>
      <text x={24} y={68} fontSize={14} fill="#6b7280">
        {subtitle}
      </text>

      <defs>
        <clipPath id={clipId}>
          <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} />
        </clipPath>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#eef0f3" />

      {x.ticks.map((t) => (
        <g key={`x${t}`}>
          <line x1={s.sx(t)} x2={s.sx(t)} y1={y0} y2={y1} stroke="#ffffff" />
          <text
            x={s.sx(t)}
            y={y1 + 20}
            fontSize={12}
            textAnchor="middle"
            fill="#6b7280"
          >
            {fmt(t, x.decimals)}
          </text>
        </g>
      ))}
      {y.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={x0} x2={x1} y1={s.sy(t)} y2={s.sy(t)} stroke="#ffffff" />
          <text
            x={x0 - 10}
            y={s.sy(t) + 4}
            fontSize={12}
            textAnchor="end"
            fill="#6b7280"
          >
            {fmt(t, y.decimals)}
          </text>
        </g>
      ))}

      <text
        x={(x0 + x1) / 2}
        y={y1 + 46}
        fontSize={14}
        fontWeight={600}
        textAnchor="middle"
        fill="#374151"
      >
        {x.label}
      </text>
      <text
        transform={`translate(24 ${(y0 + y1) / 2}) rotate(-90)`}
        fontSize={14}
        fontWeight={600}
        textAnchor="middle"
        fill="#374151"
      >
        {y.label}
      </text>
      <text x={W - 24} y={H - 12} fontSize={11} textAnchor="end" fill="#9ca3af">
        {footnote}
      </text>

      {children({ ...s, clip: `url(#${clipId})` })}
    </svg>
  );
}

export type TooltipState = { x: number; y: number; content: ReactNode } | null;

/** Hover card positioned over the chart, in wrapper-relative pixels. */
export function useChartTooltip() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TooltipState>(null);
  const show = (e: React.MouseEvent, content: ReactNode) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, content });
  };
  const hide = () => setTip(null);
  const width = wrapRef.current?.clientWidth ?? 0;
  const view = tip && (
    <div
      className="pointer-events-none absolute z-10 w-56 rounded-md border border-gray-200 bg-white/95 p-2.5 text-xs text-gray-800 shadow-lg"
      style={{
        top: tip.y + 14,
        left: tip.x + 240 > width ? tip.x - 236 : tip.x + 14,
      }}
    >
      {tip.content}
    </div>
  );
  return { wrapRef, show, hide, view };
}

export function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

async function toDataUrl(href: string): Promise<string> {
  const blob = await (await fetch(href)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Render the chart <svg> to a 2x PNG. Images are inlined as data URLs first,
 * since an SVG drawn through <img> can't load external resources.
 */
export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("class");
  clone.setAttribute("width", String(W));
  clone.setAttribute("height", String(H));

  const images = Array.from(clone.querySelectorAll("image"));
  const hrefs = [...new Set(images.map((i) => i.getAttribute("href") ?? ""))];
  const inlined = new Map<string, string>();
  await Promise.all(
    hrefs
      .filter((h) => h && !h.startsWith("data:"))
      .map(async (h) => inlined.set(h, await toDataUrl(h))),
  );
  for (const img of images) {
    const data = inlined.get(img.getAttribute("href") ?? "");
    if (data) img.setAttribute("href", data);
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(
    new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render chart"));
      image.src = url;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
        "image/png",
      ),
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(png);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
