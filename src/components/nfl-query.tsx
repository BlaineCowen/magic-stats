"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { NflNav } from "@/components/nfl-nav";
import { QueryChart } from "@/components/charts/query-chart";
import { SimpleDataTable } from "@/components/simple-data-table";
import {
  inferSpec,
  type ChartPick,
  type ChartRow,
  type ChartSource,
  type ChartSpec,
  type TeamColors,
} from "@/lib/nfl/chart-spec";
import { cn } from "@/lib/utils";

// Stable references so an idle response doesn't hand QueryChart a new empty
// array/object identity on every render (it's wrapped in React.memo).
const EMPTY_ROWS: ChartRow[] = [];
const EMPTY_COLUMNS: string[] = [];
const EMPTY_COLORS: TeamColors = {};

type QueryResult = Record<string, string | number | boolean | null>;
type Mode = "fast" | "deep";

type Attempt = {
  mode: Mode;
  sql: string;
  plan: string | null;
  chart?: ChartPick | null;
  error?: string;
  rows?: number;
  llm_ms: number;
  db_ms: number;
};

interface ApiResponse {
  results?: QueryResult[];
  columns?: string[];
  truncated?: boolean;
  error?: string;
  sql?: string;
  plan?: string | null;
  mode?: Mode;
  attempts?: Attempt[];
  timings?: { total_ms: number };
  cached?: boolean;
  chart?: ChartSpec | null;
  chart_source?: ChartSource | null;
  team_colors?: TeamColors;
}

type AiStatus = { online: boolean; model: string; loaded: boolean };

const QUERY_LIMIT = 50;

const EXAMPLES = [
  "Top 10 quarterbacks in 2024 by EPA per dropback, minimum 300 dropbacks",
  "Receivers in 2024 with at least 50 targets: target share, air yards share and yards per target",
  "Running backs in 2024 with at least 100 carries ranked by rushing EPA per carry, with total rushing yards",
  "Top 15 players in PPR fantasy points in 2024 who played at least 10 games",
  "Which defenses allowed the lowest EPA per dropback from 2021 to 2025?",
  "CJ Stroud's 10 longest completions by air yards in 2024",
];

// Utility function to format values for display
function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return value.toString();
}

// IDs are for joins, not for reading.
function hideIdColumns(rows: QueryResult[]): QueryResult[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([k]) => !k.endsWith("_id"))),
  );
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function NflQuery({ debug = false }: { debug?: boolean }) {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [queryCount, setQueryCount] = useState(0);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  // The chart on screen; a new `key` remounts QueryChart so its controls
  // reset. `question` is the question it answers, shown as the subtitle.
  const [chart, setChart] = useState<{
    spec: ChartSpec;
    key: number;
    hidden: boolean;
    question: string;
  } | null>(null);

  const isLoading = loadingMode !== null;
  const isLimitReached = !debug && queryCount >= QUERY_LIMIT;
  const results = hideIdColumns(response?.results ?? []);
  const chartShown = !!chart && !chart.hidden && !error && results.length > 0;
  // Offered as "Chart this" when the answer came back as a table only.
  // inferSpec is a pile of heuristics over rows we don't control (LLM SQL
  // output); guard it so a bug there can't blank the whole results card.
  const inferred = useMemo(() => {
    if (chart || !response?.results?.length) return null;
    try {
      return inferSpec(lastQuery, response.results, response.columns ?? []);
    } catch (e) {
      console.error("inferSpec failed:", e);
      return null;
    }
  }, [chart, response, lastQuery]);

  const hideChart = useCallback(() => {
    setChart((c) => (c ? { ...c, hidden: true } : c));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("nfl_query_count");
    setQueryCount(saved ? parseInt(saved, 10) : 0);
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((d: AiStatus) => setAiStatus(d))
      .catch(() => setAiStatus({ online: false, model: "", loaded: false }));
  }, []);

  // Deep mode takes minutes; show a running clock so it doesn't look stuck.
  useEffect(() => {
    if (!isLoading) return;
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(id);
  }, [isLoading]);

  const runQuery = async (text: string, mode: Mode) => {
    if (isLimitReached) {
      setError(
        `You've reached the limit of ${QUERY_LIMIT} queries. Please clear your browser data to reset.`,
      );
      return;
    }
    setLoadingMode(mode);
    setError("");
    setLastQuery(text);
    setChart(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, mode, nocache: debug }),
      });
      const data = (await res.json()) as ApiResponse;
      setResponse(data);
      setChart(
        data.chart
          ? { spec: data.chart, key: Date.now(), hidden: false, question: text }
          : null,
      );
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch results");
      if (!debug) {
        const next = queryCount + 1;
        setQueryCount(next);
        localStorage.setItem("nfl_query_count", next.toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch results");
    } finally {
      setLoadingMode(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void runQuery(query, "fast");
  };

  const debugText = () =>
    `User Query: ${lastQuery}\n\nSQL Generated: ${response?.sql ?? ""}\n\n${
      error ? `Error: ${error}` : "No results were returned."
    } Please help debug this query.`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(debugText());
      toast.success("Debug info copied");
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const downloadCSV = () => {
    if (results.length === 0) return;
    const headers = Object.keys(results[0]!);
    const escape = (s: string) =>
      /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const csvContent = [
      headers.join(","),
      ...results.map((row) =>
        headers.map((h) => escape(formatValue(row[h] ?? null))).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nfl_stats_results.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV downloaded successfully!");
  };

  const sendEmail = () => {
    const subject = encodeURIComponent("NFL Stats Query Debug");
    window.open(
      `mailto:blaine.cowen@gmail.com?subject=${subject}&body=${encodeURIComponent(debugText())}`,
    );
  };

  const thinkHarder = lastQuery && !isLoading && response?.mode !== "deep" && (
    <button
      onClick={() => void runQuery(lastQuery, "deep")}
      className="rounded border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-800 hover:bg-purple-100"
      title="Re-ask with the model's full reasoning (LM Studio /api/v1/chat)"
    >
      Think harder (~2–3 min)
    </button>
  );

  const queryDetails = response?.sql && (
    <details className="mt-4 text-sm" open={debug}>
      <summary className="cursor-pointer text-gray-600">
        How this was answered
        {response.timings &&
          ` · ${response.mode === "deep" ? "thought it through" : "fast"} · ${seconds(response.timings.total_ms)}`}
        {response.attempts &&
          response.attempts.length > 1 &&
          ` · ${response.attempts.length} attempts`}
        {response.chart_source &&
          ` · chart ${response.chart_source === "model" ? "picked by model" : "inferred"}`}
        {response.cached && " · cached"}
      </summary>
      {response.plan && <p className="mt-2 text-gray-700">{response.plan}</p>}
      <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-3 text-xs whitespace-pre-wrap text-gray-800">
        {response.sql}
      </pre>
      {debug &&
        response.attempts?.map((a, i) => (
          <div
            key={i}
            className="mt-2 rounded border border-gray-200 p-2 text-xs"
          >
            <div className="font-medium">
              Attempt {i + 1} ({a.mode}) · LLM {seconds(a.llm_ms)} · DB{" "}
              {seconds(a.db_ms)}
              {a.rows !== undefined && ` · ${a.rows} rows`}
            </div>
            {a.error && <div className="mt-1 text-red-700">{a.error}</div>}
            {a.chart && a.chart.type !== "none" && (
              <div className="mt-1 text-gray-500">
                chart: {JSON.stringify(a.chart)}
              </div>
            )}
            <pre className="mt-1 whitespace-pre-wrap text-gray-600">
              {a.sql}
            </pre>
          </div>
        ))}
    </details>
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div className={cn("mx-auto", chartShown ? "max-w-5xl" : "max-w-3xl")}>
        {/* Header, search and errors keep the narrow width when a chart widens the page. */}
        <div className="mx-auto max-w-3xl">
          <NflNav />
          <h1 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:text-4xl">
            NFL Stats Query{debug && " - Testing"}
          </h1>

          {aiStatus && !aiStatus.online && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠ The local AI (LM Studio on the Mac mini) is not responding.
              Queries will fail until it&apos;s back.
            </div>
          )}
          {aiStatus?.online && !aiStatus.loaded && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              {aiStatus.model} isn&apos;t loaded yet; the first query will take
              longer while LM Studio loads it.
            </div>
          )}

          {!debug && queryCount > 0 && (
            <div className="mb-4 text-center text-sm text-gray-600">
              Queries used: {queryCount}/{QUERY_LIMIT}
              {isLimitReached && (
                <span className="ml-2 font-medium text-red-600">
                  (Limit reached)
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask any question about NFL stats..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:px-4 sm:text-base"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim() || isLimitReached}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-400 sm:gap-2 sm:px-4 sm:text-base"
              >
                {isLoading ? (
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
                ) : (
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
                )}
                <span className="hidden sm:inline">
                  {isLoading ? seconds(elapsed) : "Execute"}
                </span>
              </button>
            </div>
            {isLoading && (
              <p className="mt-2 text-sm text-gray-500">
                {loadingMode === "deep"
                  ? `Thinking it through… ${seconds(elapsed)} (usually 2–3 minutes)`
                  : `Writing a query… ${seconds(elapsed)}`}
              </p>
            )}
          </form>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">
              <p className="whitespace-pre-wrap">{error}</p>
              {queryDetails}
              <div className="mt-3 flex flex-wrap gap-2">
                {thinkHarder}
                <button
                  onClick={copyToClipboard}
                  className="rounded bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700"
                >
                  Copy Debug Info
                </button>
                <button
                  onClick={sendEmail}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  Email Debug Info
                </button>
              </div>
            </div>
          )}
        </div>

        {!error && response && results.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                Results
              </h2>
              <div className="flex items-center gap-2">
                {thinkHarder}
                {chart?.hidden && (
                  <button
                    onClick={() => setChart({ ...chart, hidden: false })}
                    className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-3 sm:py-2 sm:text-sm"
                  >
                    Show chart
                  </button>
                )}
                {!isLoading && inferred && (
                  <button
                    onClick={() =>
                      setChart({
                        spec: inferred,
                        key: Date.now(),
                        hidden: false,
                        question: lastQuery,
                      })
                    }
                    className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-3 sm:py-2 sm:text-sm"
                  >
                    Chart this
                  </button>
                )}
                <button
                  onClick={downloadCSV}
                  className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 sm:px-3 sm:py-2 sm:text-sm"
                  title="Download as CSV"
                >
                  CSV
                </button>
              </div>
            </div>
            {/* Stays mounted while hidden so Hide/Show keeps the user's
                control changes (X/Y/series/type); only its wrapper toggles. */}
            {chart && (
              <div className={chartShown ? undefined : "hidden"}>
                <QueryChart
                  key={chart.key}
                  rows={response?.results ?? EMPTY_ROWS}
                  columns={response?.columns ?? EMPTY_COLUMNS}
                  initial={chart.spec}
                  teamColors={response?.team_colors ?? EMPTY_COLORS}
                  question={chart.question}
                  truncated={response?.truncated}
                  onHide={hideChart}
                />
              </div>
            )}
            <SimpleDataTable data={results} />
            {response.truncated && (
              <p className="mt-2 text-xs text-gray-500">
                Showing the first {results.length} rows.
              </p>
            )}
            {queryDetails}
          </div>
        )}

        {!error && !isLoading && response && results.length === 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 sm:p-6">
            <h3 className="mb-2 text-base font-semibold text-yellow-800 sm:text-lg">
              No Results Found
            </h3>
            <p className="text-sm text-yellow-800">
              The query ran but matched nothing. Check spelling of player or
              team names, or let the model think it through.
            </p>
            {queryDetails}
            <div className="mt-3 flex flex-wrap gap-2">
              {thinkHarder}
              <button
                onClick={copyToClipboard}
                className="rounded bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700"
              >
                Copy Debug Info
              </button>
            </div>
          </div>
        )}

        {!query && !response && (
          <div className="rounded-lg bg-blue-50 p-4 text-blue-700 sm:p-6">
            <h2 className="mb-2 text-base font-semibold sm:text-lg">
              Example queries:
            </h2>
            <ul className="space-y-2 sm:space-y-3">
              {EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    onClick={() => setQuery(example)}
                    className="text-left hover:underline"
                    title="Use this query"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Toaster position="bottom-center" />
    </main>
  );
}
