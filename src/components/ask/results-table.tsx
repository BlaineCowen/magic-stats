"use client";

import { useMemo } from "react";
import { SortableTable, type Column } from "@/components/sortable-table";

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

// IDs are for joins, not for reading.
export function hideIdColumns(rows: Row[]): Row[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([k]) => !k.endsWith("_id"))),
  );
}

export function formatValue(value: Cell | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toString();
    // Rates below 1 (.287 average, .345 wOBA) need the third decimal.
    return value.toFixed(Math.abs(value) < 1 ? 3 : 2);
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
  // NBA
  "nba",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "ts",
  "efg",
  "usg",
  "bpm",
  "obpm",
  "dbpm",
  "rapm",
  "pie",
  "mpg",
  "ppg",
  "rpg",
  "apg",
  // MLB
  "mlb",
  "war",
  "woba",
  "xwoba",
  "xba",
  "xslg",
  "wrc",
  "wraa",
  "fip",
  "xfip",
  "era",
  "xera",
  "whip",
  "ops",
  "obp",
  "slg",
  "iso",
  "babip",
  "rbi",
  "hr",
  "pa",
  "ab",
  "ip",
  "oaa",
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

export function ResultsTable({ data }: { data: Row[] }) {
  const columns = useMemo((): Column<Row>[] => {
    const keys = Object.keys(data[0] ?? {});
    return keys.map((key) => {
      // A column is numeric when every non-empty value is a number.
      const vals = data.map((r) => r[key]).filter((v) => v != null);
      const numeric =
        vals.length > 0 && vals.every((v) => typeof v === "number");
      return {
        key,
        label: columnLabel(key),
        align: numeric ? "right" : "left",
        // numbers usually read best biggest-first
        ascFirst: !numeric,
        value: (r) => {
          const v = r[key];
          return typeof v === "boolean" ? String(v) : (v ?? null);
        },
        render: (r) =>
          r[key] == null ? (
            <span className="text-slate-400">N/A</span>
          ) : (
            formatValue(r[key])
          ),
        className: "whitespace-nowrap text-slate-900",
      };
    });
  }, [data]);
  const search = useMemo(
    () =>
      data.length > 10
        ? {
            text: (r: Row) => Object.values(r).join(" "),
            placeholder: "Filter these rows",
          }
        : undefined,
    [data.length],
  );

  if (!columns.length) return null;

  return (
    <SortableTable
      // A new answer starts with a fresh search and sort.
      key={columns.map((c) => c.key).join()}
      rows={data}
      columns={columns}
      rowKey={(_, i) => String(i)}
      search={search}
      minWidth={0}
      maxHeight="32rem"
      limit={200}
      label="Results"
    />
  );
}
