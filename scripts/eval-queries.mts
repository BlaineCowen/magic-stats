/**
 * End-to-end accuracy check for the text-to-SQL pipeline, per sport.
 * Each case has a hand-written reference SQL; the expected values come from
 * running it against the local data, and the app's answer (via /api/query)
 * must contain them. Cases live in scripts/eval/<sport>.mts.
 *
 *   npx tsx scripts/eval-queries.mts [--sport nba] [--mode deep] [--only 3,7] [--url http://localhost:3002]
 *
 * AUTH_PROXY_SECRET must match the server's, so the run gets the owner tier
 * and isn't stopped by the hourly limit.
 */
import { runSafeSelect, type Row } from "../src/lib/sports/db";
import { isSport } from "../src/lib/sports/types";
import type { Case, Expect } from "./eval/types.mts";

function argVal(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = argVal("--url") ?? "http://localhost:3002";
const sportArg = argVal("--sport") ?? "nfl";
if (!isSport(sportArg)) throw new Error(`Unknown sport: ${sportArg}`);
const sport = sportArg;
const { CASES } = (await import(`./eval/${sport}.mts`)) as { CASES: Case[] };
const mode = argVal("--mode") ?? "fast";
const only = argVal("--only")?.split(",").map(Number);

const near = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005);

function check(rows: Row[], exp: Expect, scope: Case["scope"]) {
  const pool = scope === "top1" ? rows.slice(0, 1) : rows;
  const cells = pool.flatMap((r) => Object.values(r));
  const missing: string[] = [];
  for (const s of exp.strings ?? []) {
    if (
      !cells.some(
        (c) =>
          typeof c === "string" && c.toLowerCase().includes(s.toLowerCase()),
      )
    )
      missing.push(s);
  }
  const hasStr = (s: string) =>
    cells.some(
      (c) => typeof c === "string" && c.toLowerCase().includes(s.toLowerCase()),
    );
  if (exp.oneOf && !exp.oneOf.some(hasStr))
    missing.push(`one of ${exp.oneOf.join(" / ")}`);
  for (const n of exp.numbers ?? []) {
    // Percentages may come back as 0-1 or 0-100.
    if (
      !cells.some(
        (c) =>
          typeof c === "number" &&
          (near(c, n) || near(c, n * 100) || near(c * 100, n)),
      )
    ) {
      missing.push(String(Math.round(n * 1000) / 1000));
    }
  }
  return missing;
}

type ChartGot = { type: string; x: string; y: string; series: string } | null;

function checkChart(got: ChartGot, want: Case["chart"]): string[] {
  if (want === "any") return [];
  if (!want) return got ? [`no chart (got ${got.type})`] : [];
  if (!got) return [`${want.type} chart (got none)`];
  const miss: string[] = [];
  if (got.type !== want.type) miss.push(`${want.type} chart (got ${got.type})`);
  for (const k of ["x", "y", "series"] as const) {
    const re = want[k];
    if (re && !re.test(got[k]))
      miss.push(`${k} ~ ${String(re)} (got "${got[k]}")`);
  }
  return miss;
}

const tally = { sql: { pass: 0, total: 0 }, chart: { pass: 0, total: 0 } };
const times: number[] = [];
for (const [i, c] of CASES.entries()) {
  if (only && !only.includes(i + 1)) continue;
  const kind = c.chart && c.chart !== "any" ? "chart" : "sql";
  tally[kind].total++;
  const exp =
    c.ref && c.pick ? c.pick((await runSafeSelect(sport, c.ref)).rows) : null;
  const t = Date.now();
  const res = await fetch(`${url}/api/query`, {
    method: "POST",
    // Owner tier so a full run isn't stopped by the per-hour limit; the server
    // must share AUTH_PROXY_SECRET with this process (see src/lib/query-limits.ts).
    headers: {
      "Content-Type": "application/json",
      "x-authentik-username": "eval",
      "x-blaine-tier": "owner",
      "x-blaine-auth": process.env.AUTH_PROXY_SECRET ?? "",
    },
    body: JSON.stringify({ query: c.q, mode, sport, nocache: true }),
  });
  const data = (await res.json()) as {
    results?: Row[];
    error?: string;
    sql?: string;
    attempts?: unknown[];
    cached?: boolean;
    chart?: ChartGot;
    chart_source?: string | null;
  };
  const ms = Date.now() - t;
  times.push(ms);
  const missing = data.results
    ? [
        ...(exp ? check(data.results, exp, c.scope ?? "any") : []),
        ...checkChart(data.chart ?? null, c.chart),
      ]
    : ["<error>"];
  const ok = missing.length === 0;
  if (ok) tally[kind].pass++;
  const chart = data.chart
    ? `${data.chart.type}(${data.chart_source ?? "?"})`
    : "none";
  console.log(
    `${ok ? "PASS" : "FAIL"} ${String(i + 1).padStart(2)} ${(ms / 1000).toFixed(1).padStart(5)}s tries=${data.attempts?.length ?? "?"} chart=${chart}${data.cached ? " (cached)" : ""}  ${c.q}`,
  );
  if (!ok) {
    console.log(
      `       expected ${exp ? JSON.stringify(exp) : "-"} missing ${JSON.stringify(missing)}`,
    );
    if (data.error) console.log(`       error: ${data.error.split("\n")[0]}`);
    console.log(`       sql: ${data.sql}`);
    if (data.chart) console.log(`       chart: ${JSON.stringify(data.chart)}`);
    if (data.results)
      console.log(`       got: ${JSON.stringify(data.results.slice(0, 2))}`);
  }
}
times.sort((a, b) => a - b);
const pass = tally.sql.pass + tally.chart.pass;
const total = tally.sql.total + tally.chart.total;
console.log(
  `\n${pass}/${total} passed (${Math.round((100 * pass) / total)}%), median ${(times[Math.floor(times.length / 2)]! / 1000).toFixed(1)}s, max ${(times.at(-1)! / 1000).toFixed(1)}s`,
);
console.log(
  `sql cases ${tally.sql.pass}/${tally.sql.total}, chart cases ${tally.chart.pass}/${tally.chart.total}`,
);
