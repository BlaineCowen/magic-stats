"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
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

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";

/**
 * Table whose column headers sort it. Click a header to sort by it, again to
 * flip the direction. Rows past `limit` are cut after sorting.
 */
export function SortableTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  limit = 150,
  minWidth = 640,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  defaultSort: { key: string; desc: boolean };
  limit?: number;
  minWidth?: number;
}) {
  const [sort, setSort] = useState(defaultSort);
  const col = columns.find((c) => c.key === sort.key);
  const sorted = col?.value
    ? [...rows].sort((a, b) => {
        const va = col.value!(a);
        const vb = col.value!(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb));
        return sort.desc ? -cmp : cmp;
      })
    : rows;
  const shown = sorted.slice(0, limit);

  return (
    <div className="max-h-[75vh] overflow-auto rounded-lg border border-slate-200 bg-white">
      <table
        className="w-full border-separate border-spacing-0 text-sm"
        style={{ minWidth }}
      >
        <thead>
          <tr>
            {columns.map((c) => {
              const active = c.key === sort.key;
              const align = c.align ?? "right";
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    active
                      ? sort.desc
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={cn(
                    "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium whitespace-nowrap text-slate-600",
                    align === "right" ? "text-right" : "text-left",
                    c.className,
                  )}
                >
                  {c.value ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          active
                            ? { key: c.key, desc: !sort.desc }
                            : { key: c.key, desc: !c.ascFirst },
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded hover:text-slate-900",
                        align === "right" && "flex-row-reverse",
                        active && "text-slate-900",
                        focusCls,
                      )}
                    >
                      {c.label}
                      {active ? (
                        sort.desc ? (
                          <ArrowDown className="size-3" aria-hidden />
                        ) : (
                          <ArrowUp className="size-3" aria-hidden />
                        )
                      ) : (
                        <span className="size-3" aria-hidden />
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
          {shown.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-slate-50/70">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 py-2 tabular-nums",
                    (c.align ?? "right") === "right"
                      ? "text-right"
                      : "text-left",
                    c.className,
                  )}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
