import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mlToProb,
  normCdf,
  optimize,
  rankByOdds,
  winProb,
  type OptGame,
} from "./optimizer";

test("moneylines and spreads turn into win probabilities", () => {
  assert.equal(mlToProb(-150), 0.6);
  assert.equal(mlToProb(150), 0.4);
  // -155 / +130 de-vigged
  const p = winProb(-155, 130, null);
  assert.equal(p.source, "moneyline");
  assert.ok(p.pHome > 0.58 && p.pHome < 0.6);
  // Home favoured by 3 with no moneyline: about 58%.
  const s = winProb(null, null, -3);
  assert.equal(s.source, "spread");
  assert.ok(Math.abs(s.pHome - 0.586) < 0.01);
  assert.equal(winProb(null, null, null).pHome, 0.5);
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-9);
});

const games: OptGame[] = [
  { id: "a", pHome: 0.85, officeHomeShare: 0.95 },
  { id: "b", pHome: 0.3, officeHomeShare: 0.2 },
  { id: "c", pHome: 0.55, officeHomeShare: 0.9 },
  { id: "d", pHome: 0.65, officeHomeShare: 0.7 },
];

test("rankByOdds picks favourites with the surest game worth the most", () => {
  const e = rankByOdds(games);
  assert.deepEqual(e.picks, { a: "home", b: "away", c: "home", d: "home" });
  assert.equal(e.points.a, 4);
  assert.equal(e.points.c, 1);
});

test("optimize returns a full permutation and keeps pinned games", () => {
  const r = optimize(games, 20, {
    sims: 1500,
    finalSims: 3000,
    pinned: new Set(["c"]),
    current: { picks: { c: "away" }, points: { c: 4 } },
  });
  assert.deepEqual(
    Object.values(r.entry.points).sort((x, y) => x - y),
    [1, 2, 3, 4],
  );
  assert.equal(r.entry.picks.c, "away");
  assert.equal(r.entry.points.c, 4);
  assert.ok(r.winProb >= 0 && r.winProb <= 1);
});
