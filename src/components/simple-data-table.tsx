"use client";

import * as React from "react";

type QueryResult = Record<string, string | number | boolean | null>;

interface SimpleDataTableProps {
  data: QueryResult[];
}

// Utility function to convert camelCase to human-readable format
function formatColumnHeader(header: string): string {
  return header
    .replace(/([A-Z])/g, " $1") // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();
}

// Utility function to format values for display
function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    // Check if it's a decimal number
    if (Number.isInteger(value)) {
      return value.toString();
    } else {
      return value.toFixed(2);
    }
  }
  return value.toString();
}

export function SimpleDataTable({ data }: SimpleDataTableProps) {
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc"
          ? aValue - bValue
          : bValue - aValue;
      }

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sortConfig.direction === "asc") {
        return aString.localeCompare(bString);
      } else {
        return bString.localeCompare(aString);
      }
    });
  }, [data, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <table className="min-w-full">
          <tbody>
            <tr>
              <td className="h-24 text-center text-gray-500">No results.</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const columns = Object.keys(data[0]!);

  return (
    <div className="w-full">
      <div className="max-h-96 overflow-auto rounded-md border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((key) => (
                <th
                  key={key}
                  className="cursor-pointer px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase transition-colors hover:bg-gray-100 sm:px-6 sm:py-3"
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    <span className="hidden sm:inline">
                      {formatColumnHeader(key)}
                    </span>
                    <span className="sm:hidden">
                      {formatColumnHeader(key).split(" ")[0]}
                    </span>
                    {sortConfig?.key === key && (
                      <span className="text-gray-400">
                        {sortConfig.direction === "asc" ? "🔼" : "🔽"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((key) => (
                  <td
                    key={key}
                    className="px-3 py-2 text-xs whitespace-nowrap text-gray-900 sm:px-6 sm:py-4 sm:text-sm"
                  >
                    {formatValue(row[key] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
