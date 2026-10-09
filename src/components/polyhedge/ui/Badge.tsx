import type { HTMLAttributes } from "react";
import { cn } from "@/components/polyhedge/cn";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ph-badge", className)} {...props} />;
}

const SOURCE_LABEL: Record<string, string> = {
  lead_lag: "SPORTS",
  manual_arbs: "MANUAL",
  temp_arbs: "WEATHER",
  rt_middles: "RT",
};
const SOURCE_CLASS: Record<string, string> = {
  lead_lag: "ph-badge-src-sports",
  manual_arbs: "ph-badge-src-manual",
  temp_arbs: "ph-badge-src-weather",
  rt_middles: "ph-badge-src-rt",
};

export function SourceBadge({ source }: { source: string }) {
  return (
    <span className={cn("ph-badge", SOURCE_CLASS[source] ?? "")}>
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}

export function SideBadge({ side }: { side?: string | null }) {
  if (!side) return null;
  return (
    <span
      className={cn("ph-badge", side === "YES" ? "ph-badge-yes" : "ph-badge-no")}
    >
      {side}
    </span>
  );
}
