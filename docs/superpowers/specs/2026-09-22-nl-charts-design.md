# Charts from Natural-Language Questions — Design Spec

**Date:** 2026-09-22
**Project:** magic-stats NFL query page (`/`, `/testing`)

---

## Context

The Ask page turns a question into DuckDB SQL with the local qwen model and shows the rows as a table (`src/lib/nfl/pipeline.ts`). The `/charts` page draws two fixed rbsdm-style charts (team tiers, QB CPOE vs EPA/play) from hand-written SQL, using the SVG toolkit in `src/components/charts/chart-kit.tsx`.

Nothing connects the two: you can't ask "QB CPOE vs EPA/play over the last 2 seasons" and get a chart, and you can't chart any stat pair outside the two built-ins.

## What We're Building

Chart questions typed into the existing Ask box return a chart above the usual table.

- **Chart types:** scatter (stat vs stat per player/team), line (a stat over seasons/weeks, one line per player/team), horizontal bar (ranking).
- **Chart choice:** the model picks the chart and its columns in the same call that writes the SQL. The server validates that pick against the returned rows and falls back to deterministic rules if it doesn't fit.
- **Light controls:** chart type, X/Y/series column dropdowns, labels on/off, PNG download, hide. All redraw from rows already loaded; no new model call.
- **"Chart this"** on any table-only result runs the same rules in the browser.

Out of scope: a full chart editor (titles, colors, axis ranges, annotations), a question box on `/charts`, and conversational follow-ups ("now do 2023").

---

## Chart Spec

New file `src/lib/nfl/chart-spec.ts`. No server imports and relative imports only, so it runs in the browser, on the server and under `node:test`.

```ts
export type ChartType = "scatter" | "line" | "bar";

export type ChartSpec = {
  type: ChartType;
  x: string;       // scatter: numeric column; line: season/week/date column; bar: unused ("")
  y: string;       // the plotted number (bar length for bars)
  label: string;   // point/bar name column; "" if none
  series: string;  // line only: one line per distinct value; "" if one line
  title: string;   // "" -> derived "Y vs X" / "Y by X" / "Y"
};

export type ChartSource = "model" | "inferred";
```

### Column classification (`classifyColumns(rows, columns)`)

Computed from the rows, not the SQL:

- **Hidden:** names ending `_id` (the table already hides these).
- **Numeric:** every non-null value is a number.
- **Time:** named `season`, `week`, `game_date`, `gameday`, or `year`. `season`/`week` are also numeric.
- **Sample size:** numeric and named like a count (`n_*`, `num_*`, `*plays`, `dropbacks`, `attempts`, `carries`, `targets`, `games`, `snaps`, `n`). The prompt rules require a sample-size column in every rate query, so these are deprioritized for axes but stay pickable in the dropdowns.
- **Metric:** numeric, not time, not sample size.
- **Text:** everything else. The first text column is the default label.

### Validation (`validateSpec(spec, rows, columns)`) → `ChartSpec | null`

- Every non-empty field names an existing, non-hidden column, and `x !== y`.
- **scatter:** `x`, `y` numeric; ≥ 3 rows with both non-null.
- **line:** `x` is a time column (or numeric); `y` numeric; ≥ 2 distinct `x` values. If `series` is set, it is a text column.
- **bar:** `y` numeric; `label` set (defaults to first text column if empty); ≥ 2 rows.
- Blank `label` on scatter defaults to the first text column.

### Inference (`inferSpec(question, rows, columns)`) → `ChartSpec | null`

1. **Intent from the question** (case-insensitive):
   - `vs`, `versus`, `scatter` → scatter.
   - `over time`, `trend`, `by season`, `by week`, `each season`, `each week`, `per season`, `per week` → line.
   - `top`, `most`, `best`, `worst`, `rank`, `leaders` → bar.
2. **Otherwise shape:**
   - A time column with ≥ 2 distinct values plus a metric → line.
   - ≥ 2 metrics → scatter.
   - A text column plus a metric → bar.
3. **Axis picks:**
   - Prefer metrics whose name tokens appear in the question: for "cpoe vs epa", the column containing `cpoe` is x and the one containing `epa` is y. Otherwise take metrics in column order.
   - Fall back to sample-size columns only if no metrics are left.
   - Bar `y` prefers the column the rows are sorted by (monotonic values), i.e. the query's `ORDER BY`.
   - Line `series` is the first text column that has more than one distinct value.
4. The result goes through `validateSpec`. If nothing validates, return `null`.

### Chart question detection (`asksForChart(question)`)

`chart|plot|graph|visuali[sz]e|scatter|trend|over time|\bvs\.?\b|versus`

Used server-side: if the model returned `"none"` but this matches, run `inferSpec`.

---

## Server

### Fast-mode output (`pipeline.ts`)

`FAST_FORMAT` becomes `{plan, sql, chart}`, in that order, so the chart is written after the SQL aliases exist. LM Studio's strict mode requires every property, so unused fields are `""`:

```json
"chart": {
  "type": "object",
  "properties": {
    "type":   { "type": "string", "enum": ["none", "scatter", "line", "bar"] },
    "x":      { "type": "string", "maxLength": 60 },
    "y":      { "type": "string", "maxLength": 60 },
    "label":  { "type": "string", "maxLength": 60 },
    "series": { "type": "string", "maxLength": 60 },
    "title":  { "type": "string", "maxLength": 80 }
  },
  "required": ["type", "x", "y", "label", "series", "title"]
}
```

- `maxTokens` 900 → 1000.
- `parseFast` returns the chart object (or `null` when missing or truncated).
- The truncated-JSON salvage path still recovers `sql` alone.

### Deep-mode output

- The deep prompt's OUTPUT line adds: after the ```sql block, a ```json block with the same chart object. Omit it if no chart.
- **Fix required:** `extractSqlBlock` currently takes the last fenced block of any language, which would become the JSON. It must prefer the last ```sql block and fall back to other fences only if none exist.
- New `extractChartBlock(text)` parses the last ```json block. If that fails, the chart is `null`.

### Choosing the chart (`answerQuestion`)

After a successful attempt:

1. `spec = validateSpec(attempt.chart)`; if valid → `chart_source: "model"`.
2. Otherwise, if the model's type was not `"none"`, or `asksForChart(question)` → `inferSpec(...)`, `chart_source: "inferred"`.
3. Otherwise `chart: null`.

Chart selection never throws; any error results in `chart: null`.

### Response additions (`PipelineResult`)

```ts
chart: ChartSpec | null;
chart_source: ChartSource | null;
/** Only when a chart is returned and a team column is present. */
team_colors?: Record<string, { color: string | null; color2: string | null }>;
```

- **Team column:** `team`, `posteam`, `defteam`, `opponent_team`, `home_team`, `away_team`, or the label column when all its values are team codes.
- **Team colors:** one `SELECT team_abbr, team_color, team_color2 FROM teams` via `runSafeSelect`, cached in memory per data version.
- **Attempts:** each `Attempt` also records its raw chart pick, for the `/testing` view.
- **Caching:** the query cache stores the whole result, so charts are cached too. The cache key is unchanged.

### Prompt (`prompt.ts`)

- **Season context** gains one line: `"Last N seasons" = the N most recent complete seasons` (2024–2025 while 2026 is in progress), plus "this season" when it's complete.
- **New CHARTS section** (fast and deep):
  - Set `chart.type` only if the question asks for a chart/plot/graph/visual, compares two stats ("X vs Y"), or asks for a trend over time. Otherwise `"none"` with empty fields.
  - `x`/`y`/`label`/`series` are column aliases from your own SELECT.
  - **scatter:** one row per player/team, both stats as columns, all qualifying rows (LIMIT 100, not 25), with a sensible minimum sample.
  - **line:** one row per season (or week) per player/team, ORDER BY the time column; `series` = the player/team column.
  - **bar:** 10–25 rows ordered by the metric.
- **Examples:** the 8 existing examples gain `"chart": {"type":"none",...}` with empty fields. Three chart examples are added:
  1. "QB CPOE vs EPA per play over the last 2 seasons, min 300 dropbacks" → scatter (x `cpoe`, y `epa_per_play`, label `passer_full_name`).
  2. "Chart the Bills and Chiefs point differential by season since 2018" → line (x `season`, y `point_diff`, series `team`).
  3. "Top 15 running backs by rushing EPA per carry in 2025, bar chart" → bar (y `epa_per_carry`, label `player_display_name`).

---

## Client

### `src/components/charts/chart-kit.tsx` (changes)

- Move `placeLabels`, `labelBox`, `overlaps` and a generic `regression(points, x, y)` here from `qb-chart.tsx`, and update `QbChart` to import them.
- `ChartSvg` accepts an optional `yCategories: string[]`. When set, it draws category names as y ticks, for horizontal bars.
- Add `PALETTE` (8 colors) for series that aren't teams, and `humanize(column)`:
  - Split the name on `_` and fix known terms: `epa`→EPA, `cpoe`→CPOE, `wpa`→WPA, `pct`→%, `ypa`→Y/A, `ypc`→Y/C, `adot`→aDOT.
  - Sentence-case the first word.

### New components (`src/components/charts/`)

- **`query-chart.tsx`:** props `{rows, columns, spec, teamColors, subtitle}`.
  - Owns control state, seeded from `spec` and reset when `spec` changes.
  - Renders the controls, the chosen plot and a local error boundary.
  - Each control change goes through `validateSpec`. If the new spec is invalid for the chosen type, it keeps the previous one and disables that option.
- **`scatter-plot.tsx`:**
  - Dots filled with team color (dark gray when there's no team or it's a multi-team value like `KC/NYJ`); logos when the label is a team code.
  - Non-overlapping names via `placeLabels`.
  - Dashed mean lines on x and y, plus a regression line.
  - Tooltip listing every visible column for the row.
  - Caps at 100 points, keeping the first 100 rows, with a footnote.
- **`line-plot.tsx`:**
  - One polyline per series; team color if the series is a team code, otherwise `PALETTE`.
  - Series name at the end of each line, with dots at each point and a tooltip.
  - Integer ticks for `season`/`week`.
  - Caps at 8 series (the first 8 by row order), with a footnote.
- **`bar-plot.tsx`:**
  - Horizontal bars in row order, i.e. the query's `ORDER BY`, so "lowest allowed" rankings stay lowest-first. "Chart this" and changing `y` re-sort descending by `y`.
  - Names on the y axis via `yCategories`, the value printed at the end of each bar, and a zero line when values straddle 0.
  - Team colors and logos as in the scatter.

Every plot drops rows with null values in the plotted columns and notes "N rows without values not shown" in the footnote. The footnote also carries `Data: nflverse` like `/charts`.

### Controls (in `query-chart.tsx`)

- Type buttons, disabled when invalid for these columns.
- **X** dropdown: numeric columns (time columns for line; hidden for bar).
- **Y** dropdown: numeric columns.
- **Series** dropdown (line only).
- Labels toggle, **Download PNG** (`downloadSvgAsPng`, filename from the title), **Hide chart**.

### `src/components/nfl-query.tsx` (changes)

- The `ApiResponse` type gains `chart`, `chart_source` and `team_colors`.
- State `chartSpec` is set from the response, cleared on each new query, and set by "Chart this".
- Layout:
  - The results block widens `max-w-3xl` → `max-w-5xl` while a chart is shown. The header and search box keep `max-w-3xl`.
  - Order: How this was answered → chart → table.
  - "How this was answered" mentions `chart picked by model` / `chart inferred`.
- **"Chart this"** sits next to the CSV button when there's no chart and `inferSpec("", rows, columns)` returns a spec. It sits next to "Show chart" after the chart is hidden.
- `/testing` (debug) also shows each attempt's raw chart pick.

---

## Error Handling

- Chart selection runs inside `try`; failure → `chart: null`, and the answer is unaffected.
- An invalid model pick → rules; no rule fits → table only.
- A render crash → the error boundary shows "Couldn't draw this chart", and the table still renders.
- Caps (100 points, 8 series) and dropped null rows are always stated in the chart footnote.

---

## Testing

1. **Baseline first:** before any prompt change, run `npx tsx scripts/eval-nfl-queries.mts` against the dev server and record the pass rate and median time.
2. **Unit tests:** `src/lib/nfl/chart-spec.test.ts` uses `node:test` and runs with `npx tsx --test src/lib/nfl/chart-spec.test.ts`. Add an npm `test` script with that command. Cases:
   - CPOE/EPA rows with `dropbacks` and `success_rate`: scatter x=cpoe, y=epa, never dropbacks.
   - Season rows with a `team` column holding 2 teams: line with series=team.
   - Top-15 leaderboard: bar, y = the sorted column.
   - Model pick naming a missing column: `validateSpec` → null; `inferSpec` recovers.
   - `asksForChart` true for "plot…", "X vs Y" and "trend"; false for "who led the league in…".
   - A single-row result: no chart.
   - Only sample-size numerics (e.g. `games`, `wins`): a bar still works.
3. **Eval script:** `Case` gains an optional `chart: {type, x?: RegExp, y?: RegExp, series?: RegExp}`, and `ref`/`pick` become optional for chart-only cases. The existing 18 cases also assert `chart === null`. About 6 chart cases are added:
   - QB CPOE vs EPA last 2 seasons: scatter, x `/cpoe/`, y `/epa/`.
   - Team offensive EPA/play vs defensive EPA/play in 2025: scatter, `/epa/` on both axes.
   - Chart the Chiefs EPA/play by season since 2015: line, x `/season/`.
   - Graph the Ravens and Bengals points per game each season since 2019: line, series `/team/`.
   - Top 15 WRs by receiving yards in 2025 as a bar chart: bar, y `/yard/`.
   - Plot Josh Allen passing yards by week in 2025: line, x `/week/`.
4. **Gate:** after the prompt change, the original 18 cases must pass at least at the baseline rate, and the chart cases should mostly pass. A drop on the original cases means the prompt gets reworked before shipping.
5. **Manual:**
   - In the preview (`:3002`), run the three prompt examples and "Chart this" on a plain leaderboard.
   - Change axes and type, and download a PNG.
   - Take a Playwright screenshot of each chart type.
6. `npm run check` passes.

---

## Files Created / Modified

| File | Change |
|---|---|
| `src/lib/nfl/chart-spec.ts` | new: types, classification, validation, inference |
| `src/lib/nfl/chart-spec.test.ts` | new: unit tests |
| `src/lib/nfl/pipeline.ts` | chart field in schema/parse, deep-mode chart block, `extractSqlBlock` fix, chart selection, team colors |
| `src/lib/nfl/prompt.ts` | "last N seasons", CHARTS section, chart examples, deep OUTPUT line |
| `src/app/api/query/route.ts` | none expected (passes the result through); verify |
| `src/components/charts/chart-kit.tsx` | shared label/regression helpers, `yCategories`, `PALETTE`, `humanize` |
| `src/components/charts/qb-chart.tsx` | import moved helpers |
| `src/components/charts/query-chart.tsx` | new |
| `src/components/charts/scatter-plot.tsx` | new |
| `src/components/charts/line-plot.tsx` | new |
| `src/components/charts/bar-plot.tsx` | new |
| `src/components/nfl-query.tsx` | response types, chart placement, widening, Chart this |
| `scripts/eval-nfl-queries.mts` | chart expectations + 6 chart cases |
| `package.json` | `test` script |

---

## Revisions During Planning (2026-09-22)

These supersede the sections above where they differ.

- **Preview port** is `:3002` (the `magic-stats-preview` container).
- **`team_colors`** comes back with every successful answer, not only chart answers, so "Chart this" can color a table-only result.
- **Pure helpers live in `chart-spec.ts`**, not `chart-kit.tsx`, so they're unit-tested: `humanize`, `chartTitle`, `shortLabel`, `formatCell`, `teamCode`, `labelsAreTeams`, `plotRows`.
- **Model-output parsing** (`parseFast`, `extractSqlBlock`, `extractChartBlock`, `toChartPick`) moves to a new pure `src/lib/nfl/llm-output.ts`, also unit-tested.
- **Line x must be numeric** (season, week, year). Date strings aren't supported.
- **Bars are capped at 30.** Bars keep row order when the rows are already sorted by `y`; otherwise they're sorted descending. This covers both "Chart this" and a changed Y.
- **Dataviz rules for the new charts:**
  - Label text uses ink colors, never the series color.
  - Bars don't print a value on every bar; hover and the table give exact values.
  - Bars have a 4px rounded data end and a gap between bars.
  - Lines are 2px with 8px markers and a crosshair tooltip.
  - Line charts with 2 or more series get a legend; end-of-line labels only when there are 4 or fewer series.
  - Non-team series use the validated categorical palette in fixed order: `#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #4a3aa7 #e34948`.
- **Chart placement:** directly under the Results header, above the table. "How this was answered" stays at the bottom where it is today.
- **Inference:**
  - "Chart this" passes the question text to `inferSpec`, so intent words still count.
  - Shape-based line detection requires the time column to be sorted, so a season-mixed leaderboard isn't drawn as lines.
  - `chooseChart` tries the model's chart type first when its columns were wrong.
- **Eval:** existing cases 13 (Lions home vs away) and 15 (Mahomes EPA by season) accept any chart. The other existing cases must return no chart.
- **Chart gate:** a chart comes back only when the question asks for one (`asksForChart`: chart/plot/graph/visualize/scatter/trend/over time/vs). The model's pick only chooses the columns; other answers offer "Chart this". Added after the prompt alone couldn't stop the 9B model charting plain leaderboards.
