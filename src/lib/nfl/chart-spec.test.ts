import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asksForChart,
  chartIntent,
  chartTitle,
  chooseChart,
  classifyColumns,
  formatCell,
  humanize,
  inferSpec,
  isSorted,
  labelsAreTeams,
  plotRows,
  shortLabel,
  teamCode,
  validateSpec,
  type ChartPick,
  type ChartRow,
  type ChartSpec,
} from "./chart-spec";

const QB_COLS = [
  "passer_id",
  "passer_full_name",
  "team",
  "dropbacks",
  "cpoe",
  "epa_per_play",
  "success_rate",
];
export const QB_ROWS: ChartRow[] = [
  {
    passer_id: "00-1",
    passer_full_name: "Lamar Jackson",
    team: "BAL",
    dropbacks: 520,
    cpoe: 4.1,
    epa_per_play: 0.31,
    success_rate: 0.52,
  },
  {
    passer_id: "00-2",
    passer_full_name: "Joe Burrow",
    team: "CIN",
    dropbacks: 700,
    cpoe: 3.2,
    epa_per_play: 0.22,
    success_rate: 0.5,
  },
  {
    passer_id: "00-3",
    passer_full_name: "Josh Allen",
    team: "BUF",
    dropbacks: 560,
    cpoe: 1.1,
    epa_per_play: 0.2,
    success_rate: 0.49,
  },
  {
    passer_id: "00-4",
    passer_full_name: "Bryce Young",
    team: "CAR",
    dropbacks: 480,
    cpoe: -2.5,
    epa_per_play: -0.05,
    success_rate: 0.41,
  },
];

const LINE_COLS = ["season", "team", "point_diff", "games"];
export const LINE_ROWS: ChartRow[] = [2018, 2019, 2020].flatMap((season, i) => [
  { season, team: "BUF", point_diff: -105 + 100 * i, games: 16 },
  { season, team: "KC", point_diff: 144 - 10 * i, games: 16 },
]);

const BAR_COLS = [
  "player_display_name",
  "team",
  "carries",
  "rushing_yards",
  "epa_per_carry",
];
export const BAR_ROWS: ChartRow[] = [
  {
    player_display_name: "Kyren Williams",
    team: "LA",
    carries: 228,
    rushing_yards: 1144,
    epa_per_carry: 0.103,
  },
  {
    player_display_name: "Raheem Mostert",
    team: "MIA",
    carries: 209,
    rushing_yards: 1012,
    epa_per_carry: 0.082,
  },
  {
    player_display_name: "Christian McCaffrey",
    team: "SF",
    carries: 272,
    rushing_yards: 1459,
    epa_per_carry: 0.07,
  },
  {
    player_display_name: "James Cook",
    team: "BUF",
    carries: 237,
    rushing_yards: 1122,
    epa_per_carry: 0.01,
  },
];

// Same rows as QB_ROWS, reordered so cpoe/epa_per_play/success_rate are no
// longer monotonic (QB_ROWS itself is a sorted leaderboard: F10).
const QB_ROWS_UNSORTED: ChartRow[] = [
  {
    passer_id: "00-1",
    passer_full_name: "Lamar Jackson",
    team: "BAL",
    dropbacks: 520,
    cpoe: 4.1,
    epa_per_play: 0.31,
    success_rate: 0.52,
  },
  {
    passer_id: "00-3",
    passer_full_name: "Josh Allen",
    team: "BUF",
    dropbacks: 560,
    cpoe: 1.1,
    epa_per_play: 0.2,
    success_rate: 0.49,
  },
  {
    passer_id: "00-2",
    passer_full_name: "Joe Burrow",
    team: "CIN",
    dropbacks: 700,
    cpoe: 3.2,
    epa_per_play: 0.22,
    success_rate: 0.5,
  },
  {
    passer_id: "00-4",
    passer_full_name: "Bryce Young",
    team: "CAR",
    dropbacks: 480,
    cpoe: -2.5,
    epa_per_play: -0.05,
    success_rate: 0.41,
  },
];

const pick = (p: Partial<ChartPick>): ChartPick => ({
  type: "none",
  x: "",
  y: "",
  label: "",
  series: "",
  title: "",
  ...p,
});

describe("classifyColumns", () => {
  test("hides ids and separates metrics from sample sizes", () => {
    const cols = classifyColumns(QB_ROWS, QB_COLS);
    assert.deepEqual(
      cols.map((c) => c.name),
      [
        "passer_full_name",
        "team",
        "dropbacks",
        "cpoe",
        "epa_per_play",
        "success_rate",
      ],
    );
    const by = Object.fromEntries(cols.map((c) => [c.name, c]));
    assert.equal(by.dropbacks?.sample, true);
    assert.equal(by.dropbacks?.metric, false);
    assert.equal(by.cpoe?.metric, true);
    assert.equal(by.passer_full_name?.text, true);
  });

  test("season is a numeric time column, not a metric", () => {
    const season = classifyColumns(LINE_ROWS, LINE_COLS).find(
      (c) => c.name === "season",
    );
    assert.deepEqual(
      [season?.time, season?.numeric, season?.metric, season?.distinct],
      [true, true, false, 3],
    );
  });
});

describe("isSorted", () => {
  test("monotonic and not flat", () => {
    assert.equal(isSorted([3, 2, 2, 1]), true);
    assert.equal(isSorted([1, 2, 3]), true);
    assert.equal(isSorted([1, 3, 2]), false);
    assert.equal(isSorted([2, 2]), false);
    assert.equal(isSorted([1, null]), false);
  });
});

describe("validateSpec", () => {
  test("accepts a good scatter and fills the label", () => {
    assert.deepEqual(
      validateSpec(
        pick({ type: "scatter", x: "cpoe", y: "epa_per_play" }),
        QB_ROWS,
        QB_COLS,
      ),
      {
        type: "scatter",
        x: "cpoe",
        y: "epa_per_play",
        label: "passer_full_name",
        series: "",
        title: "",
      },
    );
  });

  test("rejects missing, hidden or repeated columns", () => {
    assert.equal(
      validateSpec(
        pick({ type: "scatter", x: "cpoe", y: "epa" }),
        QB_ROWS,
        QB_COLS,
      ),
      null,
    );
    assert.equal(
      validateSpec(
        pick({ type: "scatter", x: "cpoe", y: "cpoe" }),
        QB_ROWS,
        QB_COLS,
      ),
      null,
    );
    assert.equal(
      validateSpec(
        pick({ type: "bar", y: "epa_per_play", label: "passer_id" }),
        QB_ROWS,
        QB_COLS,
      ),
      null,
    );
  });

  test("rejects 'none' and too few rows", () => {
    assert.equal(validateSpec(pick({}), QB_ROWS, QB_COLS), null);
    assert.equal(
      validateSpec(
        pick({ type: "scatter", x: "cpoe", y: "epa_per_play" }),
        QB_ROWS.slice(0, 2),
        QB_COLS,
      ),
      null,
    );
  });

  test("a line needs a series when x repeats", () => {
    assert.equal(
      validateSpec(
        pick({ type: "line", x: "season", y: "point_diff" }),
        LINE_ROWS,
        LINE_COLS,
      ),
      null,
    );
    assert.equal(
      validateSpec(
        pick({ type: "line", x: "season", y: "point_diff", series: "team" }),
        LINE_ROWS,
        LINE_COLS,
      )?.series,
      "team",
    );
  });

  test("a bar defaults its label to the first text column", () => {
    assert.equal(
      validateSpec(
        pick({ type: "bar", y: "epa_per_carry" }),
        BAR_ROWS,
        BAR_COLS,
      )?.label,
      "player_display_name",
    );
  });

  test("a line needs at least 2 rows with both x and y present (F3)", () => {
    // season has 3 distinct values column-wide, but point_diff is only
    // present for one of them: too few plottable (x, y) points for a line,
    // even though the old x.distinct/keys checks (computed over all rows)
    // wouldn't have caught it.
    const rows: ChartRow[] = [
      { season: 2019, team: "KC", point_diff: 5 },
      { season: 2020, team: "KC", point_diff: null },
      { season: 2021, team: "KC", point_diff: null },
    ];
    assert.equal(
      validateSpec(
        pick({ type: "line", x: "season", y: "point_diff" }),
        rows,
        LINE_COLS,
      ),
      null,
    );
  });

  test("trims the title", () => {
    assert.equal(
      validateSpec(
        pick({
          type: "scatter",
          x: "cpoe",
          y: "epa_per_play",
          title: "  QBs ",
        }),
        QB_ROWS,
        QB_COLS,
      )?.title,
      "QBs",
    );
  });
});

describe("inferSpec", () => {
  test("CPOE vs EPA puts the named stats on the axes, never dropbacks", () => {
    const s = inferSpec(
      "QB CPOE vs EPA/play over the last 2 seasons",
      QB_ROWS,
      QB_COLS,
    );
    assert.deepEqual(
      [s?.type, s?.x, s?.y, s?.label],
      ["scatter", "cpoe", "epa_per_play", "passer_full_name"],
    );
  });

  test("with no question, two metrics make a scatter in column order", () => {
    const s = inferSpec("", QB_ROWS_UNSORTED, QB_COLS);
    assert.deepEqual(
      [s?.type, s?.x, s?.y],
      ["scatter", "cpoe", "epa_per_play"],
    );
  });

  test("a sorted leaderboard with no question makes a bar (F10)", () => {
    const s = inferSpec("", QB_ROWS, QB_COLS);
    assert.deepEqual(
      [s?.type, s?.y, s?.label],
      ["bar", "cpoe", "passer_full_name"],
    );
  });

  test("seasons by team make a line with a series", () => {
    const s = inferSpec(
      "Chart the Bills and Chiefs point differential by season since 2018",
      LINE_ROWS,
      LINE_COLS,
    );
    assert.deepEqual(
      [s?.type, s?.x, s?.y, s?.series],
      ["line", "season", "point_diff", "team"],
    );
  });

  test("a single team's seasons make one line", () => {
    const kc = LINE_ROWS.filter((r) => r.team === "KC");
    const s = inferSpec("Chiefs point differential by season", kc, LINE_COLS);
    assert.deepEqual([s?.type, s?.series], ["line", ""]);
  });

  test("a ranking makes a bar on the sorted column", () => {
    const s = inferSpec(
      "Top 15 running backs by rushing EPA per carry, bar chart",
      BAR_ROWS,
      BAR_COLS,
    );
    assert.deepEqual(
      [s?.type, s?.y, s?.label],
      ["bar", "epa_per_carry", "player_display_name"],
    );
  });

  test("a leaderboard with an unsorted season column is not a line", () => {
    const rows: ChartRow[] = [
      { player_display_name: "T.J. Watt", season: 2021, sacks: 22.5 },
      { player_display_name: "Michael Strahan", season: 2001, sacks: 22.5 },
      { player_display_name: "Jared Allen", season: 2011, sacks: 22 },
    ];
    const s = inferSpec("", rows, ["player_display_name", "season", "sacks"]);
    assert.deepEqual([s?.type, s?.y], ["bar", "sacks"]);
  });

  test("sample-size columns are used when there is nothing else", () => {
    const rows: ChartRow[] = [
      { team: "KC", games: 20 },
      { team: "BUF", games: 19 },
      { team: "DET", games: 18 },
    ];
    assert.deepEqual(inferSpec("", rows, ["team", "games"]), {
      type: "bar",
      x: "",
      y: "games",
      label: "team",
      series: "",
      title: "",
    });
  });

  test("a single row can't be charted", () => {
    assert.equal(inferSpec("plot it", QB_ROWS.slice(0, 1), QB_COLS), null);
  });
});

describe("asksForChart / chartIntent", () => {
  test("chart words", () => {
    for (const q of [
      "Plot Josh Allen passing yards by week",
      "QB CPOE vs EPA",
      "rushing trend since 2015",
      "graph the Ravens",
      "Visualize team EPA",
    ]) {
      assert.equal(asksForChart(q), true, q);
    }
    for (const q of [
      "Who led the league in rushing yards in 2024?",
      "Most sacks in a single season since 2010",
      "Chiefs record each season since 2020",
    ]) {
      assert.equal(asksForChart(q), false, q);
    }
  });

  test("'depth chart' isn't an explicit chart word, but 'plot' still is (F1)", () => {
    assert.equal(asksForChart("Chiefs depth chart"), false);
    assert.equal(asksForChart("Plot the depth chart counts"), true);
  });

  test("intent", () => {
    assert.equal(chartIntent("Top 15 WRs by yards as a bar chart"), "bar");
    assert.equal(chartIntent("CPOE vs EPA"), "scatter");
    assert.equal(chartIntent("Chiefs EPA by season"), "line");
    assert.equal(chartIntent("Points per game in 2024"), null);
  });
});

describe("chooseChart", () => {
  test("uses a valid model pick", () => {
    const r = chooseChart(
      "Plot CPOE vs EPA per play",
      pick({ type: "scatter", x: "cpoe", y: "epa_per_play" }),
      QB_ROWS,
      QB_COLS,
    );
    assert.equal(r.chart_source, "model");
  });

  test("falls back to rules when the pick names a missing column", () => {
    const r = chooseChart(
      "QB CPOE vs EPA",
      pick({ type: "scatter", x: "cpoe", y: "epa" }),
      QB_ROWS,
      QB_COLS,
    );
    assert.deepEqual(
      [r.chart_source, r.chart?.y],
      ["inferred", "epa_per_play"],
    );
  });

  test("keeps the model's chart type when inferring", () => {
    const r = chooseChart(
      "Chart the Bills and Chiefs point differential",
      pick({ type: "line", x: "year", y: "point_diff" }),
      LINE_ROWS,
      LINE_COLS,
    );
    assert.deepEqual(
      [r.chart?.type, r.chart?.x, r.chart?.series],
      ["line", "season", "team"],
    );
  });

  test("infers when the model said none but the question asks for a plot", () => {
    assert.equal(
      chooseChart("Plot CPOE vs EPA", pick({}), QB_ROWS, QB_COLS).chart_source,
      "inferred",
    );
  });

  test("no chart when neither the model nor the question wants one", () => {
    assert.deepEqual(
      chooseChart("Best QBs by EPA in 2024", pick({}), QB_ROWS, QB_COLS),
      {
        chart: null,
        chart_source: null,
      },
    );
  });

  test("ignores the model's pick when the question doesn't ask for a chart", () => {
    assert.deepEqual(
      chooseChart(
        "Best QBs by EPA in 2024",
        pick({ type: "scatter", x: "cpoe", y: "epa_per_play" }),
        QB_ROWS,
        QB_COLS,
      ),
      {
        chart: null,
        chart_source: null,
      },
    );
  });

  test("'vs' alone doesn't chart a non-scatter comparison (F1)", () => {
    const rows: ChartRow[] = [
      { week: 1, opponent_team: "BAL", passing_yards: 240, passing_tds: 2 },
      { week: 2, opponent_team: "CIN", passing_yards: 180, passing_tds: 1 },
      { week: 3, opponent_team: "DEN", passing_yards: 300, passing_tds: 3 },
    ];
    assert.deepEqual(
      chooseChart("How did Mahomes do vs the Ravens?", pick({}), rows, [
        "week",
        "opponent_team",
        "passing_yards",
        "passing_tds",
      ]),
      { chart: null, chart_source: null },
    );
  });

  test("'depth chart' doesn't gate a chart on its own (F1)", () => {
    const rows: ChartRow[] = [
      {
        full_name: "Rashee Rice",
        position: "WR",
        jersey_number: 4,
        height: 71,
      },
      {
        full_name: "Xavier Worthy",
        position: "WR",
        jersey_number: 1,
        height: 69,
      },
      {
        full_name: "JuJu Smith-Schuster",
        position: "WR",
        jersey_number: 9,
        height: 73,
      },
    ];
    assert.deepEqual(
      chooseChart("Chiefs depth chart at wide receiver", pick({}), rows, [
        "full_name",
        "position",
        "jersey_number",
        "height",
      ]),
      { chart: null, chart_source: null },
    );
  });

  test("'vs' with both columns named infers a scatter (F1)", () => {
    const r = chooseChart("QB CPOE vs EPA", pick({}), QB_ROWS, QB_COLS);
    assert.deepEqual(
      [r.chart_source, r.chart?.type, r.chart?.x, r.chart?.y],
      ["inferred", "scatter", "cpoe", "epa_per_play"],
    );
  });
});

describe("presentation helpers", () => {
  test("humanize", () => {
    assert.equal(humanize("epa_per_dropback"), "EPA per dropback");
    assert.equal(humanize("completion_pct"), "Completion %");
    assert.equal(humanize("cpoe"), "CPOE");
    assert.equal(humanize("passing_yards"), "Passing yards");
  });

  test("chartTitle", () => {
    const s: ChartSpec = {
      type: "scatter",
      x: "cpoe",
      y: "epa_per_play",
      label: "",
      series: "",
      title: "",
    };
    assert.equal(chartTitle(s), "EPA per play vs CPOE");
    assert.equal(
      chartTitle({ ...s, title: "QBs, 2024-2025" }),
      "QBs, 2024-2025",
    );
    assert.equal(
      chartTitle({ ...s, type: "line", x: "season" }),
      "EPA per play by season",
    );
    assert.equal(chartTitle({ ...s, type: "bar", x: "" }), "EPA per play");
  });

  test("shortLabel shortens player names only", () => {
    assert.equal(
      shortLabel("passer_full_name", "Patrick Mahomes"),
      "P.Mahomes",
    );
    assert.equal(
      shortLabel("team_name", "Kansas City Chiefs"),
      "Kansas City Chiefs",
    );
    assert.equal(shortLabel("team", "KC"), "KC");
    assert.equal(shortLabel("", undefined), "");
  });

  test("formatCell", () => {
    assert.equal(formatCell(0.12345), "0.123");
    assert.equal(formatCell(12.345), "12.3");
    assert.equal(formatCell(42), "42");
    assert.equal(formatCell(null), "–");
    assert.equal(formatCell(true), "Yes");
  });

  test("teamCode and labelsAreTeams", () => {
    const colors = {
      KC: { color: "#E31837", color2: "#FFB81C" },
      BUF: { color: "#00338D", color2: "#C60C30" },
    };
    const s: ChartSpec = {
      type: "bar",
      x: "",
      y: "point_diff",
      label: "team",
      series: "",
      title: "",
    };
    assert.equal(teamCode({ team: "KC" }, s, colors), "KC");
    assert.equal(teamCode({ team: "KC/NYJ" }, s, colors), null);
    // Inherited Object.prototype members (e.g. "constructor") aren't own
    // colors: F5.
    assert.equal(teamCode({ team: "constructor" }, s, colors), null);
    assert.equal(
      teamCode(
        { player: "X", posteam: "BUF" },
        { ...s, label: "player" },
        colors,
      ),
      "BUF",
    );
    assert.equal(
      labelsAreTeams([{ team: "KC" }, { team: "BUF" }], s, colors),
      true,
    );
    assert.equal(
      labelsAreTeams([{ team: "KC" }, { team: "Other" }], s, colors),
      false,
    );
  });
});

describe("plotRows", () => {
  test("drops rows missing a plotted value, with a note", () => {
    const rows: ChartRow[] = [
      ...QB_ROWS,
      { passer_full_name: "X", cpoe: null, epa_per_play: 0.1 },
    ];
    const spec: ChartSpec = {
      type: "scatter",
      x: "cpoe",
      y: "epa_per_play",
      label: "passer_full_name",
      series: "",
      title: "",
    };
    const out = plotRows(spec, rows);
    assert.equal(out.rows.length, 4);
    assert.deepEqual(out.notes, ["1 row without values not shown"]);
  });

  test("caps lines at 8 series", () => {
    const rows: ChartRow[] = Array.from({ length: 10 }, (_, t) =>
      [2020, 2021].map((season) => ({ season, team: `T${t}`, v: t })),
    ).flat();
    const out = plotRows(
      {
        type: "line",
        x: "season",
        y: "v",
        label: "",
        series: "team",
        title: "",
      },
      rows,
    );
    assert.equal(new Set(out.rows.map((r) => r.team)).size, 8);
    assert.deepEqual(out.notes, ["first 8 of 10 lines"]);
  });

  test("caps scatters at 100 points", () => {
    const rows: ChartRow[] = Array.from({ length: 120 }, (_, i) => ({
      n: `p${i}`,
      a: i,
      b: i * 2,
    }));
    const out = plotRows(
      { type: "scatter", x: "a", y: "b", label: "n", series: "", title: "" },
      rows,
    );
    assert.equal(out.rows.length, 100);
    assert.deepEqual(out.notes, ["first 100 of 120 rows"]);
  });

  test("bars keep a sorted query order, else sort descending", () => {
    const spec: ChartSpec = {
      type: "bar",
      x: "",
      y: "epa_per_carry",
      label: "player_display_name",
      series: "",
      title: "",
    };
    assert.deepEqual(
      plotRows(spec, BAR_ROWS).rows.map((r) => r.epa_per_carry),
      [0.103, 0.082, 0.07, 0.01],
    );
    assert.deepEqual(
      plotRows({ ...spec, y: "rushing_yards" }, BAR_ROWS).rows.map(
        (r) => r.rushing_yards,
      ),
      [1459, 1144, 1122, 1012],
    );
  });
});
