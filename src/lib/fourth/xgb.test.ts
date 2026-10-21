import assert from "node:assert/strict";
import { test } from "node:test";
import { loadJson, predictBinary, predictSoftmax, type XgbModel } from "./xgb";

type Fixture = { x: (number | null)[]; p: number[] };
const fixtures =
  loadJson<Record<"wp" | "go" | "fg", Fixture[]>>("fixtures.json");

// predictions from Python's xgboost, written by scripts/fourth-down/export.py
for (const name of ["wp", "fg"] as const) {
  test(`${name} model matches xgboost`, () => {
    const model = loadJson<XgbModel>(`${name}.json`);
    for (const f of fixtures[name]) {
      assert.ok(
        Math.abs(predictBinary(model, f.x) - f.p[0]!) < 1e-5,
        `${predictBinary(model, f.x)} vs ${f.p[0]}`,
      );
    }
  });
}

test("go model matches xgboost", () => {
  const model = loadJson<XgbModel>("go.json");
  for (const f of fixtures.go) {
    const p = predictSoftmax(model, f.x);
    p.forEach((v, i) =>
      assert.ok(Math.abs(v - f.p[i]!) < 1e-5, `class ${i}: ${v} vs ${f.p[i]}`),
    );
  }
});
