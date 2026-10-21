import assert from "node:assert/strict";
import { test } from "node:test";
import { decide } from "./engine";
import { DEFAULT_SITUATION } from "./params";
import {
  afterFirstPossession,
  LEAGUE_AVG,
  receiveFirst,
  suddenDeath,
} from "./overtime";

const at = (o: Partial<typeof DEFAULT_SITUATION>) =>
  decide({ ...DEFAULT_SITUATION, ...o });

test("textbook calls", () => {
  // 4th & 1 near midfield in the first quarter: go
  assert.equal(
    at({ qtr: 1, clock: 600, scoreDiff: 0, ydstogo: 1, yardline: 45 }).best,
    "go",
  );
  // 4th & 12 at your own 20: punt
  assert.equal(
    at({ qtr: 2, clock: 600, scoreDiff: 0, ydstogo: 12, yardline: 80 }).best,
    "punt",
  );
  // 4th & 8 at the opponent's 15, first quarter: kick
  assert.equal(
    at({ qtr: 1, clock: 600, scoreDiff: 0, ydstogo: 8, yardline: 15 }).best,
    "fg",
  );
  // down 3, 4th & goal at the 8, final seconds: kick and take overtime
  assert.equal(
    at({
      qtr: 4,
      clock: 3,
      scoreDiff: -3,
      ydstogo: 8,
      yardline: 8,
      offTimeouts: 0,
    }).best,
    "fg",
  );
  // ...but from the 2, a ~54% touchdown beats a 50/50 overtime
  assert.equal(
    at({
      qtr: 4,
      clock: 3,
      scoreDiff: -3,
      ydstogo: 2,
      yardline: 2,
      offTimeouts: 0,
    }).best,
    "go",
  );
  // down 5, 4th & 3 at the 30 with a minute left: only a touchdown helps
  assert.equal(
    at({ qtr: 4, clock: 60, scoreDiff: -5, ydstogo: 3, yardline: 30 }).best,
    "go",
  );
});

test("probabilities are sane", () => {
  const d = at({});
  for (const o of d.options)
    assert.ok(o.wp > 0 && o.wp < 1, `${o.key} ${o.wp}`);
  const go = d.options.find((o) => o.key === "go")!;
  assert.ok(go.wpSuccess! > go.wpFail!);
  assert.ok(Math.abs(d.goGains.reduce((a, b) => a + b, 0) - 1) < 1e-6);
});

test("overtime possession model", () => {
  // with identical teams, receiving first is close to a coin flip under the 2022 rules
  const r = receiveFirst(LEAGUE_AVG, "a");
  assert.ok(r > 0.45 && r < 0.6, String(r));
  assert.ok(suddenDeath(0.4, 0.4) > 0.5);
  // a first-drive TD is worth more than a FG, which is worth more than nothing
  assert.ok(
    afterFirstPossession(LEAGUE_AVG, "a", "td") >
      afterFirstPossession(LEAGUE_AVG, "a", "fg"),
  );
  assert.ok(
    afterFirstPossession(LEAGUE_AVG, "a", "fg") >
      afterFirstPossession(LEAGUE_AVG, "a", "none"),
  );
});
