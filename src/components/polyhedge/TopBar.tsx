"use client";

import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import type { StatusResponse } from "@/lib/polyhedge/types";
import { ago } from "@/lib/polyhedge/format";
import { cn } from "@/components/polyhedge/cn";

export function TopBar() {
  const q = useQuery<StatusResponse>({
    queryKey: qk.status,
    queryFn: () => api.get<StatusResponse>("/api/status"),
    refetchInterval: 5_000,
  });
  const data = q.data;
  const alive = data?.alive === true;
  const ll = data?.systems?.lead_lag ?? {};
  const rt = data?.systems?.rt_middles ?? {};
  const llStr = ll.alive
    ? "lead-lag ✓"
    : ll.last_ago_s != null
      ? `lead-lag idle ${ago(ll.last_ago_s)}`
      : "lead-lag —";
  const rtStr = rt.alive
    ? "RT ✓"
    : rt.last_ago_s != null
      ? `RT idle ${ago(rt.last_ago_s)}`
      : "RT —";
  const detail = q.isError
    ? `API unreachable — ${q.error instanceof ApiError ? q.error.message : (q.error as Error).message}`
    : alive
      ? `Live · ${llStr} · ${rtStr} · ${data?.outcomes_count ?? 0} markets · ${data?.db_size_mb ?? 0}MB`
      : data
        ? `DEAD · ${llStr} · ${rtStr}`
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
          fontSize: 11,
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
        style={{ fontSize: 11, whiteSpace: "nowrap" }}
      >
        {q.dataUpdatedAt
          ? new Date(q.dataUpdatedAt).toLocaleTimeString()
          : ""}
      </span>
    </header>
  );
}
