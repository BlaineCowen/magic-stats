import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/polyhedge/api";
import { qk } from "@/lib/polyhedge/queryKeys";
import type {
  HistoryResponse,
  ManualArbPreflightBody,
  ManualArbPreflightResponse,
  ManualArbScanResponse,
  ManualArbSaveBidirectionalBody,
  ManualArbSaveBidirectionalResponse,
  ManualArbSaveBody,
  ManualArbsListResponse,
} from "@/lib/polyhedge/types";

export function useManualArbsList() {
  return useQuery<ManualArbsListResponse>({
    queryKey: qk.manualArbsList,
    queryFn: () => api.get<ManualArbsListResponse>("/api/manual-arbs/list"),
    refetchInterval: 10_000,
  });
}

export function useManualArbsHistory() {
  return useQuery<HistoryResponse>({
    queryKey: qk.manualArbsHistory,
    queryFn: () => api.get<HistoryResponse>("/api/manual-arbs/history"),
    refetchInterval: 60_000,
  });
}

export function useManualArbScan() {
  return useMutation({
    mutationFn: (body: { kalshi_url: string; poly_url: string }) =>
      api.post<ManualArbScanResponse>("/api/manual-arbs/scan", body),
  });
}

export function useManualArbSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualArbSaveBody) =>
      api.post<{ id: number; ok?: boolean }>("/api/manual-arbs/save", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.manualArbsList }),
  });
}

export function useManualArbDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/manual-arbs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.manualArbsList });
      qc.invalidateQueries({ queryKey: qk.manualArbsHistory });
    },
  });
}

export function useManualArbAutoExecute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.put(`/api/manual-arbs/${id}/auto-execute`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.manualArbsList }),
  });
}

export function useManualArbPreflight() {
  return useMutation({
    mutationFn: (body: ManualArbPreflightBody) =>
      api.post<ManualArbPreflightResponse>("/api/manual-arbs/preflight", body),
  });
}

export function useManualArbSaveBidirectional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ManualArbSaveBidirectionalBody) =>
      api.post<ManualArbSaveBidirectionalResponse>(
        "/api/manual-arbs/save-bidirectional", body,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.manualArbsList }),
  });
}
