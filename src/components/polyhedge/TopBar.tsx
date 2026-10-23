"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import { cn } from "@/components/polyhedge/cn";

// Status line from /api/overview: how many live systems are healthy. (The old /api/status line tracked lead-lag
// and RT middles, both retired.)
interface OverviewLite {
  systems: { name: string; state: "ok" | "warn" | "off" }[];
}

export function TopBar() {
  const q = useQuery<OverviewLite>({
    queryKey: qk.overview,
    queryFn: () => api.get<OverviewLite>("/api/overview"),
    refetchInterval: 30_000,
  });
  const sys = q.data?.systems ?? [];
  const on = sys.filter((s) => s.state !== "off");
  const bad = on.filter((s) => s.state === "warn");
  const alive = !q.isError && q.data != null && bad.length === 0;
  const detail = q.isError
    ? `API unreachable — ${q.error instanceof ApiError ? q.error.message : (q.error).message}`
    : q.data
      ? bad.length
        ? `${bad.length} of ${on.length} systems need a look: ${bad.map((s) => s.name).join(", ")}`
        : `All ${on.length} systems running`
      : "connecting…";
  return (
    <header className="ph-header">
      <div
        className={cn("ph-dot", alive ? undefined : "ph-status-dead")}
        style={{ background: alive ? "#48bb78" : "#fc8181" }}
      />
      <h1 className="ph-h1">Poly-Hedge</h1>
      <span
        className="ph-muted-2"
        style={{
          fontSize: 12,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {detail}
      </span>
      <span
        className="ph-muted"
        style={{ fontSize: 12, whiteSpace: "nowrap" }}
      >
        {q.dataUpdatedAt
          ? new Date(q.dataUpdatedAt).toLocaleTimeString()
          : ""}
      </span>
    </header>
  );
}
