"use client";

import { useState } from "react";

type QueryResult = Record<string, string | number | boolean | null>;

interface ApiResponse {
  results?: QueryResult[];
  error?: string;
  interpretation?: string;
  r_code?: string;
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
  const [rCode, setRCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasExecuted, setHasExecuted] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setInterpretation("");
    setRCode("");
    setHasExecuted(false);

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
      setRCode(data.r_code ?? "");
      setHasExecuted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch results");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    const message = `User Query: ${query}\n\nR Code Generated: ${rCode}\n\nNo results were returned. Please help debug this query.`;
    try {
      await navigator.clipboard.writeText(message);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const sendEmail = () => {
    const subject = encodeURIComponent("NFL Stats Query Debug - No Results");
    const body = encodeURIComponent(`User Query: ${query}

R Code Generated: ${rCode}

No results were returned. Please help debug this query.`);
    window.open(
      `mailto:blaine.cowen@gmail.com?subject=${subject}&body=${body}`,
    );
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
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Executing...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                  Execute
                </>
              )}
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

        {!isLoading &&
          !error &&
          results.length === 0 &&
          query &&
          hasExecuted && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-yellow-800">
                No Results Found
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 font-medium text-yellow-700">
                    User Query:
                  </h4>
                  <p className="rounded bg-yellow-100 p-3 text-yellow-800">
                    {query}
                  </p>
                </div>
                {rCode && (
                  <div>
                    <h4 className="mb-2 font-medium text-yellow-700">
                      R Code Generated:
                    </h4>
                    <pre className="overflow-x-auto rounded bg-yellow-100 p-3 text-sm whitespace-pre-wrap text-yellow-800">
                      {rCode}
                    </pre>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 rounded bg-yellow-600 px-4 py-2 text-white transition-colors hover:bg-yellow-700"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy Debug Info
                  </button>
                  <button
                    onClick={sendEmail}
                    className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Email Debug Info
                  </button>
                </div>
              </div>
            </div>
          )}

        {!query && (
          <div className="rounded-lg bg-blue-50 p-6 text-blue-700">
            <h2 className="mb-2 font-semibold">Example queries:</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Show me the top 10 quarterbacks in 2024 with at least 200
                attempts, ranked by passing EPA per attempt
              </li>
              <li>
                Find receivers in 2024 who had at least 50 targets and show
                their air yards share, target share, and yards per target
              </li>
              <li>
                Show me running backs in 2024 with at least 100 carries, ranked
                by rushing EPA per carry, and include their total rushing yards
              </li>
              <li>
                List the top 15 players in PPR fantasy points in 2024, but only
                include players who played at least 10 games
              </li>
              <li>
                Show me receivers in 2024 with at least 30 targets, ranked by
                WOPR (weighted opportunity rating), and include their RACR and
                receiving EPA
              </li>
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
