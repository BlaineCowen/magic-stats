/**
 * Floor-to-ceiling bar with the projection marked, on a shared 0..max scale so
 * rows can be compared down a column.
 */
export function RangeBar({
  floor,
  proj,
  ceiling,
  max,
  color = "#1e5a3a",
}: {
  floor: number;
  proj: number;
  ceiling: number;
  max: number;
  color?: string;
}) {
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div
      className="relative h-4 w-full min-w-24"
      role="img"
      aria-label={`Floor ${floor.toFixed(1)}, projection ${proj.toFixed(1)}, ceiling ${ceiling.toFixed(1)}`}
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-35"
        style={{
          left: x(floor),
          width: `calc(${x(ceiling)} - ${x(floor)})`,
          background: color,
        }}
      />
      <div
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
        style={{ left: x(proj), background: color }}
      />
    </div>
  );
}
