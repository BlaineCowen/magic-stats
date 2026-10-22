import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScoreboard } from "./scoreboard";

const side = (homeAway: string, id: string, abbr: string, score: string) => ({
  homeAway,
  score,
  records: [{ summary: "4-2" }],
  team: {
    id,
    abbreviation: abbr,
    displayName: abbr,
    name: abbr,
    color: "112233",
    logo: "x.png",
  },
});

const event = (state: string, extra: Record<string, unknown> = {}) => ({
  id: "1",
  date: "2026-10-23T00:15Z",
  status: {
    type: {
      state,
      completed: state === "post",
      shortDetail: state === "in" ? "Q3 5:12" : "Final",
    },
  },
  competitions: [
    {
      competitors: [
        side("home", "3", "CHI", "17"),
        side("away", "17", "NE", "10"),
      ],
      odds: [
        {
          spread: -3,
          overUnder: 44.5,
          moneyline: {
            home: { close: { odds: "-155" } },
            away: { close: { odds: "+130" } },
          },
        },
      ],
      ...extra,
    },
  ],
});

test("a live game carries score, possession and ESPN's live win chance", () => {
  const w = parseScoreboard({
    season: { year: 2026, type: 2 },
    week: { number: 7 },
    events: [
      event("in", {
        situation: {
          possession: "17",
          shortDownDistanceText: "3rd & 4 at CHI 18",
          isRedZone: true,
          lastPlay: { probability: { homeWinPercentage: 0.81 } },
        },
      }),
    ],
  });
  const g = w.games[0]!;
  assert.equal(g.state, "in");
  assert.equal(g.home.score, 17);
  assert.equal(g.away.score, 10);
  assert.equal(g.liveHome, 0.81);
  assert.equal(g.possession, "away");
  assert.equal(g.redZone, true);
  assert.equal(g.detail, "Q3 5:12");
  assert.ok(g.pHome > 0.58 && g.pHome < 0.6);
  assert.equal(g.home.color, "#112233");
});

test("before kickoff there is no score or live chance", () => {
  const g = parseScoreboard({ events: [event("pre")] }).games[0]!;
  assert.equal(g.home.score, null);
  assert.equal(g.liveHome, null);
  assert.equal(g.possession, null);
});
