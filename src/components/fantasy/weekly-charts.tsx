import type { PlayerWeek } from "@/lib/nfl/fantasy";

/**
 * Small server-rendered SVG charts for a player's weeks. Hover text comes from
 * <title> elements so they work without client JavaScript.
 */

const W = 640;
const H = 220;
const M = { l: 40, r: 12, t: 12, b: 28 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;
const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

/** Round tick step (1, 2, 5 x 10^n) giving about four intervals up to max. */
function ticksTo(max: number): { max: number; ticks: number[] } {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
  return { max: top, ticks };
}

function Frame({
  max,
  ticks,
  fmt,
  weeks,
  label,
  children,
}: {
  max: number;
  ticks: number[];
  fmt: (v: number) => string;
  weeks: PlayerWeek[];
  label: string;
  children: React.ReactNode;
}) {
  const band = PW / Math.max(1, weeks.length);
  const y = (v: number) => M.t + PH - (v / max) * PH;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={label}
      fontFamily={FONT}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" />
          <text
            x={M.l - 6}
            y={y(t) + 4}
            fontSize={11}
            textAnchor="end"
            fill="#6b7280"
          >
            {fmt(t)}
          </text>
        </g>
      ))}
      {weeks.map((w, i) => (
        <text
          key={w.week}
          x={M.l + band * (i + 0.5)}
          y={H - 8}
          fontSize={11}
          textAnchor="middle"
          fill="#6b7280"
        >
          {w.week}
        </text>
      ))}
      {children}
    </svg>
  );
}

/** PPR points per week as bars, expected points as a tick across each bar. */
export function PointsChart({
  weeks,
  color,
}: {
  weeks: PlayerWeek[];
  color: string;
}) {
  const { max, ticks } = ticksTo(
    Math.max(10, ...weeks.map((w) => Math.max(w.ppr, w.xfp ?? 0))) * 1.05,
  );
  const band = PW / Math.max(1, weeks.length);
  const bw = Math.min(28, band * 0.6);
  const y = (v: number) => M.t + PH - (v / max) * PH;
  return (
    <Frame
      max={max}
      ticks={ticks}
      fmt={(v) => v.toFixed(0)}
      weeks={weeks}
      label="PPR points and expected points by week"
    >
      {weeks.map((w, i) => {
        const cx = M.l + band * (i + 0.5);
        return (
          <g key={w.week}>
            <title>
              {`Week ${w.week} vs ${w.opponent}: ${w.ppr.toFixed(1)} PPR, ${w.xfp != null ? w.xfp.toFixed(1) : "?"} expected`}
            </title>
            <rect
              x={cx - bw / 2}
              y={y(w.ppr)}
              width={bw}
              height={Math.max(0, M.t + PH - y(w.ppr))}
              rx={3}
              fill={color}
              opacity={0.85}
            />
            {w.xfp != null && (
              <line
                x1={cx - bw / 2 - 4}
                x2={cx + bw / 2 + 4}
                y1={y(w.xfp)}
                y2={y(w.xfp)}
                stroke="#111827"
                strokeWidth={2.5}
              />
            )}
          </g>
        );
      })}
    </Frame>
  );
}

type Series = { key: keyof PlayerWeek; label: string; color: string };

/** Shares (0-1) per week as lines, one per series. */
export function ShareChart({
  weeks,
  series,
}: {
  weeks: PlayerWeek[];
  series: Series[];
}) {
  const band = PW / Math.max(1, weeks.length);
  const y = (v: number) => M.t + PH - v * PH;
  return (
    <Frame
      max={1}
      ticks={[0, 0.25, 0.5, 0.75, 1]}
      fmt={(v) => `${Math.round(v * 100)}%`}
      weeks={weeks}
      label={series.map((s) => s.label).join(", ") + " by week"}
    >
      {series.map((s) => {
        const pts = weeks
          .map((w, i) => ({
            x: M.l + band * (i + 0.5),
            v: w[s.key] as number | null,
            w,
          }))
          .filter((p) => p.v != null);
        return (
          <g key={String(s.key)}>
            <polyline
              points={pts.map((p) => `${p.x},${y(p.v!)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {pts.map((p) => (
              <circle
                key={p.w.week}
                cx={p.x}
                cy={y(p.v!)}
                r={4}
                fill={s.color}
                stroke="#fff"
                strokeWidth={1.5}
              >
                <title>{`Week ${p.w.week}: ${s.label} ${Math.round(p.v! * 100)}%`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </Frame>
  );
}

/** One tracking stat per week as bars around zero or from zero. */
export function StatBars({
  weeks,
  value,
  label,
  fmt,
  color,
}: {
  weeks: PlayerWeek[];
  value: (w: PlayerWeek) => number | null;
  label: string;
  fmt: (v: number) => string;
  color: string;
}) {
  const vals = weeks.map(value).filter((v): v is number => v != null);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0.5, ...vals);
  const span = niceMax(hi - lo);
  const max = lo < 0 ? niceMax(hi) : span;
  const min = lo < 0 ? -niceMax(-lo) : 0;
  const band = PW / Math.max(1, weeks.length);
  const bw = Math.min(28, band * 0.6);
  const y = (v: number) => M.t + PH - ((v - min) / (max - min)) * PH;
  const ticks = [min, 0, max].filter((t, i, a) => a.indexOf(t) === i);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`${label} by week`}
      fontFamily={FONT}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={M.l}
            x2={W - M.r}
            y1={y(t)}
            y2={y(t)}
            stroke={t === 0 ? "#9ca3af" : "#e5e7eb"}
          />
          <text
            x={M.l - 6}
            y={y(t) + 4}
            fontSize={11}
            textAnchor="end"
            fill="#6b7280"
          >
            {fmt(t)}
          </text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const cx = M.l + band * (i + 0.5);
        const v = value(w);
        return (
          <g key={w.week}>
            <text
              x={cx}
              y={H - 8}
              fontSize={11}
              textAnchor="middle"
              fill="#6b7280"
            >
              {w.week}
            </text>
            {v != null && (
              <rect
                x={cx - bw / 2}
                y={Math.min(y(v), y(0))}
                width={bw}
                height={Math.abs(y(v) - y(0))}
                rx={3}
                fill={color}
                opacity={0.85}
              >
                <title>{`Week ${w.week}: ${label} ${fmt(v)}`}</title>
              </rect>
            )}
          </g>
        );
      })}
    </svg>
  );
}
