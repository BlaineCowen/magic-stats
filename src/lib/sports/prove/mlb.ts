import {
  either,
  MONTHS,
  WEEKDAYS,
  type Dim,
  type Role,
  type SportProof,
} from "./kit";

// Shared game context: day/night, team result and opponent record come from games.
const gameJoin = (table: string, scope: string) => `
  WITH rec AS (
    SELECT team, season, season_type, avg(win) AS win_pct FROM (
      SELECT season, season_type, home_team AS team, (home_score > away_score)::INT AS win FROM games
      UNION ALL
      SELECT season, season_type, away_team, (away_score > home_score)::INT FROM games
    ) GROUP BY ALL
  )
  SELECT x.*, g.day_night,
    CASE WHEN g.home_score = g.away_score THEN NULL
      WHEN x.is_home = (g.home_score > g.away_score) THEN 1 ELSE 0 END AS team_win,
    rec.win_pct AS opp_win_pct
  FROM ${table} x
  JOIN games g USING (game_pk)
  LEFT JOIN rec ON rec.team = x.opponent AND rec.season = x.season AND rec.season_type = x.season_type
  WHERE ${scope}`;

const context: Dim[] = [
  {
    key: "opp",
    sql: either(
      "opp_win_pct >= 0.5",
      "against winning teams",
      "against losing teams",
    ),
  },
  {
    key: "dn",
    sql: either("day_night = 'night'", "under the lights", "in day games"),
  },
  { key: "loc", sql: either("is_home", "at home", "on the road") },
  {
    key: "result",
    sql: "CASE team_win WHEN 1 THEN 'in team wins' WHEN 0 THEN 'in team losses' END",
  },
  MONTHS,
  WEEKDAYS,
];

const cols = (dims: Dim[]) =>
  dims.map((d) => `${d.sql} AS d_${d.key}`).join(",\n      ");

const batDims: Dim[] = [
  {
    key: "slot",
    sql: `CASE batting_order WHEN 1 THEN 'batting leadoff' WHEN 2 THEN 'batting second'
      WHEN 3 THEN 'batting third' WHEN 4 THEN 'batting cleanup' END`,
  },
  ...context,
];

const batter: Role = {
  key: "batter",
  noun: "hitters",
  sample: { sql: "sum(pa)", label: "PA" },
  min: [150, 60, 40],
  minPool: 15,
  dims: batDims,
  skipPairs: [["month", "day"]],
  from: (scope) => `
    SELECT player_id AS pid, player_name AS pname, team,
      ${cols(batDims)},
      pa, ab, hits, doubles, triples, home_runs, rbi, runs, walks, hit_by_pitch,
      stolen_bases, total_bases
    FROM (${gameJoin("batting_games", scope)})`,
  ids: (scope) =>
    `SELECT player_id AS pid, player_name AS pname, pa FROM batting_games x WHERE ${scope}`,
  metrics: [
    {
      key: "hr",
      lead: "Most home runs",
      column: "HR",
      sql: "sum(home_runs)",
      fmt: "int",
      weight: 1.4,
    },
    {
      key: "h",
      lead: "Most hits",
      column: "Hits",
      sql: "sum(hits)",
      fmt: "int",
      weight: 1.1,
    },
    {
      key: "rbi",
      lead: "Most RBIs",
      column: "RBI",
      sql: "sum(rbi)",
      fmt: "int",
      weight: 1.1,
    },
    {
      key: "r",
      lead: "Most runs scored",
      column: "Runs",
      sql: "sum(runs)",
      fmt: "int",
    },
    {
      key: "sb",
      lead: "Most stolen bases",
      column: "SB",
      sql: "sum(stolen_bases)",
      fmt: "int",
      weight: 0.9,
    },
    {
      key: "xbh",
      lead: "Most extra-base hits",
      column: "XBH",
      sql: "sum(doubles + triples + home_runs)",
      fmt: "int",
      weight: 0.9,
    },
    {
      key: "avg",
      lead: "Best batting average",
      column: "AVG",
      sql: "sum(hits) / nullif(sum(ab), 0)",
      rate: true,
      fmt: "avg",
      weight: 1.2,
    },
    {
      key: "obp",
      lead: "Best on-base percentage",
      column: "OBP",
      sql: "sum(hits + walks + hit_by_pitch) / nullif(sum(pa), 0)",
      rate: true,
      fmt: "avg",
    },
    {
      key: "slg",
      lead: "Best slugging percentage",
      column: "SLG",
      sql: "sum(total_bases) / nullif(sum(ab), 0)",
      rate: true,
      fmt: "avg",
    },
    {
      key: "ops",
      lead: "Best OPS",
      column: "OPS",
      sql: "sum(hits + walks + hit_by_pitch) / nullif(sum(pa), 0) + sum(total_bases) / nullif(sum(ab), 0)",
      rate: true,
      fmt: "avg",
      weight: 1.3,
    },
  ],
};

const pitchDims: Dim[] = [
  { key: "role", sql: either("started", "as a starter", "in relief") },
  ...context,
];

const pitcher: Role = {
  key: "pitcher",
  noun: "pitchers",
  sample: { sql: "sum(batters_faced)", label: "batters faced" },
  min: [150, 60, 40],
  minPool: 15,
  dims: pitchDims,
  skipPairs: [["month", "day"]],
  from: (scope) => `
    SELECT player_id AS pid, player_name AS pname, team,
      ${cols(pitchDims)},
      outs, batters_faced, hits, earned_runs, walks, strikeouts, home_runs, decision
    FROM (${gameJoin("pitching_games", scope)})`,
  ids: (scope) =>
    `SELECT player_id AS pid, player_name AS pname, batters_faced FROM pitching_games x WHERE ${scope}`,
  metrics: [
    {
      key: "k",
      lead: "Most strikeouts",
      column: "K",
      sql: "sum(strikeouts)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "w",
      lead: "Most wins",
      column: "Wins",
      sql: "count(*) FILTER (WHERE decision = 'W')",
      fmt: "int",
    },
    {
      key: "sv",
      lead: "Most saves",
      column: "Saves",
      sql: "count(*) FILTER (WHERE decision = 'S')",
      fmt: "int",
    },
    {
      key: "ip",
      lead: "Most innings",
      column: "IP",
      sql: "sum(outs) / 3",
      fmt: "1",
      weight: 0.8,
    },
    {
      key: "era",
      lead: "Lowest ERA",
      column: "ERA",
      sql: "27 * sum(earned_runs) / nullif(sum(outs), 0)",
      rate: true,
      low: true,
      fmt: "2",
      weight: 1.4,
    },
    {
      key: "whip",
      lead: "Lowest WHIP",
      column: "WHIP",
      sql: "3 * sum(walks + hits) / nullif(sum(outs), 0)",
      rate: true,
      low: true,
      fmt: "2",
      weight: 1.1,
    },
    {
      key: "kpct",
      lead: "Best strikeout rate",
      column: "K%",
      sql: "sum(strikeouts) / nullif(sum(batters_faced), 0)",
      rate: true,
      fmt: "pct",
    },
    {
      key: "hr9",
      lead: "Fewest home runs per 9",
      column: "HR/9",
      sql: "27 * sum(home_runs) / nullif(sum(outs), 0)",
      rate: true,
      low: true,
      fmt: "2",
      weight: 0.8,
    },
  ],
};

export const mlbProof: SportProof = {
  roles: [batter, pitcher],
  league: "MLB",
  scopeSql: (s) =>
    `x.season BETWEEN ${s.from} AND ${s.to} AND x.season_type = '${s.type}'`,
  seasonLabel: (s) => String(s),
};
