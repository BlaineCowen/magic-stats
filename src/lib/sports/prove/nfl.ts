import { cases, either, type Dim, type Role, type SportProof } from "./kit";

// Splits every NFL role shares. Phrases read after the stat:
// "Most passing yards" + "on 3rd down" + "on the road". `own` is "his" or
// "their"; null drops the backed-up bucket (it reads wrong for a defense).
const situationDims = (own: string | null): Dim[] => [
  {
    key: "down",
    sql: cases("down", {
      "1": "on 1st down",
      "2": "on 2nd down",
      "3": "on 3rd down",
      "4": "on 4th down",
    }),
  },
  {
    key: "dd",
    sql: `CASE WHEN down = 3 AND ydstogo >= 7 THEN 'on 3rd-and-long'
      WHEN down IN (3, 4) AND ydstogo <= 2 THEN 'on 3rd or 4th-and-short' END`,
  },
  {
    key: "zone",
    sql: `CASE WHEN yardline_100 <= 20 THEN 'in the red zone'
      ${own ? `WHEN yardline_100 >= 80 THEN 'when backed up inside ${own} own 20'` : ""} END`,
  },
  {
    key: "qtr",
    sql: cases("qtr", {
      "1": "in the 1st quarter",
      "2": "in the 2nd quarter",
      "3": "in the 3rd quarter",
      "4": "in the 4th quarter",
      "5": "in overtime",
    }),
  },
  {
    key: "clock",
    sql: "CASE WHEN half_seconds_remaining <= 120 THEN 'in the last two minutes of a half' END",
  },
  {
    key: "score",
    sql: `CASE WHEN score_differential < -8 THEN 'when down more than one score'
      WHEN score_differential < 0 THEN 'when trailing'
      WHEN score_differential = 0 THEN 'with the game tied'
      WHEN score_differential > 0 THEN 'with the lead' END`,
  },
  {
    key: "shotgun",
    sql: either("shotgun = 1", "from the shotgun", "from under center"),
  },
  { key: "tempo", sql: "CASE WHEN no_huddle = 1 THEN 'in no-huddle' END" },
  { key: "loc", sql: either("posteam = home_team", "at home", "on the road") },
  {
    key: "div",
    sql: "CASE WHEN div_game = 1 THEN 'against division rivals' END",
  },
  {
    key: "roof",
    sql: either("roof IN ('dome', 'closed')", "indoors", "outdoors"),
    weight: 0.8,
  },
  {
    key: "result",
    sql: `CASE WHEN result = 0 OR result IS NULL THEN NULL
      WHEN (posteam = home_team) = (result > 0) THEN 'in wins' ELSE 'in losses' END`,
  },
  {
    key: "day",
    weight: 0.6,
    sql: cases("dayname(game_date::DATE)", {
      Sunday: "on Sundays",
      Monday: "on Monday nights",
      Thursday: "on Thursday nights",
      Saturday: "on Saturdays",
    }),
  },
];

const situation = situationDims("his");

const SITUATION_SKIPS: [string, string][] = [
  ["down", "dd"],
  ["qtr", "clock"],
  ["loc", "roof"],
];

const cols = (dims: Dim[]) =>
  dims.map((d) => `${d.sql} AS d_${d.key}`).join(",\n      ");

const throwDims: Dim[] = [
  {
    key: "throw",
    sql: `CASE WHEN pass_length IN ('deep', 'short') AND pass_location IN ('left', 'middle', 'right')
      THEN 'on ' || pass_length || ' throws ' ||
        CASE pass_location WHEN 'middle' THEN 'over the middle' ELSE 'to the ' || pass_location END END`,
  },
  {
    key: "len",
    sql: cases("pass_length", {
      deep: "on deep throws",
      short: "on short throws",
    }),
  },
  {
    key: "dir",
    sql: cases("pass_location", {
      left: "on throws to the left",
      middle: "on throws over the middle",
      right: "on throws to the right",
    }),
  },
];
const THROW_SKIPS: [string, string][] = [
  ["throw", "len"],
  ["throw", "dir"],
  ["len", "dir"],
];

const passerDims = [...throwDims, ...situation];
const passer: Role = {
  key: "passer",
  noun: "passers",
  sample: { sql: "count(*)", label: "dropbacks" },
  min: [100, 25, 12],
  minPool: 10,
  dims: passerDims,
  skipPairs: [...SITUATION_SKIPS, ...THROW_SKIPS],
  from: (scope) => `
    SELECT passer_id AS pid, passer_full_name AS pname, posteam AS team,
      ${cols(passerDims)},
      coalesce(passing_yards, 0) AS yds, pass_touchdown AS td, interception AS ints,
      complete_pass AS cmp, CASE WHEN sack = 0 AND qb_scramble = 0 THEN pass_attempt ELSE 0 END AS att,
      epa, success, cpoe, first_down AS fd
    FROM pbp
    WHERE ${scope} AND qb_dropback = 1 AND passer_id IS NOT NULL`,
  ids: (scope) => `
    SELECT passer_id AS pid, passer_full_name AS pname FROM pbp
    WHERE ${scope} AND qb_dropback = 1 AND passer_id IS NOT NULL`,
  metrics: [
    {
      key: "yds",
      lead: "Most passing yards",
      column: "Pass yds",
      sql: "sum(yds)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "td",
      lead: "Most touchdown passes",
      column: "Pass TD",
      sql: "sum(td)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "rating",
      lead: "Highest passer rating",
      column: "Rating",
      rate: true,
      fmt: "1",
      weight: 1.2,
      sql: `(least(greatest((sum(cmp) / nullif(sum(att), 0) - 0.3) * 5, 0), 2.375)
        + least(greatest((sum(yds) / nullif(sum(att), 0) - 3) * 0.25, 0), 2.375)
        + least(greatest(sum(td) / nullif(sum(att), 0) * 20, 0), 2.375)
        + least(greatest(2.375 - sum(ints) / nullif(sum(att), 0) * 25, 0), 2.375)) / 6 * 100`,
    },
    {
      key: "epa",
      lead: "Best EPA per dropback",
      column: "EPA/db",
      sql: "avg(epa)",
      rate: true,
      fmt: "epa",
      weight: 1.2,
    },
    {
      key: "ypa",
      lead: "Most yards per attempt",
      column: "Yds/att",
      sql: "sum(yds) / nullif(sum(att), 0)",
      rate: true,
      fmt: "1",
    },
    {
      key: "cmp",
      lead: "Best completion rate",
      column: "Comp %",
      sql: "sum(cmp) / nullif(sum(att), 0)",
      rate: true,
      fmt: "pct",
    },
    {
      key: "cpoe",
      lead: "Best completion % over expected",
      column: "CPOE",
      sql: "avg(cpoe)",
      rate: true,
      fmt: "plus1",
      weight: 0.8,
    },
    {
      key: "sr",
      lead: "Best success rate",
      column: "Success",
      sql: "avg(success)",
      rate: true,
      fmt: "pct",
      weight: 0.9,
    },
    {
      key: "fd",
      lead: "Most first downs through the air",
      column: "1st downs",
      sql: "sum(fd)",
      fmt: "int",
      weight: 0.8,
    },
  ],
};

const rushDims: Dim[] = [
  {
    key: "rdir",
    sql: cases("run_location", {
      left: "running to the left",
      middle: "running up the middle",
      right: "running to the right",
    }),
  },
  ...situation,
];
const rusher: Role = {
  key: "rusher",
  noun: "rushers",
  sample: { sql: "count(*)", label: "carries" },
  min: [50, 15, 10],
  minPool: 10,
  dims: rushDims,
  skipPairs: SITUATION_SKIPS,
  from: (scope) => `
    SELECT rusher_id AS pid, rusher_full_name AS pname, posteam AS team,
      ${cols(rushDims)},
      coalesce(rushing_yards, 0) AS yds, rush_touchdown AS td, epa, success, first_down AS fd
    FROM pbp
    WHERE ${scope} AND play_type = 'run' AND rush_attempt = 1 AND rusher_id IS NOT NULL`,
  ids: (scope) => `
    SELECT rusher_id AS pid, rusher_full_name AS pname FROM pbp
    WHERE ${scope} AND play_type = 'run' AND rush_attempt = 1 AND rusher_id IS NOT NULL`,
  metrics: [
    {
      key: "yds",
      lead: "Most rushing yards",
      column: "Rush yds",
      sql: "sum(yds)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "td",
      lead: "Most rushing touchdowns",
      column: "Rush TD",
      sql: "sum(td)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "ypc",
      lead: "Most yards per carry",
      column: "Yds/carry",
      sql: "avg(yds)",
      rate: true,
      fmt: "1",
      weight: 1.1,
    },
    {
      key: "epa",
      lead: "Best EPA per carry",
      column: "EPA/carry",
      sql: "avg(epa)",
      rate: true,
      fmt: "epa",
    },
    {
      key: "sr",
      lead: "Best rushing success rate",
      column: "Success",
      sql: "avg(success)",
      rate: true,
      fmt: "pct",
      weight: 0.9,
    },
    {
      key: "big",
      lead: "Most runs of 10+ yards",
      column: "10+ runs",
      sql: "count(*) FILTER (WHERE yds >= 10)",
      fmt: "int",
    },
    {
      key: "fd",
      lead: "Most rushing first downs",
      column: "1st downs",
      sql: "sum(fd)",
      fmt: "int",
      weight: 0.8,
    },
  ],
};

const catchDims = [...throwDims, ...situation];
const receiver: Role = {
  key: "receiver",
  noun: "pass catchers",
  sample: { sql: "count(*)", label: "targets" },
  min: [40, 12, 8],
  minPool: 12,
  dims: catchDims,
  skipPairs: [...SITUATION_SKIPS, ...THROW_SKIPS],
  from: (scope) => `
    SELECT receiver_id AS pid, receiver_full_name AS pname, posteam AS team,
      ${cols(catchDims).replaceAll(" throws", " targets")},
      coalesce(receiving_yards, 0) AS yds, complete_pass AS rec, pass_touchdown AS td,
      CASE WHEN complete_pass = 1 THEN coalesce(yards_after_catch, 0) ELSE 0 END AS yac,
      epa, first_down AS fd
    FROM pbp
    WHERE ${scope} AND pass_attempt = 1 AND sack = 0 AND receiver_id IS NOT NULL`,
  ids: (scope) => `
    SELECT receiver_id AS pid, receiver_full_name AS pname FROM pbp
    WHERE ${scope} AND pass_attempt = 1 AND sack = 0 AND receiver_id IS NOT NULL`,
  metrics: [
    {
      key: "yds",
      lead: "Most receiving yards",
      column: "Rec yds",
      sql: "sum(yds)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "rec",
      lead: "Most catches",
      column: "Catches",
      sql: "sum(rec)",
      fmt: "int",
      weight: 1.1,
    },
    {
      key: "td",
      lead: "Most receiving touchdowns",
      column: "Rec TD",
      sql: "sum(td)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "yac",
      lead: "Most yards after the catch",
      column: "YAC",
      sql: "sum(yac)",
      fmt: "int",
    },
    {
      key: "ypt",
      lead: "Most yards per target",
      column: "Yds/target",
      sql: "avg(yds)",
      rate: true,
      fmt: "1",
    },
    {
      key: "catch",
      lead: "Best catch rate",
      column: "Catch %",
      sql: "avg(rec)",
      rate: true,
      fmt: "pct",
      weight: 0.9,
    },
    {
      key: "epa",
      lead: "Best EPA per target",
      column: "EPA/target",
      sql: "avg(epa)",
      rate: true,
      fmt: "epa",
    },
    {
      key: "fd",
      lead: "Most receiving first downs",
      column: "1st downs",
      sql: "sum(fd)",
      fmt: "int",
      weight: 0.8,
    },
  ],
};

const playDim: Dim = {
  key: "play",
  sql: cases("play_type", {
    pass: "on passing plays",
    run: "on running plays",
  }),
};
const offenseDims = [playDim, ...situationDims("their")];
const offense: Role = {
  key: "offense",
  team: true,
  noun: "offenses",
  sample: { sql: "count(*)", label: "plays" },
  min: [200, 60, 30],
  minPool: 20,
  dims: offenseDims,
  skipPairs: SITUATION_SKIPS,
  from: (scope) => `
    SELECT posteam AS pid, posteam AS pname, NULL AS team,
      ${cols(offenseDims)},
      coalesce(yards_gained, 0) AS yds, epa, success, touchdown AS td
    FROM pbp
    WHERE ${scope} AND play_type IN ('pass', 'run') AND posteam IS NOT NULL`,
  ids: (scope) => `
    SELECT posteam AS pid, posteam AS pname FROM pbp
    WHERE ${scope} AND play_type IN ('pass', 'run') AND posteam IS NOT NULL`,
  metrics: [
    {
      key: "epa",
      lead: "Best offensive EPA per play",
      column: "EPA/play",
      sql: "avg(epa)",
      rate: true,
      fmt: "epa",
      weight: 1.3,
    },
    {
      key: "sr",
      lead: "Best offensive success rate",
      column: "Success",
      sql: "avg(success)",
      rate: true,
      fmt: "pct",
    },
    {
      key: "ypp",
      lead: "Most yards per play",
      column: "Yds/play",
      sql: "avg(yds)",
      rate: true,
      fmt: "1",
    },
    {
      key: "big",
      lead: "Most 20-yard plays",
      column: "20+ plays",
      sql: "count(*) FILTER (WHERE yds >= 20)",
      fmt: "int",
      weight: 0.9,
    },
    {
      key: "td",
      lead: "Most offensive touchdowns",
      column: "TD",
      sql: "sum(td)",
      fmt: "int",
    },
  ],
};

// Swap sides so the shared dims read from the defense's point of view.
const defenseDims = [
  playDim,
  ...situationDims(null).filter(
    (d) => d.key !== "shotgun" && d.key !== "tempo",
  ),
];
const defense: Role = {
  key: "defense",
  team: true,
  noun: "defenses",
  sample: { sql: "count(*)", label: "plays" },
  min: [200, 60, 30],
  minPool: 20,
  dims: defenseDims,
  skipPairs: SITUATION_SKIPS,
  from: (scope) => `
    SELECT posteam AS pid, posteam AS pname, NULL AS team,
      ${cols(defenseDims)},
      coalesce(yards_gained, 0) AS yds, epa, success, sack, takeaway
    FROM (
      SELECT * REPLACE (defteam AS posteam, posteam AS defteam, -score_differential AS score_differential),
        coalesce(interception, 0) + coalesce(fumble_lost, 0) AS takeaway
      FROM pbp
      WHERE ${scope} AND play_type IN ('pass', 'run') AND defteam IS NOT NULL
    )`,
  ids: (scope) => `
    SELECT defteam AS pid, defteam AS pname FROM pbp
    WHERE ${scope} AND play_type IN ('pass', 'run') AND defteam IS NOT NULL`,
  metrics: [
    {
      key: "epa",
      lead: "Lowest EPA per play allowed",
      column: "EPA/play",
      sql: "avg(epa)",
      rate: true,
      low: true,
      fmt: "epa",
      weight: 1.3,
    },
    {
      key: "sr",
      lead: "Lowest success rate allowed",
      column: "Success",
      sql: "avg(success)",
      rate: true,
      low: true,
      fmt: "pct",
    },
    {
      key: "ypp",
      lead: "Fewest yards per play allowed",
      column: "Yds/play",
      sql: "avg(yds)",
      rate: true,
      low: true,
      fmt: "1",
    },
    {
      key: "sacks",
      lead: "Most sacks",
      column: "Sacks",
      sql: "sum(sack)",
      fmt: "int",
    },
    {
      key: "take",
      lead: "Most takeaways",
      column: "Takeaways",
      sql: "sum(takeaway)",
      fmt: "int",
    },
  ],
};

const gameDims: Dim[] = [
  {
    key: "line",
    sql: "CASE WHEN favored_by < 0 THEN 'as the underdog' WHEN favored_by > 0 THEN 'as the favorite' END",
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
  {
    key: "div",
    sql: "CASE WHEN div_game = 1 THEN 'against division rivals' END",
  },
  {
    key: "cold",
    sql: "CASE WHEN temp <= 40 THEN 'in games 40 degrees or colder' END",
  },
  {
    key: "day",
    weight: 0.6,
    sql: cases("dayname(gameday::DATE)", {
      Sunday: "on Sundays",
      Monday: "on Monday nights",
      Thursday: "on Thursday nights",
      Saturday: "on Saturdays",
    }),
  },
];
const record: Role = {
  key: "record",
  team: true,
  noun: "teams",
  sample: { sql: "count(*)", label: "games" },
  min: [4, 3, 2],
  minPool: 16,
  dims: gameDims,
  from: (scope) => `
    WITH rec AS (
      SELECT team, season, season_type, avg(win) AS win_pct FROM team_games
      WHERE points_for IS NOT NULL GROUP BY ALL
    )
    SELECT g.team AS pid, g.team AS pname, NULL AS team,
      ${cols(gameDims)},
      win, points_for AS pf, points_against AS pa
    FROM (
      SELECT t.*, rec.win_pct AS opp_win_pct
      FROM (SELECT * FROM team_games WHERE ${scope} AND points_for IS NOT NULL) t
      LEFT JOIN rec ON rec.team = t.opponent AND rec.season = t.season AND rec.season_type = t.season_type
    ) g`,
  ids: (scope) => `
    SELECT team AS pid, team AS pname FROM team_games t
    WHERE ${scope} AND points_for IS NOT NULL`,
  metrics: [
    {
      key: "w",
      lead: "Most wins",
      column: "Wins",
      sql: "sum(win)",
      fmt: "int",
      weight: 1.3,
    },
    {
      key: "wp",
      lead: "Best winning percentage",
      column: "Win %",
      sql: "avg(win)",
      rate: true,
      fmt: "pct",
      weight: 1.2,
    },
    {
      key: "diff",
      lead: "Best point differential per game",
      column: "Margin",
      sql: "avg(pf - pa)",
      rate: true,
      fmt: "plus1",
      weight: 1.2,
    },
    {
      key: "pf",
      lead: "Most points per game",
      column: "PPG",
      sql: "avg(pf)",
      rate: true,
      fmt: "1",
    },
    {
      key: "pa",
      lead: "Fewest points allowed per game",
      column: "Allowed",
      sql: "avg(pa)",
      rate: true,
      low: true,
      fmt: "1",
    },
  ],
};

export const nflProof: SportProof = {
  roles: [passer, rusher, receiver, offense, defense, record],
  league: "NFL",
  scopeSql: (s) =>
    `season BETWEEN ${s.from} AND ${s.to} AND season_type = '${s.type}'`,
  seasonLabel: (s) => String(s),
};
