import type { DataInfo } from "../db";
import { NO_CHART, RULE, type Col, type SportPrompt } from "../prompt-kit";

/** MLB prompt content: Stats API season lines, Statcast leaderboards, recent game logs. */

const BATTING_COLS: Col[] = [
  ["season, player_id, player_name, position, age", "regular season only"],
  [
    "team, num_teams",
    "'NYY', or 'BOS/NYY' for a traded player (one combined row per season)",
  ],
  [
    "games, pa, ab, runs, hits, doubles, triples, home_runs, rbi, walks, intentional_walks, strikeouts, hit_by_pitch, sac_flies, stolen_bases, caught_stealing, gidp, total_bases, pitches_seen",
    "season totals",
  ],
  ["avg, obp, slg, ops, babip", ""],
  ["woba, wrc_plus, wraa", "wRC+ 100 = league average"],
  [
    "war, batting_runs, baserunning_runs, fielding_runs, positional_runs",
    "WAR and its run components",
  ],
];

const PITCHING_COLS: Col[] = [
  ["season, player_id, player_name, age", "regular season only"],
  ["team, num_teams", "as in batting_seasons"],
  [
    "games, games_started, wins, losses, saves, save_opportunities, holds, blown_saves, complete_games, shutouts",
    "",
  ],
  ["outs, innings", "innings = outs / 3 as a decimal (6.1 IP = 6.333)"],
  [
    "batters_faced, hits, runs, earned_runs, home_runs, walks, strikeouts, hit_batsmen, pitches, strikes",
    "season totals",
  ],
  ["era, whip, k_per_9, bb_per_9, hr_per_9, avg_against", ""],
  ["k_pct, bb_pct", "fractions 0-1 of batters faced"],
  ["fip, xfip, era_minus, fip_minus, war", "ERA-/FIP- 100 = average, lower is better"],
];

const FIELDING_COLS: Col[] = [
  ["season, player_id, player_name, team, position", "one row per position played"],
  [
    "games, games_started, innings, putouts, assists, errors, chances, fielding_pct, double_plays, range_factor_per_9",
    "",
  ],
];

const TEAM_SEASONS_COLS: Col[] = [
  ["season, team, team_name, division", "division like 'AL East'"],
  ["wins, losses, win_pct, division_rank, games_back", "regular season"],
  ["runs_scored, runs_allowed, run_diff", ""],
  [
    "home_runs, avg, obp, slg, ops, stolen_bases, batter_strikeouts, batter_walks",
    "team batting",
  ],
  [
    "era, whip, pitcher_strikeouts, pitcher_walks, home_runs_allowed, saves",
    "team pitching",
  ],
];

const GAMES_COLS: Col[] = [
  ["game_pk, season, game_date", "game_date DATE"],
  [
    "game_type, season_type",
    "game_type 'R' regular, 'F' wild card, 'D' division series, 'L' LCS, 'W' World Series; season_type 'REG'/'POST'",
  ],
  ["home_team, away_team, home_score, away_score, innings", ""],
  ["day_night, venue, series_description", ""],
];

const TEAM_GAMES_COLS: Col[] = [
  ["game_pk, season, game_type, season_type, game_date", ""],
  ["team, opponent, is_home", ""],
  ["runs_for, runs_against, win, loss", "win/loss 1/0"],
  ["venue, day_night", ""],
];

const BATTING_GAMES_COLS: Col[] = [
  ["game_pk, season, game_type, season_type, game_date", ""],
  ["player_id, player_name, team, opponent, is_home, position, batting_order", ""],
  [
    "pa, ab, runs, hits, doubles, triples, home_runs, rbi, walks, strikeouts, hit_by_pitch, stolen_bases, caught_stealing, total_bases, left_on_base",
    "",
  ],
];

const PITCHING_GAMES_COLS: Col[] = [
  ["game_pk, season, game_type, season_type, game_date", ""],
  ["player_id, player_name, team, opponent, is_home", ""],
  ["started, decision", "decision 'W','L','S','H','BS' or NULL"],
  [
    "outs, innings, batters_faced, hits, runs, earned_runs, walks, strikeouts, home_runs, pitches, strikes",
    "",
  ],
];

const STATCAST_COLS: Col[] = [
  ["season, player_id, player_name, pa, batted_balls", "no team column: join batting_seasons/pitching_seasons ON player_id AND season"],
  [
    "avg_exit_velo, max_exit_velo, ev50, avg_launch_angle",
    "mph and degrees",
  ],
  [
    "sweet_spot_pct, hard_hit_pct, barrel_pct, barrels_per_pa, barrels",
    "percents 0-100; hard hit = 95+ mph; barrel_pct per batted ball",
  ],
  ["avg_distance, avg_hr_distance, max_distance", "feet"],
  ["ba, xba, slg, xslg, woba, xwoba", "actual vs expected"],
  ["era, xera", "statcast_pitching only"],
];

const ARSENAL_COLS: Col[] = [
  ["season, player_id, player_name, team", ""],
  [
    "pitch_type, pitch_name",
    "'4-Seam Fastball','Sinker','Cutter','Slider','Sweeper','Curveball','Changeup','Split-Finger', ...",
  ],
  ["pitches, usage_pct, pa", "usage_pct 0-100 of that pitcher's pitches"],
  [
    "run_value, run_value_per_100",
    "runs saved by the pitch; higher = better for the pitcher",
  ],
  ["whiff_pct, k_pct, put_away_pct, hard_hit_pct", "percents 0-100"],
  ["ba, xba, slg, xslg, woba, xwoba", "against the pitch"],
];

const SPRINT_COLS: Col[] = [
  ["season, player_id, player_name, team, position, age", ""],
  [
    "sprint_speed, competitive_runs, bolts, hp_to_1b",
    "sprint_speed in ft/s (27 = average, 30+ elite)",
  ],
];

const OAA_COLS: Col[] = [
  ["season, player_id, player_name, team, position", ""],
  [
    "outs_above_average, fielding_runs_prevented, oaa_in, oaa_back, oaa_toward_3b, oaa_toward_1b",
    "",
  ],
];

const IDIOMS = `MLB IDIOMS (use these exact definitions)
- Single-season leaders: batting_seasons / pitching_seasons already have one row per player per season. Don't SUM within a season.
- Qualified (when the user doesn't give a minimum): batters pa >= 502, pitchers innings >= 162 (the 2020 season: pa >= 186, innings >= 60).
- Career or multi-season: SUM the counting stats and war, GROUP BY player_id, player_name, and recompute rates: AVG = SUM(hits) / SUM(ab); OBP = (SUM(hits) + SUM(walks) + SUM(hit_by_pitch)) / (SUM(ab) + SUM(walks) + SUM(hit_by_pitch) + SUM(sac_flies)); SLG = SUM(total_bases) / SUM(ab); ERA = 9 * SUM(earned_runs) / SUM(innings); WHIP = (SUM(walks) + SUM(hits)) / SUM(innings); K% = SUM(strikeouts) / SUM(batters_faced).
- ISO = slg - avg. K-BB% = k_pct - bb_pct. Starters: games_started >= 0.8 * games; relievers: games_started = 0.
- wRC+, ERA- and FIP-: 100 = league average.
- Exit velocity, launch angle, barrels, hard-hit rate, xBA/xSLG/xwOBA: statcast_batting (or statcast_pitching for pitchers), 2015+. Add the team by joining batting_seasons b ON b.player_id = s.player_id AND b.season = s.season.
- One pitch type (best slider, whiff rate on changeups, pitch usage): pitch_arsenal, filtering pitch_name.
- Game logs, streaks, "last N games", single-game records, splits vs an opponent: batting_games / pitching_games (recent seasons only, see DATA).
- Team records and run differential: team_seasons. Postseason results and series: team_games / games with season_type = 'POST' (game_type 'W' = World Series).`;

const EXAMPLES = `EXAMPLES
Q: Most home runs in 2024
{"plan": "batting_seasons 2024 ordered by home_runs.", "sql": "SELECT player_name, team, games, pa, home_runs, ROUND(slg, 3) AS slg, ROUND(ops, 3) AS ops FROM batting_seasons WHERE season = 2024 ORDER BY home_runs DESC LIMIT 25", ${NO_CHART}}

Q: Best wRC+ among qualified hitters in 2023
{"plan": "batting_seasons 2023 with pa >= 502 ordered by wrc_plus.", "sql": "SELECT player_name, team, pa, ROUND(wrc_plus) AS wrc_plus, ROUND(woba, 3) AS woba, ROUND(war, 1) AS war FROM batting_seasons WHERE season = 2023 AND pa >= 502 ORDER BY wrc_plus DESC LIMIT 25", ${NO_CHART}}

Q: Lowest ERA among qualified starters in 2022, with FIP
{"plan": "pitching_seasons 2022 with innings >= 162 ordered by era.", "sql": "SELECT player_name, team, games_started, ROUND(innings, 1) AS innings, era, ROUND(fip, 2) AS fip, ROUND(100 * k_pct, 1) AS k_pct, ROUND(war, 1) AS war FROM pitching_seasons WHERE season = 2022 AND innings >= 162 ORDER BY era ASC LIMIT 25", ${NO_CHART}}

Q: Career WAR leaders since 2000 among hitters
{"plan": "SUM war over batting_seasons per player.", "sql": "SELECT player_name, COUNT(*) AS seasons, SUM(pa) AS pa, SUM(home_runs) AS home_runs, ROUND(SUM(war), 1) AS war FROM batting_seasons GROUP BY player_id, player_name ORDER BY SUM(war) DESC LIMIT 25", ${NO_CHART}}

Q: Hardest-hitting batters by average exit velocity in 2023, at least 300 PA
{"plan": "statcast_batting 2023 pa >= 300 ordered by avg_exit_velo, team from batting_seasons.", "sql": "SELECT s.player_name, b.team, s.pa, s.avg_exit_velo, s.hard_hit_pct, s.barrel_pct, s.xwoba FROM statcast_batting s JOIN batting_seasons b ON b.player_id = s.player_id AND b.season = s.season WHERE s.season = 2023 AND s.pa >= 300 ORDER BY s.avg_exit_velo DESC LIMIT 25", ${NO_CHART}}

Q: Best sweepers by run value in 2023
{"plan": "pitch_arsenal 2023 pitch_name 'Sweeper' ordered by run_value.", "sql": "SELECT player_name, team, pitches, usage_pct, run_value, run_value_per_100, whiff_pct, xwoba FROM pitch_arsenal WHERE season = 2023 AND pitch_name = 'Sweeper' AND pitches >= 200 ORDER BY run_value DESC LIMIT 25", ${NO_CHART}}

Q: Most strikeouts in a single game in 2024
{"plan": "pitching_games 2024 REG ordered by strikeouts.", "sql": "SELECT player_name, team, opponent, game_date, ROUND(innings, 1) AS innings, strikeouts, walks, earned_runs, pitches FROM pitching_games WHERE season = 2024 AND season_type = 'REG' ORDER BY strikeouts DESC LIMIT 25", ${NO_CHART}}

Q: Dodgers wins and run differential by season since 2015
{"plan": "team_seasons LAD since 2015.", "sql": "SELECT season, wins, losses, run_diff, division_rank FROM team_seasons WHERE team = 'LAD' AND season >= 2015 ORDER BY season", ${NO_CHART}}

Q: Scatter of wOBA vs xwOBA in 2023 for hitters with at least 400 PA
{"plan": "statcast_batting 2023 pa >= 400: woba and xwoba per player, team from batting_seasons.", "sql": "SELECT s.player_name, b.team, s.pa, s.woba, s.xwoba FROM statcast_batting s JOIN batting_seasons b ON b.player_id = s.player_id AND b.season = s.season WHERE s.season = 2023 AND s.pa >= 400 ORDER BY s.xwoba DESC LIMIT 100", "chart": {"type": "scatter", "x": "woba", "y": "xwoba", "label": "player_name", "series": "", "title": "wOBA vs xwOBA, 2023"}}

Q: Chart Shohei Ohtani's home runs by season
{"plan": "batting_seasons for Ohtani, home_runs per season.", "sql": "SELECT season, team, pa, home_runs, ROUND(ops, 3) AS ops FROM batting_seasons WHERE strip_accents(player_name) ILIKE '%ohtani%' ORDER BY season", "chart": {"type": "line", "x": "season", "y": "home_runs", "label": "", "series": "", "title": "Shohei Ohtani home runs by season"}}`;

function seasonContext(info: DataInfo): string {
  const month = info.latestDate ? Number(info.latestDate.slice(5, 7)) : 12;
  // Still going during the regular season and October's postseason; done by November.
  const inProgress =
    info.maxSeasonType === "REG" || (info.maxSeasonType === "POST" && month === 10);
  const lastComplete = inProgress ? info.maxSeason - 1 : info.maxSeason;
  const logsFrom = Number(info.extra.game_logs_from) || null;
  const lines = [
    `DATA: seasons ${info.minSeason}-${info.maxSeason} (season and team tables); Statcast tables 2015-${info.maxSeason}; game logs (batting_games, pitching_games) ${logsFrom ? `${logsFrom}-${info.maxSeason}` : "not loaded"}. Latest game: ${info.latestDate}${info.maxSeasonType === "POST" ? " (postseason)" : ""}.`,
    `"This season"/"this year" = ${info.maxSeason}${inProgress ? " (in progress)" : ""}. "Last season" = ${lastComplete}.`,
    `"Last N seasons" = the N most recent complete seasons, ending ${lastComplete}.`,
  ];
  return lines.join("\n");
}

export const mlbPrompt: SportPrompt = {
  intro:
    "You write one DuckDB SQL SELECT that answers an MLB stats question using MLB Stats API and Baseball Savant data.",
  seasonContext,
  rules: [
    RULE.oneSelect,
    RULE.onlyListed,
    "Season tables cover the regular season only. In games, team_games and the game logs, default to season_type = 'REG' unless the question mentions the playoffs/postseason/World Series.",
    RULE.leaderboard,
    RULE.sample("games or plate appearances", "pa, innings, batted_balls, pitches"),
    RULE.round("ORDER BY SUM(hits) / SUM(ab) DESC"),
    `Players: match the LAST NAME without accents: strip_accents(player_name) ILIKE '%acuna%'. Names have accents and suffixes ("Ronald Acuña Jr.", "Vladimir Guerrero Jr."), so never match the full name. For common last names (Garcia, Rodriguez, Martinez, Hernandez, Perez, Smith, Johnson, Williams, Jones, Brown, Castillo, Diaz, Ramirez) or families (Guerrero, Tatis, Bichette, Witt) add the start of the first name: ILIKE 'vlad%guerrero%'.`,
    "Teams are codes: ATH AZ ATL BAL BOS CHC CIN CLE COL CWS DET HOU KC LAA LAD MIA MIL MIN NYM NYY PHI PIT SD SEA SF STL TB TEX TOR WSH. Every season uses the franchise's current code (Expos = WSH, Marlins = MIA, Angels = LAA, A's = ATH, Guardians/Indians = CLE).",
    "A traded player's season row has team like 'BOS/NYY'. To find a team's players, use list_contains(string_split(team, '/'), 'NYY').",
  ],
  tables: [
    { view: "batting_seasons", title: (i) => `one row per batter per season, ${i.minSeason}-${i.maxSeason}`, cols: BATTING_COLS },
    { view: "pitching_seasons", title: () => "one row per pitcher per season", cols: PITCHING_COLS },
    { view: "fielding_seasons", title: () => "one row per player per position per season", cols: FIELDING_COLS },
    { view: "team_seasons", title: () => "one row per team per season (record, runs, team batting and pitching)", cols: TEAM_SEASONS_COLS },
    { view: "games", title: () => "one row per game, regular season and postseason", cols: GAMES_COLS },
    { view: "team_games", title: () => "one row per team per game", cols: TEAM_GAMES_COLS },
    { view: "batting_games", title: () => "one row per batter per game (recent seasons only)", cols: BATTING_GAMES_COLS },
    { view: "pitching_games", title: () => "one row per pitcher per game (recent seasons only)", cols: PITCHING_GAMES_COLS },
    { view: "statcast_batting", title: () => "Statcast batted-ball quality per batter per season, 2015+", cols: STATCAST_COLS },
    { view: "statcast_pitching", title: () => "the same, allowed by each pitcher, 2015+", cols: STATCAST_COLS },
    { view: "pitch_arsenal", title: () => "one row per pitcher per pitch type per season, 2015+", cols: ARSENAL_COLS },
    { view: "sprint_speed", title: () => "one row per runner per season, 2015+", cols: SPRINT_COLS },
    { view: "outs_above_average", title: () => "fielding range per player per season, 2016+", cols: OAA_COLS },
  ],
  idioms: IDIOMS,
  chartTeamHint:
    "Player charts: include team (batting_seasons / pitching_seasons) so points get team colors.",
  examples: EXAMPLES,
  errorHint(error, sql) {
    if (
      error.includes('Referenced column "team"') &&
      /\bstatcast_(batting|pitching)\b/i.test(sql)
    ) {
      return "\nHint: the statcast tables have no team column. JOIN batting_seasons b ON b.player_id = s.player_id AND b.season = s.season and use b.team.";
    }
    return "";
  },
  emptyHint:
    "It ran but returned 0 rows. Names have accents and suffixes ('Ronald Acuña Jr.'), so match on the last name only with strip_accents(player_name) ILIKE '%acuna%'. Also check team codes (every season uses the current code), the season and season_type.",
};
