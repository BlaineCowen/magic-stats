/**
 * End-to-end accuracy check for the text-to-SQL pipeline.
 * Each case has a hand-written reference SQL; the expected values come from
 * running it against the local data, and the app's answer (via /api/query)
 * must contain them.
 *
 *   npx tsx scripts/eval-nfl-queries.mts [--mode deep] [--only 3,7] [--url http://localhost:3002]
 */
import { runSafeSelect, type Row } from "../src/lib/nfl/db";
import type { ChartType } from "../src/lib/nfl/chart-spec";

type Expect = { strings?: string[]; oneOf?: string[]; numbers?: number[] };

/** Every name tied with the leader (reference SQL must ORDER BY v DESC without LIMIT 1). */
const leaders = (r: Row[]): Expect => ({
  oneOf: r.filter((x) => x.v === r[0]!.v).map((x) => String(x.n)),
  numbers: [Number(r[0]!.v)],
});

type ChartExpect = { type: ChartType; x?: RegExp; y?: RegExp; series?: RegExp };

type Case = {
  q: string;
  // Hand-written reference SQL and the values the answer must contain.
  // Optional: chart cases may only check the chart.
  ref?: string;
  // `oneOf`: at least one must appear (for ties at the top of a leaderboard).
  pick?: (rows: Row[]) => Expect;
  // "top1": expected values must be in the answer's first row; "any": anywhere.
  scope?: "top1" | "any";
  /** Omitted: the answer must come back without a chart. "any": not checked. */
  chart?: ChartExpect | "any";
};

const CASES: Case[] = [
  {
    q: "Who threw the most passing touchdowns in 2024?",
    ref: "SELECT player_display_name n, SUM(passing_tds) v FROM player_week WHERE season=2024 AND season_type='REG' GROUP BY player_id, n ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Most rushing touchdowns in a single season since 2015",
    ref: "SELECT player_display_name n, season s, SUM(rushing_tds) v FROM player_week WHERE season>=2015 AND season_type='REG' GROUP BY player_id, n, s ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "How many rushing yards did Derrick Henry have in 2020?",
    ref: "SELECT SUM(rushing_yards) v FROM player_week WHERE player_display_name='Derrick Henry' AND season=2020 AND season_type='REG'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Which team scored the most points in the 2023 regular season?",
    ref: "WITH t AS (SELECT home_team team, home_score pts FROM games WHERE season=2023 AND game_type='REG' UNION ALL SELECT away_team, away_score FROM games WHERE season=2023 AND game_type='REG') SELECT team n, SUM(pts) v FROM t GROUP BY team ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Which offense had the best EPA per play in 2024?",
    ref: "SELECT posteam n FROM pbp WHERE season=2024 AND season_type='REG' AND play_type IN ('pass','run') GROUP BY posteam ORDER BY AVG(epa) DESC LIMIT 1",
    pick: (r) => ({ strings: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "Highest completion percentage in 2023 among QBs with at least 300 attempts",
    ref: "SELECT player_display_name n FROM player_week WHERE season=2023 AND season_type='REG' GROUP BY player_id, n HAVING SUM(attempts)>=300 ORDER BY SUM(completions)/SUM(attempts) DESC LIMIT 1",
    pick: (r) => ({ strings: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "How many regular season games did the Bills win in 2024?",
    ref: "SELECT SUM(CASE WHEN (home_team='BUF' AND home_score>away_score) OR (away_team='BUF' AND away_score>home_score) THEN 1 ELSE 0 END) v FROM games WHERE season=2024 AND game_type='REG'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "How many receptions did Travis Kelce have in the 2023 playoffs?",
    ref: "SELECT SUM(receptions) v FROM player_week WHERE player_display_name='Travis Kelce' AND season=2023 AND season_type='POST'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Which player had the most targets in 2022?",
    ref: "SELECT player_display_name n, SUM(targets) v FROM player_week WHERE season=2022 AND season_type='REG' GROUP BY player_id, n ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Who threw the most interceptions in 2021?",
    ref: "SELECT player_display_name n, SUM(passing_interceptions) v FROM player_week WHERE season=2021 AND season_type='REG' GROUP BY player_id, n ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Which defense had the most sacks in 2024?",
    ref: "SELECT team n, SUM(def_sacks) v FROM team_week WHERE season=2024 AND season_type='REG' GROUP BY team ORDER BY v DESC LIMIT 1",
    pick: (r) => ({ strings: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "What was the longest made field goal in 2023?",
    ref: "SELECT MAX(kick_distance) v FROM pbp WHERE season=2023 AND field_goal_result='made'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Lions points per game at home vs away in 2024",
    ref: "SELECT AVG(CASE WHEN home_team='DET' THEN home_score END) h, AVG(CASE WHEN away_team='DET' THEN away_score END) a FROM games WHERE season=2024 AND game_type='REG' AND 'DET' IN (home_team, away_team)",
    pick: (r) => ({ numbers: [Number(r[0]!.h), Number(r[0]!.a)] }),
    scope: "any",
    chart: "any",
  },
  {
    q: "Who leads the league in rushing yards this season?",
    ref: "SELECT player_display_name n FROM player_week WHERE season=(SELECT max(season) FROM pbp) AND season_type='REG' GROUP BY player_id, n ORDER BY SUM(rushing_yards) DESC LIMIT 1",
    pick: (r) => ({ strings: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "Patrick Mahomes EPA per dropback by season",
    ref: "SELECT ROUND(AVG(epa),3) v FROM pbp WHERE passer_full_name='Patrick Mahomes' AND qb_dropback=1 AND season=2022 AND season_type='REG'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
    chart: "any",
  },
  {
    q: "Which teams had the best third down conversion rate in 2023?",
    ref: "SELECT posteam n FROM pbp WHERE season=2023 AND season_type='REG' AND posteam IS NOT NULL GROUP BY posteam ORDER BY SUM(third_down_converted)/(SUM(third_down_converted)+SUM(third_down_failed)) DESC LIMIT 1",
    pick: (r) => ({ strings: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "CJ Stroud's 10 longest completions by air yards in 2024",
    ref: "SELECT MAX(air_yards) v FROM pbp WHERE passer_full_name='C.J. Stroud' AND season=2024 AND complete_pass=1",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Running backs in 2024 with at least 100 carries ranked by rushing EPA per carry",
    ref: "SELECT player_display_name n FROM player_week WHERE season=2024 AND season_type='REG' AND position='RB' GROUP BY player_id, n HAVING SUM(carries)>=100 ORDER BY SUM(rushing_epa)/SUM(carries) DESC LIMIT 1",
    pick: (r) => ({ strings: [String(r[0]!.n)] }),
    scope: "top1",
  },
  // Chart cases: the question asks for a chart; check its type and axes.
  {
    q: "QB CPOE vs EPA per play over the last 2 seasons",
    chart: { type: "scatter", x: /cpoe/, y: /epa/ },
  },
  {
    q: "Team offensive EPA per play vs defensive EPA per play in 2025",
    chart: { type: "scatter", x: /epa/, y: /epa/ },
  },
  {
    q: "Chart the Chiefs EPA per play by season since 2015",
    chart: { type: "line", x: /season/, y: /epa/ },
  },
  {
    q: "Graph the Ravens and Bengals points per game each season since 2019",
    chart: { type: "line", x: /season/, series: /team/ },
  },
  {
    q: "Top 15 wide receivers by receiving yards in 2025 as a bar chart",
    chart: { type: "bar", y: /yard/ },
  },
  {
    q: "Plot Josh Allen passing yards by week in 2025",
    chart: { type: "line", x: /week/, y: /yard/ },
  },
];

function argVal(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const url = argVal("--url") ?? "http://localhost:3002";
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
    c.ref && c.pick ? c.pick((await runSafeSelect(c.ref)).rows) : null;
  const t = Date.now();
  const res = await fetch(`${url}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: c.q, mode, nocache: true }),
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
