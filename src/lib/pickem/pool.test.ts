import assert from "node:assert/strict";
import { test } from "node:test";
import { poolWeek } from "./pool";
import { parseScoreboard } from "./scoreboard";
import { mergeEntry } from "./store";

const mk = (id: string, state: string, home: string, away: string) => ({
  id,
  date: "2026-10-23T00:15Z",
  status: { type: { state, completed: state === "post" } },
  competitions: [
    {
      competitors: [
        {
          homeAway: "home",
          score: home,
          team: { id: `h${id}`, abbreviation: "H" },
        },
        {
          homeAway: "away",
          score: away,
          team: { id: `a${id}`, abbreviation: "A" },
        },
      ],
    },
  ],
});
const week = parseScoreboard({
  season: { year: 2026, type: 2 },
  week: { number: 7 },
  events: [mk("1", "post", "20", "10"), mk("2", "pre", "0", "0")],
});

test("pool week: counts others' picks, hides unstarted picks, and the certain winner wins", () => {
  const members = [
    {
      user: "me",
      entry: {
        picks: { "1": "home" as const, "2": "home" as const },
        points: { "1": 2, "2": 1 },
      },
    },
    {
      user: "pal",
      entry: {
        picks: { "1": "away" as const, "2": "away" as const },
        points: { "1": 1, "2": 2 },
      },
    },
  ];
  const r = poolWeek(week, members, "me", true, new Set(["1"]), 2000);
  assert.deepEqual(r.counts["2"], { home: 0, away: 1 });
  const me = r.rows.find((x) => x.user === "me")!;
  const pal = r.rows.find((x) => x.user === "pal")!;
  assert.deepEqual(pal.visible, { "1": ["away", 1] });
  assert.deepEqual(me.visible["2"], ["home", 1]);
  // me banked 2; pal can reach at most 2 if game 2 goes away (tie), so me wins ~75%.
  assert.ok(me.winProb > 0.7 && me.winProb < 0.8);
  assert.equal(me.banked, 2);
});

test("mergeEntry locks picks and points on games that have kicked off", () => {
  const old = {
    picks: { "1": "home" as const },
    points: { "1": 2 },
    office: {},
    pinned: [],
    updated: "",
  };
  const games = ["1", "2"];
  // Game 1 has kicked off: switching it to away or to 1 point is ignored.
  const r = mergeEntry(
    old,
    {
      picks: { "1": "away", "2": "away" },
      points: { "1": 1, "2": 1 },
      office: {},
      pinned: [],
    },
    games,
    new Set(["1"]),
  );
  assert.ok("entry" in r);
  if ("entry" in r) {
    assert.equal(r.entry.picks["1"], "home");
    assert.equal(r.entry.points["1"], 2);
    assert.equal(r.entry.points["2"], 1);
  }
  // Giving game 2 the 2 points game 1 holds is refused.
  const clash = mergeEntry(
    old,
    { picks: { "2": "away" }, points: { "2": 2 }, office: {}, pinned: [] },
    games,
    new Set(["1"]),
  );
  assert.ok("error" in clash);
  // Before kickoff everything is free.
  const free = mergeEntry(
    old,
    {
      picks: { "1": "away", "2": "home" },
      points: { "1": 1, "2": 2 },
      office: {},
      pinned: [],
    },
    games,
    new Set<string>(),
  );
  assert.ok("entry" in free && free.entry.picks["1"] === "away");
});
