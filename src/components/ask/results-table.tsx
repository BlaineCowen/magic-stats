"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export function formatValue(value: Cell | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return value.toString();
}

// Column names come straight from model-written SQL (snake_case, sometimes
// camelCase). Turn them into sentence case and keep stat acronyms upper.
const ACRONYMS = new Set([
  "epa",
  "cpoe",
  "wpa",
  "td",
  "tds",
  "int",
  "ints",
  "ppr",
  "qb",
  "rb",
  "wr",
  "te",
  "ypc",
  "ypa",
  "ypt",
  "yac",
  "adot",
  "nfl",
  "pct",
]);

export function columnLabel(key: string): string {
  const words = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  return words
    .map((w, i) =>
      ACRONYMS.has(w)
        ? w.toUpperCase()
        : i === 0
          ? w.charAt(0).toUpperCase() + w.slice(1)
          : w,
    )
    .join(" ");
}

type Sort = { key: string; dir: "asc" | "desc" } | null;

export function ResultsTable({ data }: { data: Row[] }) {
  const [sort, setSort] = useState<Sort>(null);
  const columns = useMemo(() => Object.keys(data[0] ?? {}), [data]);
  // A column is numeric when every non-empty value is a number.
  const numeric = useMemo(() => {
    const out = new Set<string>();
    for (const c of columns) {
      const vals = data.map((r) => r[c]).filter((v) => v != null);
      if (vals.length && vals.every((v) => typeof v === "number")) out.add(c);
    }
    return out;
  }, [columns, data]);

  const rows = useMemo(() => {
    if (!sort) return data;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x == null) return 1;
      if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return String(x).localeCompare(String(y)) * sign;
    });
  }, [data, sort]);

  const toggle = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : // numbers usually read best biggest-first
          { key, dir: numeric.has(key) ? "desc" : "asc" },
    );

  if (!columns.length) return null;

  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {columns.map((key) => {
              const active = sort?.key === key;
              const Icon = sort?.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    active
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 p-0 font-semibold whitespace-nowrap text-slate-700",
                    numeric.has(key) ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={cn(
                      "focus-visible:outline-turf-700 inline-flex w-full items-center gap-1 px-3 py-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2",
                      numeric.has(key) && "flex-row-reverse",
                    )}
                    title="Sort by this column"
                  >
                    {columnLabel(key)}
                    {active && (
                      <Icon className="text-turf-700 size-3.5" aria-hidden />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-turf-50 even:bg-slate-50/60">
              {columns.map((key) => (
                <td
                  key={key}
                  className={cn(
                    "border-b border-slate-100 px-3 py-2 whitespace-nowrap text-slate-900",
                    numeric.has(key) && "text-right tabular-nums",
                    row[key] == null && "text-slate-400",
                  )}
                >
                  {formatValue(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
