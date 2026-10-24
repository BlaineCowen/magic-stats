import { test } from "node:test";
import assert from "node:assert/strict";
import { balancers, curve, DEFAULT_SETTINGS, gradeTrade, letter, withTePremium, type ValuedPlayer } from "./trade-grade";

const P = (id: string, value: number, pos = "WR"): ValuedPlayer => ({ id, name: id, pos, team: null, age: null, value });
// A pool of 200 players falling off from 10000.
const pool = Array.from({ length: 200 }, (_, i) => P(`p${i}`, Math.round(10000 * Math.exp(-i / 45))));

test("star curve: two halves are worth less than one star", () => {
  assert.equal(curve(10000, 10000), 10000);
  assert.ok(curve(5000, 10000) * 2 < 10000 * 0.85);
});

test("even swap is fair", () => {
  const r = gradeTrade([pool[10]!], [pool[11]!], pool, DEFAULT_SETTINGS)!;
  assert.equal(r.winner, null);
  assert.equal(r.a.grade, "B+");
});

test("2-for-1 for a star: the star side wins unless the pieces are big enough", () => {
  const star = pool[0]!;
  const r = gradeTrade([star], [pool[30]!, pool[31]!], pool, DEFAULT_SETTINGS)!;
  assert.equal(r.winner, "a"); // raw sum alone would say b (5132+5020 > 10000)
  assert.ok(r.b.raw > r.a.raw);
  assert.ok(r.a.spotCredit > 0 && r.b.spotCredit === 0);
});

test("lopsided trade grades F for the loser and suggests balancers", () => {
  const r = gradeTrade([pool[0]!], [pool[100]!], pool, DEFAULT_SETTINGS)!;
  assert.equal(r.b.grade, "F");
  assert.equal(r.a.grade, "A+");
  const add = balancers(r, pool, new Set(["p0", "p100"]));
  assert.ok(add.length > 0 && !add.some((p) => p.id === "p0"));
});

test("TE premium lifts tight ends only", () => {
  const out = withTePremium([P("t", 1000, "TE"), P("w", 1100)], 1);
  assert.equal(out[0]!.id, "t");
  assert.equal(out[0]!.value, 1300);
  assert.equal(out[1]!.value, 1100);
  assert.equal(letter(1), "B+");
});
