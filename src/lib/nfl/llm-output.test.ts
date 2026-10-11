import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  extractChartBlock,
  extractSqlBlock,
  parseFast,
  toChartPick,
} from "./llm-output";

describe("parseFast", () => {
  test("reads plan, sql and chart", () => {
    const chart = {
      type: "bar",
      x: "",
      y: "v",
      label: "n",
      series: "",
      title: "",
    };
    assert.deepEqual(
      parseFast(JSON.stringify({ plan: "p", sql: "SELECT 1", chart })),
      {
        plan: "p",
        sql: "SELECT 1",
        chart,
      },
    );
  });

  test("a missing chart is null", () => {
    assert.equal(parseFast('{"plan": "p", "sql": "SELECT 1"}').chart, null);
  });

  test("salvages sql from truncated JSON, without a chart", () => {
    assert.deepEqual(
      parseFast(
        '{"plan": "p", "sql": "SELECT \\"a\\" FROM t", "chart": {"type": "sca',
      ),
      { plan: null, sql: 'SELECT "a" FROM t', chart: null },
    );
  });
});

describe("toChartPick", () => {
  test("rejects unknown types and non-objects, fills missing fields", () => {
    assert.equal(toChartPick({ type: "pie" }), null);
    assert.equal(toChartPick("scatter"), null);
    assert.equal(toChartPick(null), null);
    assert.deepEqual(toChartPick({ type: "line", x: " season ", y: "epa" }), {
      type: "line",
      x: "season",
      y: "epa",
      label: "",
      series: "",
      title: "",
    });
  });
});

describe("deep-mode blocks", () => {
  const reply = [
    "Thinking about it...",
    "```sql",
    "SELECT season, epa FROM t",
    "```",
    "```json",
    '{"type": "line", "x": "season", "y": "epa", "label": "", "series": "", "title": ""}',
    "```",
  ].join("\n");

  test("the sql block wins over a later json block", () => {
    assert.equal(extractSqlBlock(reply), "SELECT season, epa FROM t");
  });

  test("the chart comes from the json block", () => {
    assert.equal(extractChartBlock(reply)?.type, "line");
  });

  test("unlabeled fences and bare SQL still work", () => {
    assert.equal(extractSqlBlock("```\nSELECT 1\n```"), "SELECT 1");
    assert.equal(
      extractSqlBlock("WITH a AS (SELECT 1) SELECT * FROM a"),
      "WITH a AS (SELECT 1) SELECT * FROM a",
    );
    assert.equal(extractSqlBlock("no sql here"), null);
    assert.equal(extractChartBlock("```sql\nSELECT 1\n```"), null);
    assert.equal(extractChartBlock("```json\n{not json\n```"), null);
  });
});
