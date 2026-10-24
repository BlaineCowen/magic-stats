"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: ReactNode;
  /** Sort value; null sorts last either way. Omit for an unsortable column. */
  value?: (row: T) => number | string | null;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  /** First click sorts ascending, for columns where low is better or text. */
  ascFirst?: boolean;
  className?: string;
};

export type SortState = { key: string; desc: boolean } | null;

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";
const RANK = "__rank";
// Divider plus a soft shadow on the pinned column once the rest has scrolled under it.
const pinnedShadow =
  "shadow-[1px_0_0_#e2e8f0,6px_0_8px_-4px_rgb(15_23_42/0.18)]";

/**
 * Table whose column headers sort it. Click a header to sort by it, again to
 * flip the direction. The first column stays put while the rest scroll
 * sideways, and a fade on the right edge shows when there's more.
 * `search` adds a filter box; `filters` sits beside it for page-specific
 * controls. Long lists show `limit` rows with a button for the rest.
 */
export function SortableTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort = null,
  limit = 100,
  minWidth = 640,
  maxHeight = "75vh",
  search,
  filters,
  rank = false,
  label,
  empty = "Nothing matches.",
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  defaultSort?: SortState;
  limit?: number;
  minWidth?: number;
  maxHeight?: string;
  /** Text a row is searched by, and the box's placeholder. */
  search?: { text: (row: T) => string; placeholder: string };
  filters?: ReactNode;
  /** Number the rows in their current order. */
  rank?: boolean;
  /** Accessible name for the table. */
  label?: string;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [query, setQuery] = useState("");
  const [shownCount, setShownCount] = useState(limit);
  const col = sort ? columns.find((c) => c.key === sort.key) : undefined;

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!search || !words.length) return rows;
    return rows.filter((r) => {
      const hay = search.text(r).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [rows, query, search]);

  const sorted = useMemo(() => {
    if (!col?.value || !sort) return filtered;
    const get = col.value;
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sort.desc ? -cmp : cmp;
    });
  }, [filtered, col, sort]);

  // A new search or filter starts back at the first page.
  useEffect(() => setShownCount(limit), [rows, query, limit]);
  const shown = sorted.slice(0, shownCount);

  const cols: Column<T>[] = rank
    ? [
        {
          key: RANK,
          label: "#",
          render: () => null,
          className: "w-8 text-slate-400",
        },
        ...columns,
      ]
    : columns;
  // The first real column (usually the name) is the one that stays put.
  const pinned = columns[0];

  // Fades on the edges while there's more to scroll to.
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) =>
      e.left === left && e.right === right ? e : { left, right },
    );
  }, []);
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, shown.length]);

  const toolbar = search != null || filters != null;
  const cell = "px-2 py-1.5 sm:px-3 sm:py-2";

  return (
    <div>
      {toolbar && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <label className="relative w-full sm:w-64">
              <span className="sr-only">{search.placeholder}</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={search.placeholder}
                className="focus-visible:outline-turf-700 h-10 w-full rounded-md border border-slate-300 bg-white pr-9 pl-8 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 sm:h-9 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className={cn(
                    "absolute top-1/2 right-1 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-700",
                    focusCls,
                  )}
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </label>
          )}
          {filters}
          <span
            className="ml-auto text-xs text-slate-500 tabular-nums"
            aria-live="polite"
          >
            {filtered.length === rows.length
              ? `${rows.length} rows`
              : `${filtered.length} of ${rows.length}`}
          </span>
        </div>
      )}

      <div className="relative">
        <div
          ref={scroller}
          onScroll={measure}
          className="overflow-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white"
          style={{ maxHeight }}
        >
          <table
            aria-label={label}
            className="w-full border-separate border-spacing-0 text-[13px] sm:text-sm"
            style={{ minWidth }}
          >
            <thead>
              <tr>
                {cols.map((c) => {
                  const active = c.key === sort?.key;
                  const align = c.align ?? "right";
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        active
                          ? sort?.desc
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                      className={cn(
                        "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-medium whitespace-nowrap text-slate-600",
                        c.value ? "p-0" : cell,
                        c === pinned && "left-0 z-20",
                        c === pinned && edges.left && pinnedShadow,
                        align === "right" ? "text-right" : "text-left",
                        c.className,
                      )}
                    >
                      {c.value ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSort(
                              active && sort
                                ? { key: c.key, desc: !sort.desc }
                                : { key: c.key, desc: !c.ascFirst },
                            )
                          }
                          className={cn(
                            cell,
                            "inline-flex w-full items-center gap-1 hover:bg-slate-100 hover:text-slate-900 focus-visible:-outline-offset-2",
                            align === "right" && "flex-row-reverse",
                            active && "text-slate-900",
                            focusCls,
                          )}
                        >
                          {c.label}
                          {active ? (
                            sort?.desc ? (
                              <ArrowDown
                                className="text-turf-700 size-3 shrink-0"
                                aria-hidden
                              />
                            ) : (
                              <ArrowUp
                                className="text-turf-700 size-3 shrink-0"
                                aria-hidden
                              />
                            )
                          ) : (
                            <span className="size-3 shrink-0" aria-hidden />
                          )}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-0 [&>tr>td]:border-b [&>tr>td]:border-slate-100">
              {shown.map((r, i) => (
                <tr key={rowKey(r, i)} className="group/row">
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        cell,
                        "group-hover/row:bg-turf-50 tabular-nums",
                        c === pinned && "sticky left-0 z-[1] bg-white",
                        c === pinned && edges.left && pinnedShadow,
                        (c.align ?? "right") === "right"
                          ? "text-right"
                          : "text-left",
                        c.className,
                      )}
                    >
                      {c.key === RANK ? i + 1 : c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td
                    colSpan={cols.length}
                    className="px-3 py-8 text-center text-sm text-slate-500"
                  >
                    {empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {edges.right && (
          <div
            className="pointer-events-none absolute inset-y-px right-px flex w-8 items-center justify-end rounded-r-lg bg-gradient-to-l from-white via-white/80 to-transparent"
            aria-hidden
          >
            <ChevronRight className="mr-0.5 size-4 text-slate-400" />
          </div>
        )}
      </div>

      {sorted.length > shown.length && (
        <button
          type="button"
          onClick={() => setShownCount((n) => n + limit)}
          className={cn(
            "border-turf-700 text-turf-800 hover:bg-turf-50 mt-3 rounded-md border px-3 py-1.5 text-sm font-semibold",
            focusCls,
          )}
        >
          Show {Math.min(limit, sorted.length - shown.length)} more
          <span className="font-normal text-slate-500">
            {" "}
            ({sorted.length - shown.length} left)
          </span>
        </button>
      )}
    </div>
  );
}

/** A row of toggle buttons for a toolbar filter. */
export function FilterChips<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex overflow-hidden rounded-md border border-slate-300 bg-white"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 border-l border-slate-300 px-3 text-sm font-semibold first:border-l-0 focus-visible:-outline-offset-2",
            focusCls,
            value === o.value
              ? "bg-turf-950 text-white"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A compact select for a toolbar filter. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-visible:outline-turf-700 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus-visible:outline-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
