import assert from "node:assert/strict";
import { test } from "node:test";
import { formatValue } from "./prove/kit";
import {
  findPlayer,
  isProofQuestion,
  normalizeName,
  parseScope,
  type Candidate,
} from "./prove/parse";

const cand = (
  pid: string,
  name: string,
  n: number,
  team = false,
): Candidate => ({ pid, name, n, team, roles: {} });
const CANDS = [
  cand("1", "C.J. Stroud", 300),
  cand("2", "Josh Allen", 320),
  cand("3", "Josh Allen", 2),
  cand("4", "Lamar Jackson", 280),
  cand("5", "Nikola Jokić", 70),
  cand("6", "Victor Wembanyama", 60),
  cand("7", "Amon-Ra St. Brown", 90),
  cand("HOU", "Houston Texans", 5000, true),
  cand("SF", "San Francisco 49ers", 5000, true),
  cand("BOS", "Boston Red Sox", 160, true),
  cand("CHW", "Chicago White Sox", 162, true),
];

test("isProofQuestion", () => {
  assert.ok(
    isProofQuestion("Give me the stats that prove Cj stroud is the best qb"),
  );
  assert.ok(isProofQuestion("make the case for Saquon"));
  assert.ok(isProofQuestion("Lamar is the GOAT"));
  assert.ok(!isProofQuestion("Most rushing yards in 2024"));
  assert.ok(!isProofQuestion("Top 10 quarterbacks by EPA"));
  assert.ok(isProofQuestion("why are the Texans the best team?"));
  assert.ok(!isProofQuestion("What team is the biggest fraud?"));
});

test("normalizeName strips punctuation, accents and suffixes", () => {
  assert.equal(normalizeName("C.J. Stroud"), "cj stroud");
  assert.equal(normalizeName("Nikola Jokić"), "nikola jokic");
  assert.equal(normalizeName("Kenneth Walker III"), "kenneth walker");
});

test("findPlayer", () => {
  assert.equal(findPlayer("prove Cj stroud is the best", CANDS)?.pid, "1");
  // Same name: the one with more volume.
  assert.equal(findPlayer("case for josh allen", CANDS)?.pid, "2");
  assert.equal(findPlayer("prove Lamar is the goat", CANDS)?.pid, "4");
  assert.equal(findPlayer("prove jokic is the best", CANDS)?.pid, "5");
  assert.equal(findPlayer("prove wemby is elite", CANDS)?.pid, "6");
  assert.equal(findPlayer("make the case for the sun god", CANDS)?.pid, "7");
  assert.equal(findPlayer("prove the best qb is elite", CANDS), null);
  assert.equal(findPlayer("why are the Texans so good", CANDS)?.pid, "HOU");
  assert.equal(findPlayer("prove the niners are elite", CANDS)?.pid, "SF");
  assert.equal(findPlayer("case for the red sox", CANDS)?.pid, "BOS");
  // A player beats his team on a tie.
  assert.equal(
    findPlayer("prove stroud is the best texans qb", CANDS)?.pid,
    "1",
  );
});

test("parseScope", () => {
  const info = { minSeason: 1999, maxSeason: 2026 };
  assert.deepEqual(parseScope("nfl", "prove stroud is best", info), {
    scope: { from: 2026, to: 2026, type: "REG" },
    defaulted: true,
  });
  assert.deepEqual(parseScope("nfl", "case for saquon in 2024", info).scope, {
    from: 2024,
    to: 2024,
    type: "REG",
  });
  assert.deepEqual(parseScope("nfl", "brady career playoffs", info).scope, {
    from: 1999,
    to: 2026,
    type: "POST",
  });
  assert.deepEqual(parseScope("nfl", "since 2022", info).scope.from, 2022);
  assert.deepEqual(
    parseScope("nfl", "last three seasons", info).scope.from,
    2024,
  );
  const nba = { minSeason: 1997, maxSeason: 2027 };
  assert.deepEqual(parseScope("nba", "sga in 2024-25", nba).scope, {
    from: 2025,
    to: 2025,
    type: "REG",
  });
});

test("formatValue", () => {
  assert.equal(formatValue(0.3456, "avg"), ".346");
  assert.equal(formatValue(1.2913, "avg"), "1.291");
  assert.equal(formatValue(0.25, "epa"), "+0.25");
  assert.equal(formatValue(0.5, "pct"), "50.0%");
  assert.equal(formatValue(89143, "int"), "89,143");
});
