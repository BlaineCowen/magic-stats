"use client";

import { useMemo, useState } from "react";

export type PnlMode = "all" | "winners" | "losers";

export interface BetFilterState {
  /** Empty set = all sources allowed. Add a source to opt-in to filtering. */
  sources: Set<string>;
  query: string;
  pnl: PnlMode;
}

interface FilterableBet {
  source: string;
  label?: string;
  instrument?: string;
}

export interface UseBetFilterResult<T> {
  rows: T[];
  totalCount: number;
  state: BetFilterState;
  set: (patch: Partial<BetFilterState>) => void;
  toggleSource: (src: string) => void;
}

/**
 * Composable filter for OpenBets and Settled tables.
 * pnlAccessor lets the caller decide which field counts (current MTM for
 * OpenBets, realized PnL for Settled).
 */
export function useBetFilter<T extends FilterableBet>(
  rows: T[],
  pnlAccessor: (row: T) => number | null | undefined,
): UseBetFilterResult<T> {
  const [state, setState] = useState<BetFilterState>({
    sources: new Set(),
    query: "",
    pnl: "all",
  });

  function set(patch: Partial<BetFilterState>) {
    setState((s) => ({ ...s, ...patch }));
  }
  function toggleSource(src: string) {
    setState((s) => {
      const next = new Set(s.sources);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return { ...s, sources: next };
    });
  }

  const filtered = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    const sourceFilter = state.sources;
    const pnl = state.pnl;
    return rows.filter((r) => {
      if (sourceFilter.size > 0 && !sourceFilter.has(r.source)) return false;
      if (q) {
        const hay = `${r.label ?? ""}\n${r.instrument ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (pnl !== "all") {
        const v = pnlAccessor(r);
        if (v == null) return false;
        if (pnl === "winners" && v <= 0) return false;
        if (pnl === "losers" && v >= 0) return false;
      }
      return true;
    });
  }, [rows, state, pnlAccessor]);

  return {
    rows: filtered,
    totalCount: rows.length,
    state,
    set,
    toggleSource,
  };
}
