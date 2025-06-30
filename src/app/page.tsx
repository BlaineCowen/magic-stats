"use client";

import { useState } from "react";

type QueryResult = Record<string, string | number | boolean | null>;

interface ApiResponse {
  results?: QueryResult[];
  error?: string;
  interpretation?: string;
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

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInterpretation("");

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok)
        throw new Error(data.error ?? "Failed to fetch results");
      setResults(data.results ?? []);
      setInterpretation(data.interpretation ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch results");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-center text-4xl font-bold text-gray-900">
          NFL Stats Query
        </h1>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask any question about NFL stats..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {interpretation && (
          <div className="mb-6 rounded-lg bg-blue-50 p-4 text-blue-700">
            <h3 className="mb-2 font-semibold">Query Interpretation:</h3>
            <p>{interpretation}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Results
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(results[0]!).map((key) => (
                      <th
                        key={key}
                        className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                      >
                        {formatColumnHeader(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {results.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((value, j) => (
                        <td
                          key={j}
                          className="px-6 py-4 text-sm whitespace-nowrap text-gray-900"
                        >
                          {formatValue(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!isLoading && !error && results.length === 0 && query && (
          <div className="text-center text-gray-500">
            No results found. Try a different query.
          </div>
        )}

        {!query && (
          <div className="rounded-lg bg-blue-50 p-6 text-blue-700">
            <h2 className="mb-2 font-semibold">Example queries:</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Show me all games where the Cowboys scored more than 40 points
                in 2023
              </li>
              <li>What was Tom Brady&apos;s completion percentage in 2020?</li>
              <li>
                How many touchdowns did the Chiefs score in the 2023 playoffs?
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
