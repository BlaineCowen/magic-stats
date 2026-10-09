"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

type Accessor<T> = (row: T) => string | number | boolean | null | undefined;
export type Accessors<T> = Record<string, Accessor<T>>;

export interface SortState {
  key: string;
  dir: SortDir;
}

export interface SortBindResult {
  "data-sort"?: SortDir;
  onClick: () => void;
}

export interface UseTableSortResult<T> {
  rows: T[];
  sort: SortState;
  bind: (key: string) => SortBindResult;
}

/**
 * Headless table sort hook. Owns sort state; returns sorted rows + a `bind`
 * helper that hands off click + data-sort props to a SortHeader.
 *
 * Click semantics:
 *   - Click the active column → flip direction
 *   - Click an inactive column → reset to that column's natural default
 *     (asc for strings, desc for numbers; nulls always sort to the bottom)
 */
export function useTableSort<T>(
  rows: T[],
  accessors: Accessors<T>,
  defaults: SortState,
): UseTableSortResult<T> {
  const [sort, setSort] = useState<SortState>(defaults);

  const sorted = useMemo(() => {
    const accessor = accessors[sort.key];
    if (!accessor) return rows;
    const arr = [...rows];
    const dirMul = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      // null/undefined sort to the bottom regardless of direction.
      const aMissing = av == null || av === "";
      const bMissing = bv == null || bv === "";
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dirMul;
      }
      return String(av).localeCompare(String(bv)) * dirMul;
    });
    return arr;
  }, [rows, accessors, sort.key, sort.dir]);

  function bind(key: string): SortBindResult {
    const isActive = sort.key === key;
    return {
      "data-sort": isActive ? sort.dir : undefined,
      onClick: () => {
        setSort((prev) => {
          if (prev.key === key) {
            return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
          }
          // First click on a new column: pick a sensible default by sampling
          // the accessor on the first row.
          const sample = rows[0] != null ? accessors[key]?.(rows[0]) : null;
          const dir: SortDir = typeof sample === "number" ? "desc" : "asc";
          return { key, dir };
        });
      },
    };
  }

  return { rows: sorted, sort, bind };
}
