import assert from "node:assert/strict";
import { test } from "node:test";
import { parseScoreboard } from "./scoreboard";
import { pickStatus, tally } from "./tally";

test("tally splits points by where each pick stands", () => {
  const mk = (
    id: string,
    state: string,
    home: string,
    away: string,
    prob?: number,
  ) => ({
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
        situation:
          prob === undefined
            ? undefined
            : { lastPlay: { probability: { homeWinPercentage: prob } } },
      },
    ],
  });
  const { games } = parseScoreboard({
    events: [
      mk("1", "post", "20", "10"),
      mk("2", "in", "7", "14", 0.2),
      mk("3", "pre", "0", "0"),
    ],
  });
  const e = {
    picks: { "1": "home" as const, "2": "home" as const, "3": "away" as const },
    points: { "1": 3, "2": 2, "3": 1 },
  };
  assert.equal(pickStatus(games[0]!, "home"), "won");
  assert.equal(pickStatus(games[1]!, "home"), "losing");
  const t = tally(games, e);
  assert.equal(t.banked, 3);
  assert.equal(t.losing, 2);
  assert.equal(t.toPlay, 1);
  assert.equal(t.max, 6);
  // 3 banked + 2 x 0.2 live + 1 x 0.5 coin flip (no line)
  assert.ok(Math.abs(t.expected - 3.9) < 1e-9);
});
