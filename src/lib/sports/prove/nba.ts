import {
  either,
  MONTHS,
  WEEKDAYS,
  type Dim,
  type Role,
  type SportProof,
} from "./kit";

const dims: Dim[] = [
  { key: "role", sql: either("started", "as a starter", "off the bench") },
  {
    key: "rest",
    sql: `CASE WHEN rest_days = 1 THEN 'on the second night of back-to-backs'
      WHEN rest_days >= 3 THEN 'with two or more days of rest' END`,
  },
  {
    key: "margin",
    sql: `CASE WHEN abs(margin) <= 5 THEN 'in games decided by 5 or fewer'
      WHEN abs(margin) >= 20 THEN 'in 20-point blowouts' END`,
  },
  {
    key: "opp",
    sql: either(
      "opp_win_pct >= 0.5",
      "against winning teams",
      "against losing teams",
    ),
  },
  { key: "loc", sql: either("is_home", "at home", "on the road") },
  { key: "result", sql: either("win = 1", "in wins", "in losses") },
  MONTHS,
  WEEKDAYS,
];

const player: Role = {
  key: "player",
  noun: "players",
  sample: { sql: "count(*)", label: "games" },
  min: [20, 8, 5],
  minPool: 15,
  dims,
  skipPairs: [
    ["month", "day"],
    ["result", "margin"],
  ],
  from: (scope) => `
    WITH tg AS (
      SELECT game_id, team, points_for - points_against AS margin,
        game_date - lag(game_date) OVER (PARTITION BY team, season ORDER BY game_date) AS rest_days
      FROM team_games
    ),
    rec AS (
      SELECT team, season, season_type, avg(win) AS win_pct FROM team_games GROUP BY ALL
    )
    SELECT pg.player_id AS pid, pg.player_name AS pname, pg.team,
      ${dims.map((d) => `${d.sql} AS d_${d.key}`).join(",\n      ")},
      pts, reb, ast, stl, blk, tov, fg3m, fga, fta, fantasy_pts, plus_minus
    FROM (
      SELECT p.*, tg.margin, tg.rest_days, rec.win_pct AS opp_win_pct
      FROM player_games p
      LEFT JOIN tg USING (game_id, team)
      LEFT JOIN rec ON rec.team = p.opponent AND rec.season = p.season AND rec.season_type = p.season_type
      WHERE ${scope}
    ) pg`,
  ids: (scope) =>
    `SELECT player_id AS pid, player_name AS pname FROM player_games p WHERE ${scope}`,
  metrics: [
    {
      key: "ppg",
      lead: "Most points per game",
      column: "PPG",
      sql: "avg(pts)",
      rate: true,
      fmt: "1",
      weight: 1.4,
    },
    {
      key: "rpg",
      lead: "Most rebounds per game",
      column: "RPG",
      sql: "avg(reb)",
      rate: true,
      fmt: "1",
      weight: 1.1,
    },
    {
      key: "apg",
      lead: "Most assists per game",
      column: "APG",
      sql: "avg(ast)",
      rate: true,
      fmt: "1",
      weight: 1.1,
    },
    {
      key: "spg",
      lead: "Most steals per game",
      column: "SPG",
      sql: "avg(stl)",
      rate: true,
      fmt: "1",
      weight: 0.8,
    },
    {
      key: "bpg",
      lead: "Most blocks per game",
      column: "BPG",
      sql: "avg(blk)",
      rate: true,
      fmt: "1",
      weight: 0.8,
    },
    {
      key: "threes",
      lead: "Most threes per game",
      column: "3PM/G",
      sql: "avg(fg3m)",
      rate: true,
      fmt: "1",
      weight: 0.9,
    },
    {
      key: "ts",
      lead: "Best true shooting",
      column: "TS%",
      sql: "sum(pts) / nullif(2 * (sum(fga) + 0.44 * sum(fta)), 0)",
      rate: true,
      fmt: "pct",
    },
    {
      key: "pm",
      lead: "Best plus-minus per game",
      column: "+/- per game",
      sql: "avg(plus_minus)",
      rate: true,
      fmt: "plus1",
    },
    {
      key: "fp",
      lead: "Most crabsketball fantasy points per game",
      column: "Fantasy/G",
      sql: "avg(fantasy_pts)",
      rate: true,
      fmt: "1",
      weight: 1.1,
    },
    {
      key: "pts",
      lead: "Most total points",
      column: "Points",
      sql: "sum(pts)",
      fmt: "int",
    },
    {
      key: "g30",
      lead: "Most 30-point games",
      column: "30-pt games",
      sql: "count(*) FILTER (WHERE pts >= 30)",
      fmt: "int",
    },
    {
      key: "dd",
      lead: "Most double-doubles",
      column: "Double-doubles",
      sql: "count(*) FILTER (WHERE (pts >= 10)::INT + (reb >= 10)::INT + (ast >= 10)::INT + (stl >= 10)::INT + (blk >= 10)::INT >= 2)",
      fmt: "int",
      weight: 0.8,
    },
  ],
};

export const nbaProof: SportProof = {
  roles: [player],
  league: "NBA",
  scopeSql: (s) =>
    `p.season BETWEEN ${s.from} AND ${s.to} AND p.season_type = '${s.type}'`,
  seasonLabel: (s) => `${s - 1}-${String(s).slice(2)}`,
};
