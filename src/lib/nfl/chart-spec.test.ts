import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  classifyColumns,
  isSorted,
  validateSpec,
  type ChartPick,
  type ChartRow,
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
