import { test } from "node:test";
import assert from "node:assert/strict";
import { balancers, bestLineup, curve, DEFAULT_SETTINGS, gradeTrade, letter, sampleTrades, withTePremium, type ValuedPlayer } from "./trade-grade";

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

test("sample trades: real rosters, every kind, none the other team would refuse", () => {
  const target = pool[30]!;
  const mine = [pool[28]!, pool[31]!, pool[45]!, pool[50]!, pool[60]!, pool[70]!, pool[5]!];
  const theirs = [target, pool[90]!, pool[120]!];
  const out = sampleTrades(target, mine, theirs, pool, DEFAULT_SETTINGS);
  const kinds = new Set(out.map((t) => t.kind));
  for (const k of ["1-for-1", "1-for-2", "2-for-1", "2-for-2"]) assert.ok(kinds.has(k as never), k);
  for (const t of out) {
    assert.ok(t.get[0] === target);
    assert.ok(t.give.every((p) => mine.includes(p)));
    assert.ok(t.get.slice(1).every((p) => theirs.includes(p)));
    assert.ok(t.edge <= 0.05 && t.edge >= -0.15, `${t.kind} edge ${t.edge}`);
    if (t.kind === "2-for-1") assert.ok(t.give.every((p) => p.value < target.value));
    if (t.kind === "1-for-2") assert.ok(t.get[1]!.value <= target.value);
    if (t.kind === "throw-in") assert.ok(t.get[1]!.value > target.value);
    if (t.kind === "2-for-2") assert.ok(t.give.length === 2 && t.get.length === 2);
  }
  // The star is never thrown into a 2-for-1 for a lesser player.
  assert.ok(!out.some((t) => t.kind === "2-for-1" && t.give.includes(pool[5]!)));
  // A player appears at most once per kind.
  for (const k of kinds) {
    const ids = out.filter((t) => t.kind === k).flatMap((t) => t.give.map((p) => p.id));
    assert.equal(ids.length, new Set(ids).size);
  }
});

test("sample trades: nothing on your roster comes close, nothing suggested", () => {
  assert.deepEqual(sampleTrades(pool[0]!, [pool[150]!, pool[160]!], [pool[0]!], pool, DEFAULT_SETTINGS), []);
});

test("sample trades: a cheap player rides along in a bigger deal", () => {
  const out = sampleTrades(pool[60]!, [pool[0]!], [pool[60]!, pool[10]!], pool, DEFAULT_SETTINGS);
  const t = out.find((o) => o.kind === "throw-in");
  assert.ok(t);
  assert.deepEqual(t.get, [pool[60], pool[10]]);
});

const SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "BN", "BN"];
const Q = (id: string, pos: string, value: number): ValuedPlayer => ({ id, name: id, pos, team: null, age: null, value });

test("best lineup: fills narrow slots first, flex from what's left, bench counts a little", () => {
  const r = [Q("qb", "QB", 50), Q("rb1", "RB", 90), Q("rb2", "RB", 80), Q("rb3", "RB", 70), Q("wr1", "WR", 60), Q("wr2", "WR", 55), Q("te", "TE", 40), Q("te2", "TE", 30), Q("rb4", "RB", 10)];
  const l = bestLineup(r, SLOTS);
  assert.equal(l.slotOf.get("rb3"), "FLEX");
  assert.equal(l.slotOf.get("te2"), "SUPER_FLEX");
  assert.ok(!l.slotOf.has("rb4"));
  assert.equal(Math.round(l.strength), 50 + 90 + 80 + 70 + 60 + 55 + 40 + 30 + 2);
});

test("lineup check: no tight ends for a team that starts the league's best one", () => {
  // They start a star TE and have a weak WR room; you have two TEs and a decent WR.
  const target = Q("their-wr", "WR", 6000);
  const theirs = [target, Q("t-qb", "QB", 9000), Q("t-qb2", "QB", 7000), Q("t-rb", "RB", 8000), Q("t-rb2", "RB", 7000), Q("t-wr2", "WR", 1500), Q("t-wr3", "WR", 1200), Q("star-te", "TE", 9000), Q("t-rb3", "RB", 1000)];
  const mine = [Q("m-qb", "QB", 8000), Q("m-qb2", "QB", 6000), Q("m-rb", "RB", 9000), Q("m-rb2", "RB", 8000), Q("m-wr", "WR", 6200), Q("m-wr2", "WR", 3000), Q("te-a", "TE", 5500), Q("te-b", "TE", 2300)];
  const pool2 = [...theirs, ...mine].sort((a, b) => b.value - a.value);
  const plain = sampleTrades(target, mine, theirs, pool2, DEFAULT_SETTINGS);
  const checked = sampleTrades(target, mine, theirs, pool2, DEFAULT_SETTINGS, 3, SLOTS);
  const twoTes = (t: { give: ValuedPlayer[] }) => t.give.every((p) => p.pos === "TE");
  assert.ok(plain.some(twoTes), "value alone suggests the two TEs");
  assert.ok(!checked.some(twoTes), "the lineup check drops them");
  for (const t of checked) assert.ok(t.lineup && t.lineup.theirGain > 0);
});

test("crowd check: ideas look fair by their values, best for you by yours come first", () => {
  // You value t0 well above what the crowd does; the crowd loves m1.
  const yours = [P("m1", 3000), P("m2", 2800), P("m3", 1000)];
  const target = P("t0", 6000);
  const theirs = [target, P("t1", 500)];
  const myPool = [...pool, ...yours, target].sort((a, b) => b.value - a.value);
  const crowd = [P("t0", 3200), P("m1", 3400), P("m2", 1500), P("m3", 900), P("t1", 500), ...pool.slice(60)]
    .sort((a, b) => b.value - a.value);
  const ideas = sampleTrades(target, yours, theirs, myPool, DEFAULT_SETTINGS, 3, undefined, crowd);
  assert.ok(ideas.length > 0);
  for (const t of ideas) {
    assert.ok(t.market, "graded by the crowd too");
    assert.ok(t.market.edge <= 0.05, "the other team doesn't lose by its own values");
    assert.ok(t.edge >= -0.05, "you don't lose by yours");
  }
  const ones = ideas.filter((t) => t.kind === "1-for-1");
  assert.deepEqual(ones.map((t) => t.give[0]!.id), ["m1"]);
  // Sorted by your edge, biggest first.
  for (let i = 1; i < ideas.length; i++)
    if (ideas[i]!.kind === ideas[i - 1]!.kind) assert.ok(ideas[i - 1]!.edge >= ideas[i]!.edge);
});
