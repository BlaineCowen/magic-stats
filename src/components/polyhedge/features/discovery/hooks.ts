import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import type {
  ArbApproveBody,
  ArbApproveEventBody,
  ArbApproveEventResponse,
  ArbApproveResponse,
  ArbCandidateDetail,
  ArbCandidatesResponse,
  ArbFilters,
  ArbRejectBody,
  ArbSummary,
} from "@/lib/polyhedge/types";

export function useArbSummary() {
  return useQuery<ArbSummary>({
    queryKey: qk.arbSummary,
    queryFn: () => api.get<ArbSummary>("/api/arb-candidates/summary"),
    refetchInterval: 60_000,
  });
}

export function useArbCandidates(f: ArbFilters) {
  return useQuery<ArbCandidatesResponse>({
    queryKey: qk.arbCandidates(f.status, f.series, f.hideBlocked),
    queryFn: () =>
      api.get<ArbCandidatesResponse>("/api/arb-candidates", {
        status: f.status === "" ? undefined : f.status,
        series: f.series === "" ? undefined : f.series,
        hide_blocked: f.hideBlocked ? "true" : undefined,
      }),
    refetchInterval: 60_000,
  });
}

/**
 * Detail is fetched once per open and NEVER refreshed in the background: the
 * approval is bound to the rules_hash of exactly the text on screen, so the
 * text must not change while it is being read. Refreshing is explicit
 * (Recheck). gcTime 0 means re-opening refetches, which also re-stamps the
 * server's "viewed" time that approval requires.
 */
export function useArbCandidate(id: number | null) {
  return useQuery<ArbCandidateDetail>({
    queryKey: qk.arbCandidate(id ?? -1),
    queryFn: () => api.get<ArbCandidateDetail>(`/api/arb-candidates/${id}`),
    enabled: id != null,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    retry: false,
  });
}

function useInvalidateArb() {
  const qc = useQueryClient();
  return (id?: number) => {
    void qc.invalidateQueries({ queryKey: qk.arbList });
    void qc.invalidateQueries({ queryKey: qk.arbSummary });
    if (id != null) void qc.invalidateQueries({ queryKey: qk.arbCandidate(id) });
  };
}

export function useArbRecheck(id: number) {
  const qc = useQueryClient();
  const invalidate = useInvalidateArb();
  return useMutation({
    mutationFn: () =>
      api.post<ArbCandidateDetail>(`/api/arb-candidates/${id}/recheck`),
    onSuccess: (d) => {
      qc.setQueryData(qk.arbCandidate(id), d);
      invalidate();
    },
  });
}

export function useArbApprove(id: number) {
  const invalidate = useInvalidateArb();
  return useMutation({
    mutationFn: (body: ArbApproveBody) =>
      api.post<ArbApproveResponse>(`/api/arb-candidates/${id}/approve`, body),
    // Success or refusal, reload: a 409 means the text or state moved on.
    onSettled: () => invalidate(id),
  });
}

/** Approve every ready outcome of one event in a single request. */
export function useArbApproveEvent() {
  const invalidate = useInvalidateArb();
  return useMutation({
    mutationFn: (body: ArbApproveEventBody) =>
      api.post<ArbApproveEventResponse>("/api/arb-candidates/approve-event", body),
    onSettled: () => invalidate(),
  });
}

export function useArbReject(id: number) {
  const invalidate = useInvalidateArb();
  return useMutation({
    mutationFn: (body: ArbRejectBody) =>
      api.post<{ ok: boolean }>(`/api/arb-candidates/${id}/reject`, body),
    onSettled: () => invalidate(id),
  });
}

export function useArbReopen(id: number) {
  const invalidate = useInvalidateArb();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>(`/api/arb-candidates/${id}/reopen`),
    onSettled: () => invalidate(id),
  });
}

/** Human-readable message from a FastAPI error body ({detail: string|{message,...}}). */
export function arbErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const parsed: unknown = JSON.parse(e.message);
      if (parsed && typeof parsed === "object" && "detail" in parsed) {
        const detail = (parsed as { detail: unknown }).detail;
        if (typeof detail === "string") return detail;
        if (detail && typeof detail === "object") {
          const d = detail as { message?: unknown; missing?: unknown; blocks?: unknown };
          const msg = typeof d.message === "string" ? d.message : e.message;
          const list = Array.isArray(d.missing) ? d.missing : Array.isArray(d.blocks) ? d.blocks : [];
          return list.length > 0 ? `${msg} (${list.map(String).join(", ")})` : msg;
        }
      }
    } catch {
      /* not JSON */
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
