import type { DataInfo } from "../db";
import { NO_CHART, RULE, type Col, type SportPrompt } from "../prompt-kit";

/** NBA prompt content: NBA Stats API tables, the idioms models get wrong, and worked examples. */

const PLAYER_GAMES_COLS: Col[] = [
  ["game_id, season", "season = the year it ends (2025 = 2024-25)"],
  [
    "season_type",
    "'REG', 'POST' (playoffs), 'PLAYIN', 'CUP' (NBA Cup final only; other Cup games are 'REG')",
  ],
  ["game_date", "DATE"],
  ["player_id, player_name", "full name, with accents ('Nikola Jokić')"],
  [
    "position",
    "'G','F','C','G-F','F-G','F-C','C-F' (latest known; NULL for some rookies)",
  ],
  ["team, opponent", "team codes"],
  ["is_home, started", "true/false"],
  ["win", "1/0"],
  ["min", "minutes played (decimal)"],
  ["pts, reb, oreb, dreb, ast, stl, blk, tov, pf", ""],
  ["fgm, fga, fg3m, fg3a, ftm, fta", "makes/attempts (fg3 = three-pointers)"],
  ["plus_minus", ""],
  [
    "fantasy_pts",
    "crabsketball league fantasy points: pts+reb+ast+stl+blk-tov+(fgm-fga)+(ftm-fta)",
  ],
];

const TEAM_GAMES_COLS: Col[] = [
  ["game_id, season, season_type, game_date", ""],
  ["team, opponent, is_home", ""],
  ["points_for, points_against, win, loss", "win/loss 1/0"],
  [
    "fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf",
    "team totals",
  ],
  ["possessions, opp_possessions", "estimated: fga - oreb + tov + 0.44*fta"],
  [
    "opp_fgm, opp_fga, opp_fg3m, opp_fg3a, opp_fta, opp_oreb, opp_reb, opp_tov",
    "opponent totals",
  ],
];

const PLAYER_SEASONS_COLS: Col[] = [
  ["season, season_type", "'REG' or 'POST'"],
  ["player_id, player_name, position, age", ""],
  [
    "team, team_count",
    "team = last team; team_count > 1 if traded (one combined row)",
  ],
  ["gp, w, l, min", "min = TOTAL minutes"],
  [
    "pts, reb, oreb, dreb, ast, stl, blk, tov, pf, fgm, fga, fg3m, fg3a, ftm, fta, plus_minus, dd2, td3, fantasy_pts",
    "season TOTALS (divide by gp for per game); dd2/td3 = double-/triple-doubles",
  ],
  [
    "ts_pct, efg_pct, usg_pct, ast_pct, oreb_pct, dreb_pct, reb_pct, tov_pct",
    "fractions 0-1",
  ],
  ["ast_to", "assist/turnover ratio"],
  [
    "off_rating, def_rating, net_rating",
    "points per 100 possessions with the player on court",
  ],
  ["pace, pie, poss", ""],
  ["bpm, obpm, dbpm", "box plus/minus"],
  ["rapm, o_rapm, d_rapm, darko", "impact ratings, higher = better"],
];

const TEAM_SEASONS_COLS: Col[] = [
  ["season, season_type, team, team_name", ""],
  ["gp, wins, losses, win_pct", ""],
  [
    "pts, reb, oreb, dreb, ast, stl, blk, tov, pf, fgm, fga, fg3m, fg3a, ftm, fta, plus_minus",
    "season totals",
  ],
  [
    "off_rating, def_rating, net_rating, pace",
    "per 100 possessions; lower def_rating = better",
  ],
  [
    "ts_pct, efg_pct, ast_pct, oreb_pct, dreb_pct, reb_pct, tov_pct, pie, poss",
    "",
  ],
];

const STANDINGS_COLS: Col[] = [
  ["season, team, team_name, conference, division", "conference 'East'/'West'"],
  [
    "wins, losses, win_pct, conference_seed, conference_games_back, division_rank",
    "",
  ],
  ["home, road, last_10, streak", "records as text, e.g. '34-7'"],
  ["points_pg, opp_points_pg, diff_points_pg, clinched", ""],
];

const GAMES_COLS: Col[] = [
  ["game_id, season, season_type, game_date", ""],
  ["home_team, away_team, home_pts, away_pts", ""],
];

const ROSTER_COLS: Col[] = [
  ["season, team, player_id, player_name, position", ""],
  [
    "height, weight, age, years_exp, school, jersey",
    "height text like '6-8'",
  ],
];

const IDIOMS = `NBA IDIOMS (use these exact definitions)
- Per-game averages: AVG(stat) over player_games (one row per game played). For completed seasons, player_seasons totals / gp give the same.
- Shooting: FG% = SUM(fgm) / SUM(fga); 3P% = SUM(fg3m) / SUM(fg3a); FT% = SUM(ftm) / SUM(fta); TS% = SUM(pts) / (2 * (SUM(fga) + 0.44 * SUM(fta))); eFG% = (SUM(fgm) + 0.5 * SUM(fg3m)) / SUM(fga). Never average per-game percentages.
- Per 36 minutes: 36 * SUM(stat) / SUM(min).
- Team ratings from team_games: offensive = 100 * SUM(points_for) / SUM(possessions); defensive = 100 * SUM(points_against) / SUM(opp_possessions); pace = (SUM(possessions) + SUM(opp_possessions)) / 2 / COUNT(*).
- Usage, on-court ratings, PIE, BPM, RAPM and DARKO exist only in player_seasons.
- Double-double / triple-double in a game: at least 2 / 3 of pts, reb, ast, stl, blk >= 10, e.g. (pts >= 10)::INT + (reb >= 10)::INT + (ast >= 10)::INT + (stl >= 10)::INT + (blk >= 10)::INT >= 3.
- Career or season totals: SUM over player_games GROUP BY player_id, player_name. Don't GROUP BY team (traded players would split); show STRING_AGG(DISTINCT team, '/') AS team instead.
- Recent form ("last 10 games"): ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) AS rn in a CTE, then WHERE rn <= 10. "Last 2 weeks": game_date >= (SELECT MAX(game_date) FROM player_games) - INTERVAL 14 DAY.
- Fantasy questions ("fantasy points", "fantasy", "crabsketball", "our league"): use fantasy_pts.
- Team records and home/away splits: team_games (SUM(win), SUM(loss)); final standings and seeds: standings.`;

const EXAMPLES = `EXAMPLES
Q: Highest scoring average in 2024-25, minimum 50 games
{"plan": "player_games 2025 REG: average pts per player, min 50 games.", "sql": "SELECT player_name, STRING_AGG(DISTINCT team, '/') AS team, COUNT(*) AS games, ROUND(AVG(pts), 1) AS ppg FROM player_games WHERE season = 2025 AND season_type = 'REG' GROUP BY player_id, player_name HAVING COUNT(*) >= 50 ORDER BY AVG(pts) DESC LIMIT 25", ${NO_CHART}}

Q: Best true shooting percentage in 2024 among players with at least 1000 shot attempts
{"plan": "player_seasons 2024 REG with fga >= 1000, ordered by ts_pct.", "sql": "SELECT player_name, team, gp, fga, ROUND(100 * ts_pct, 1) AS ts_pct, ROUND(100 * usg_pct, 1) AS usg_pct FROM player_seasons WHERE season = 2024 AND season_type = 'REG' AND fga >= 1000 ORDER BY ts_pct DESC LIMIT 25", ${NO_CHART}}

Q: Most crabsketball fantasy points per game over each player's last 10 games of the 2026 season
{"plan": "player_games 2026 REG, last 10 games per player via ROW_NUMBER, average fantasy_pts.", "sql": "WITH recent AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) AS rn FROM player_games WHERE season = 2026 AND season_type = 'REG') SELECT player_name, ARG_MAX(team, game_date) AS team, COUNT(*) AS games, ROUND(AVG(fantasy_pts), 1) AS fantasy_ppg, ROUND(AVG(min), 1) AS mpg FROM recent WHERE rn <= 10 GROUP BY player_id, player_name HAVING COUNT(*) >= 5 ORDER BY AVG(fantasy_pts) DESC LIMIT 25", ${NO_CHART}}

Q: Nikola Jokic game log in the 2025 playoffs
{"plan": "player_games for Jokić, 2025 POST, one row per game.", "sql": "SELECT game_date, opponent, win, ROUND(min, 1) AS min, pts, reb, ast, stl, blk, fantasy_pts FROM player_games WHERE strip_accents(player_name) ILIKE '%jokic%' AND season = 2025 AND season_type = 'POST' ORDER BY game_date", ${NO_CHART}}

Q: Best defenses in 2025 by defensive rating
{"plan": "team_seasons 2025 REG ordered by def_rating ascending.", "sql": "SELECT team, wins, losses, def_rating, off_rating, net_rating FROM team_seasons WHERE season = 2025 AND season_type = 'REG' ORDER BY def_rating ASC LIMIT 30", ${NO_CHART}}

Q: Celtics record and scoring at home vs away in 2025
{"plan": "team_games BOS 2025 REG grouped by is_home.", "sql": "SELECT CASE WHEN is_home THEN 'home' ELSE 'away' END AS venue, COUNT(*) AS games, SUM(win) AS wins, SUM(loss) AS losses, ROUND(AVG(points_for), 1) AS ppg, ROUND(AVG(points_against), 1) AS opp_ppg FROM team_games WHERE team = 'BOS' AND season = 2025 AND season_type = 'REG' GROUP BY is_home ORDER BY venue", ${NO_CHART}}

Q: Most triple-doubles in a single season since 2015
{"plan": "player_games REG since 2015: count games with 3+ double-digit categories per player-season.", "sql": "SELECT player_name, season, STRING_AGG(DISTINCT team, '/') AS team, SUM(CASE WHEN (pts >= 10)::INT + (reb >= 10)::INT + (ast >= 10)::INT + (stl >= 10)::INT + (blk >= 10)::INT >= 3 THEN 1 ELSE 0 END) AS triple_doubles FROM player_games WHERE season >= 2015 AND season_type = 'REG' GROUP BY player_id, player_name, season ORDER BY triple_doubles DESC LIMIT 25", ${NO_CHART}}

Q: Centers with the most rebounds per 36 minutes in 2025, minimum 1000 minutes
{"plan": "player_games 2025 REG, position containing C, 36 * rebounds / minutes, min 1000 minutes.", "sql": "SELECT player_name, ARG_MAX(team, game_date) AS team, COUNT(*) AS games, ROUND(SUM(min)) AS minutes, ROUND(36 * SUM(reb) / SUM(min), 1) AS reb_per_36 FROM player_games WHERE season = 2025 AND season_type = 'REG' AND position LIKE '%C%' GROUP BY player_id, player_name HAVING SUM(min) >= 1000 ORDER BY SUM(reb) / SUM(min) DESC LIMIT 25", ${NO_CHART}}

Q: Scatter of usage rate vs true shooting in 2025, minimum 1500 minutes
{"plan": "player_seasons 2025 REG with min >= 1500: usg_pct and ts_pct per player.", "sql": "SELECT player_name, team, ROUND(min) AS minutes, ROUND(100 * usg_pct, 1) AS usg_pct, ROUND(100 * ts_pct, 1) AS ts_pct FROM player_seasons WHERE season = 2025 AND season_type = 'REG' AND min >= 1500 ORDER BY usg_pct DESC LIMIT 100", "chart": {"type": "scatter", "x": "usg_pct", "y": "ts_pct", "label": "player_name", "series": "", "title": "Usage vs true shooting, 2024-25"}}

Q: Chart Stephen Curry's three-point attempts per game by season
{"plan": "player_games for Stephen Curry, REG, per season average fg3a.", "sql": "SELECT season, COUNT(*) AS games, ROUND(AVG(fg3a), 1) AS fg3a_per_game, ROUND(100.0 * SUM(fg3m) / SUM(fg3a), 1) AS fg3_pct FROM player_games WHERE strip_accents(player_name) ILIKE 'steph%curry%' AND season_type = 'REG' GROUP BY season ORDER BY season", "chart": {"type": "line", "x": "season", "y": "fg3a_per_game", "label": "", "series": "", "title": "Stephen Curry 3-point attempts per game"}}`;

const seasonLabel = (y: number) => `${y - 1}-${String(y).slice(2)}`;

/** In progress from October through the Finals in June. */
function seasonContext(info: DataInfo): string {
  const month = info.latestDate ? Number(info.latestDate.slice(5, 7)) : 7;
  const inProgress = month >= 10 || month <= 6;
  const lastComplete = inProgress ? info.maxSeason - 1 : info.maxSeason;
  const lines = [
    `DATA: seasons ${info.minSeason}-${info.maxSeason}. A season is named by the year it ends: ${info.maxSeason} = the ${seasonLabel(info.maxSeason)} season, and "2024-25" = 2025. Latest game: ${info.latestDate}.`,
    `"This season"/"this year" = ${info.maxSeason}${inProgress ? " (in progress)" : ""}. "Last season" = ${lastComplete} (${seasonLabel(lastComplete)}).`,
    `"Last N seasons" = the N most recent complete seasons, ending ${lastComplete}.`,
  ];
  if (info.statsThrough != null && info.statsThrough < info.maxSeason) {
    lines.push(
      `player_seasons, team_seasons and standings run through ${info.statsThrough}. For ${info.maxSeason} compute everything from player_games and team_games (usage, on-court ratings and BPM aren't available for it).`,
    );
  }
  return lines.join("\n");
}

export const nbaPrompt: SportPrompt = {
  intro:
    "You write one DuckDB SQL SELECT that answers an NBA stats question using NBA Stats API data.",
  seasonContext,
  rules: [
    RULE.oneSelect,
    RULE.onlyListed,
    "Default to the regular season (season_type = 'REG') unless the question mentions playoffs/postseason ('POST') or the play-in ('PLAYIN').",
    RULE.leaderboard,
    RULE.sample("games or minutes", "games, minutes, fga"),
    RULE.round("ORDER BY SUM(pts) / COUNT(*) DESC"),
    `Players: match the LAST NAME without accents: strip_accents(player_name) ILIKE '%jokic%'. Names have accents and punctuation ("Luka Dončić", "Shai Gilgeous-Alexander"), so never match the full name. For common last names (Anderson, Brown, Davis, Green, Harris, Jackson, Johnson, Jones, Murray, Smith, Thompson, Williams) or brothers (Curry, Ball, Antetokounmpo, Holiday) add the start of the first name: ILIKE 'steph%curry%'.`,
    "Positions: centers = position LIKE '%C%', forwards '%F%', guards '%G%' (hybrids like 'F-C' count for both).",
    "Teams are codes: ATL BKN BOS CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS. Older seasons keep the code of the time: SEA (now OKC), NJN (now BKN), NOH/NOK (now NOP), VAN (now MEM), CHH (Charlotte through 2002).",
  ],
  tables: [
    {
      view: "player_games",
      title: (i) =>
        `one row per player per game played, ${i.minSeason}-${i.maxSeason}`,
      cols: PLAYER_GAMES_COLS,
    },
    {
      view: "team_games",
      title: () => "one row per team per game",
      cols: TEAM_GAMES_COLS,
    },
    {
      view: "player_seasons",
      title: (i) =>
        `one row per player per season and season_type, through ${i.statsThrough ?? i.maxSeason}`,
      cols: PLAYER_SEASONS_COLS,
    },
    {
      view: "team_seasons",
      title: (i) =>
        `one row per team per season and season_type, through ${i.statsThrough ?? i.maxSeason}`,
      cols: TEAM_SEASONS_COLS,
    },
    {
      view: "standings",
      title: () => "final regular-season standings, one row per team per season",
      cols: STANDINGS_COLS,
    },
    { view: "games", title: () => "one row per game", cols: GAMES_COLS },
    {
      view: "rosters",
      title: () => "player bio, one row per player per team per season",
      cols: ROSTER_COLS,
    },
  ],
  idioms: IDIOMS,
  chartTeamHint:
    "Player charts: include ARG_MAX(team, game_date) AS team (player_games) or team (player_seasons) so points get team colors.",
  examples: EXAMPLES,
  errorHint(error, sql) {
    if (
      /Referenced column "(usg_pct|ts_pct|efg_pct|off_rating|def_rating|net_rating|pie|pace|bpm|rapm|darko)"/.test(
        error,
      ) &&
      /\bplayer_games\b/i.test(sql)
    ) {
      return "\nHint: player_games only has box score stats. Compute TS% and eFG% from the makes and attempts, or use player_seasons for usage, ratings, PIE, BPM and RAPM.";
    }
    return "";
  },
  emptyHint:
    "It ran but returned 0 rows. Names have accents ('Nikola Jokić'), so match on the last name only with strip_accents(player_name) ILIKE '%jokic%'. Also check team codes, the season (named by the year it ends: 2025 = 2024-25) and season_type.",
};
