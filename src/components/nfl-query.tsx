"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Clock,
  Copy,
  Download,
  Link2,
  Loader2,
  Mail,
  Search,
  X,
} from "lucide-react";
import { QueryChart } from "@/components/charts/query-chart";
import { EXAMPLE_GROUPS } from "@/components/ask/examples";
import { loadRecent, pushRecent, saveRecent } from "@/components/ask/recent";
import { formatValue, ResultsTable } from "@/components/ask/results-table";
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

// "notice" is the server saying no (limits, too long): amber, nothing to debug.
// "failure" is something breaking: red, with the debug tools.
type Problem = { kind: "notice" | "failure"; message: string };

// Matches MAX_QUESTION_CHARS in src/lib/query-limits.ts (server-only module).
const MAX_CHARS = 300;
const OFFLINE_MESSAGE =
  "The stats assistant isn't responding right now. Try again in a few minutes.";

// IDs are for joins, not for reading.
function hideIdColumns(rows: QueryResult[]): QueryResult[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([k]) => !k.endsWith("_id"))),
  );
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function waitHint(retryAfter: string | null): string {
  const s = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(s) || s <= 0) return "";
  if (s < 90) return " You can ask again in about a minute.";
  if (s < 2 * 3600)
    return ` You can ask again in about ${Math.round(s / 60)} minutes.`;
  return ` You can ask again in about ${Math.round(s / 3600)} hours.`;
}

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}

const secondaryButton =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-turf-700 disabled:opacity-50";

export function NflQuery({ debug = false }: { debug?: boolean }) {
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // The chart on screen; a new `key` remounts QueryChart so its controls
  // reset. `question` is the question it answers, shown as the subtitle.
  const [chart, setChart] = useState<{
    spec: ChartSpec;
    key: number;
    hidden: boolean;
    question: string;
  } | null>(null);

  const error = problem?.message ?? "";
  const isLoading = loadingMode !== null;
  const tooLong = query.length > MAX_CHARS;
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
    setRecent(loadRecent());
    // ?q= prefills the box but never runs it: every question costs money.
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
    fetch("/api/ai-status")
      .then((r) => r.json())
      .then((d: AiStatus) => setAiStatus(d))
      .catch(() => setAiStatus({ online: false, model: "", loaded: false }));
  }, []);

  // "/" jumps to the box from anywhere that isn't already a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A running clock so a slow answer doesn't look stuck.
  useEffect(() => {
    if (!isLoading) return;
    const started = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(id);
  }, [isLoading]);

  const runQuery = async (raw: string, mode: Mode) => {
    const text = raw.trim();
    if (!text || isLoading) return;
    if (text.length > MAX_CHARS) {
      setProblem({
        kind: "notice",
        message: `Keep questions under ${MAX_CHARS} characters.`,
      });
      return;
    }
    setLoadingMode(mode);
    setProblem(null);
    setLastQuery(text);
    setChart(null);
    try {
      let res: Response;
      try {
        res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text, mode, nocache: debug }),
        });
      } catch {
        setResponse(null);
        setProblem({ kind: "failure", message: OFFLINE_MESSAGE });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      setResponse(data);
      if (res.status === 429 || res.status === 400) {
        setProblem({
          kind: "notice",
          message:
            (data.error ?? "That question can't be asked right now.") +
            (res.status === 429
              ? waitHint(res.headers.get("Retry-After"))
              : ""),
        });
        return;
      }
      if (!res.ok) {
        setProblem({
          kind: "failure",
          message:
            res.status === 503 && !debug
              ? OFFLINE_MESSAGE
              : (data.error ?? "Something went wrong answering that."),
        });
        return;
      }
      setChart(
        data.chart
          ? { spec: data.chart, key: Date.now(), hidden: false, question: text }
          : null,
      );
      setRecent((r) => {
        const next = pushRecent(r, text);
        saveRecent(next);
        return next;
      });
      // Reflect the question in the address bar so it can be shared; loading
      // that URL only prefills the box.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("q", text);
        window.history.replaceState(null, "", url);
      } catch {
        // not fatal
      }
    } finally {
      setLoadingMode(null);
    }
  };

  const ask = (text: string) => {
    setQuery(text);
    void runQuery(text, "fast");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void runQuery(query, "fast");
  };

  const clearRecent = () => {
    setRecent([]);
    saveRecent([]);
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

  const copyLink = async () => {
    try {
      const url = new URL(window.location.href);
      url.search = "";
      url.searchParams.set("q", lastQuery);
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
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
    toast.success("CSV downloaded");
  };

  const sendEmail = () => {
    const subject = encodeURIComponent("NFL Stats Query Debug");
    window.open(
      `mailto:blaine.cowen@gmail.com?subject=${subject}&body=${encodeURIComponent(debugText())}`,
    );
  };

  const thinkHarder = lastQuery && !isLoading && response?.mode !== "deep" && (
    <button
      type="button"
      onClick={() => void runQuery(lastQuery, "deep")}
      className={secondaryButton}
      title="Ask again and let the model reason it through first. Takes a few extra seconds."
    >
      <Brain className="text-turf-700 size-4" aria-hidden />
      Think harder
    </button>
  );

  const queryDetails = response?.sql && (
    <details className="mt-4 text-sm" open={debug}>
      <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
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
      {response.plan && <p className="mt-2 text-slate-700">{response.plan}</p>}
      <pre className="mt-2 overflow-x-auto rounded-md bg-slate-100 p-3 text-xs whitespace-pre-wrap text-slate-800">
        {response.sql}
      </pre>
      {debug &&
        response.attempts?.map((a, i) => (
          <div
            key={i}
            className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-xs"
          >
            <div className="font-medium">
              Attempt {i + 1} ({a.mode}) · LLM {seconds(a.llm_ms)} · DB{" "}
              {seconds(a.db_ms)}
              {a.rows !== undefined && ` · ${a.rows} rows`}
            </div>
            {a.error && <div className="mt-1 text-red-700">{a.error}</div>}
            {a.chart && a.chart.type !== "none" && (
              <div className="mt-1 text-slate-500">
                chart: {JSON.stringify(a.chart)}
              </div>
            )}
            <pre className="mt-1 whitespace-pre-wrap text-slate-600">
              {a.sql}
            </pre>
          </div>
        ))}
    </details>
  );

  // A steady line that eases toward full; it never claims to be done early.
  const expectedMs = loadingMode === "deep" ? 25000 : 6000;
  const progress = 1 - Math.exp(-elapsed / expectedMs);
  const showCounter = query.length >= MAX_CHARS - 50;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
        Magic Stats
        {debug && <span className="text-slate-400"> (testing)</span>}
      </h1>
      <p className="mt-2 max-w-2xl text-lg text-slate-600">
        Ask any NFL stats question the way you&apos;d text a friend. Answers
        come from every play since 1999.
      </p>

      <div className="mt-6 max-w-3xl">
        {aiStatus && !aiStatus.online && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {OFFLINE_MESSAGE}
          </div>
        )}
        {aiStatus?.online && !aiStatus.loaded && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600"
          >
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            The stats assistant is warming up, so the first answer may take a
            little longer.
          </div>
        )}

        <form onSubmit={handleSearch}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                placeholder="Most rushing yards in 2024?"
                aria-label="Your question"
                aria-describedby={showCounter ? "ask-counter" : undefined}
                aria-invalid={tooLong || undefined}
                enterKeyHint="search"
                className={cn(
                  "focus:border-turf-700 focus:ring-turf-700/25 h-12 w-full rounded-lg border bg-white pr-10 pl-11 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:ring-4 focus:outline-none sm:h-14 sm:text-lg",
                  tooLong ? "border-red-400" : "border-slate-300",
                )}
              />
              {query && !isLoading ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="focus-visible:outline-turf-700 absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2"
                  aria-label="Clear question"
                  title="Clear (Esc)"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : (
                <kbd
                  aria-hidden
                  className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-400 sm:block"
                >
                  /
                </kbd>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim() || tooLong}
              className="bg-turf-700 hover:bg-turf-800 focus-visible:outline-turf-700 inline-flex h-12 items-center gap-2 rounded-lg px-5 text-base font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:px-7 sm:text-lg"
            >
              {isLoading && (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              )}
              {isLoading ? "Asking" : "Ask"}
            </button>
          </div>
          {showCounter && (
            <p
              id="ask-counter"
              className={cn(
                "mt-1.5 text-right text-sm tabular-nums",
                tooLong ? "font-medium text-red-700" : "text-slate-500",
              )}
            >
              {query.length}/{MAX_CHARS}
              {tooLong && " · shorten it a little to ask"}
            </p>
          )}
        </form>

        {recent.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Recent</span>
            {recent.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                disabled={isLoading}
                title={q}
                className="hover:border-turf-700 hover:text-turf-800 focus-visible:outline-turf-700 max-w-[16rem] truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 focus-visible:outline-2 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              onClick={clearRecent}
              className="focus-visible:outline-turf-700 rounded px-1 text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline focus-visible:outline-2"
            >
              Clear
            </button>
          </div>
        )}

        {problem?.kind === "notice" && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>{problem.message}</p>
          </div>
        )}

        {problem?.kind === "failure" && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <p className="font-semibold">That one didn&apos;t work.</p>
            <p className="mt-1 whitespace-pre-wrap">{problem.message}</p>
            {queryDetails}
            <div className="mt-3 flex flex-wrap gap-2">
              {thinkHarder}
              <button
                type="button"
                onClick={copyToClipboard}
                className={secondaryButton}
              >
                <Copy className="size-4" aria-hidden />
                Copy debug info
              </button>
              <button
                type="button"
                onClick={sendEmail}
                className={secondaryButton}
              >
                <Mail className="size-4" aria-hidden />
                Email debug info
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <section
          aria-live="polite"
          className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <div className="h-1 bg-slate-100">
            <div
              className="bg-turf-700 h-full transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(progress, 0.95) * 100}%` }}
            />
          </div>
          <div className="p-4 sm:p-6">
            <p className="flex flex-wrap items-baseline gap-x-2 text-slate-700">
              <span className="font-medium">
                {loadingMode === "deep"
                  ? "Thinking it through"
                  : "Looking it up"}
              </span>
              <span className="text-slate-500 tabular-nums">
                {Math.floor(elapsed / 1000)}s
              </span>
              <span className="text-sm text-slate-500">
                {loadingMode === "deep"
                  ? "This takes a little longer, usually under a minute."
                  : "Usually a few seconds."}
              </span>
            </p>
            <p className="mt-1 truncate text-sm text-slate-500">{lastQuery}</p>
            <div className="mt-5 space-y-2" aria-hidden>
              <div className="h-8 rounded bg-slate-100" />
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-6 animate-pulse rounded bg-slate-100/70"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {!isLoading && !error && response && results.length > 0 && (
        <section className="mt-8 min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-2xl leading-tight font-bold text-slate-900">
                {lastQuery}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {results.length} {results.length === 1 ? "row" : "rows"}
                {response.truncated && " (first rows only)"}
                {response.cached && " · saved answer"}
                {response.mode === "deep" && " · thought it through"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {thinkHarder}
              {chart?.hidden && (
                <button
                  type="button"
                  onClick={() => setChart({ ...chart, hidden: false })}
                  className={secondaryButton}
                >
                  <BarChart3 className="size-4" aria-hidden />
                  Show chart
                </button>
              )}
              {inferred && (
                <button
                  type="button"
                  onClick={() =>
                    setChart({
                      spec: inferred,
                      key: Date.now(),
                      hidden: false,
                      question: lastQuery,
                    })
                  }
                  className={secondaryButton}
                >
                  <BarChart3 className="size-4" aria-hidden />
                  Chart this
                </button>
              )}
              <button
                type="button"
                onClick={downloadCSV}
                className={secondaryButton}
                title="Download as CSV"
              >
                <Download className="size-4" aria-hidden />
                CSV
              </button>
              <button
                type="button"
                onClick={copyLink}
                className={secondaryButton}
                title="Copy a link that fills in this question"
              >
                <Link2 className="size-4" aria-hidden />
                Copy link
              </button>
            </div>
          </div>
          {/* Stays mounted while hidden so Hide/Show keeps the user's
              control changes (X/Y/series/type); only its wrapper toggles. */}
          {chart && (
            <div className={chartShown ? "mb-4" : "hidden"}>
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
          <ResultsTable data={results} />
          {response.truncated && (
            <p className="mt-2 text-xs text-slate-500">
              Showing the first {results.length} rows.
            </p>
          )}
          {queryDetails}
        </section>
      )}

      {!isLoading && !error && response && results.length === 0 && (
        <section className="mt-8 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 sm:p-6">
          <h2 className="font-display text-xl font-bold text-amber-900">
            No matches
          </h2>
          <p className="mt-1 text-amber-900">
            The question ran but nothing matched. Check how player or team names
            are spelled, or let the model think it through.
          </p>
          {queryDetails}
          <div className="mt-3 flex flex-wrap gap-2">
            {thinkHarder}
            <button
              type="button"
              onClick={copyToClipboard}
              className={secondaryButton}
            >
              <Copy className="size-4" aria-hidden />
              Copy debug info
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="examples" className="mt-10">
        <h2
          id="examples"
          className="font-display text-2xl font-bold text-slate-900"
        >
          {response ? "Try another" : "Try one of these"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLE_GROUPS.map((g) => (
            <div
              key={g.title}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h3 className="font-display text-lg font-semibold text-slate-900">
                {g.title}
              </h3>
              <ul className="mt-2 space-y-1">
                {g.questions.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => ask(q)}
                      disabled={isLoading}
                      className="hover:bg-turf-50 hover:text-turf-800 focus-visible:outline-turf-700 -mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1.5 text-left text-sm text-slate-700 focus-visible:outline-2 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <Toaster position="bottom-center" />
    </main>
  );
}
