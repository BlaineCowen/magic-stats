import type { DataInfo } from "../db";
import { NO_CHART, RULE, type Col, type SportPrompt } from "../prompt-kit";

/**
 * NFL prompt content: nflverse tables, the nflfastR idioms small models get
 * wrong, and worked examples.
 */

const PBP_COLS: Col[] = [
  ["season, week", "int"],
  ["season_type", "'REG' or 'POST'"],
  ["game_id", "e.g. '2024_01_BAL_KC'"],
  ["game_date", "'YYYY-MM-DD'"],
  ["posteam, defteam", "offense / defense team abbr"],
  ["home_team, away_team", "team abbr"],
  ["qtr", "quarter, 5 = OT"],
  ["down, ydstogo", "down (1-4) and yards to go"],
  ["yardline_100", "yards from opponent end zone (<=20 = red zone)"],
  ["goal_to_go", "1 if goal-to-go"],
  ["half_seconds_remaining, game_seconds_remaining", "clock"],
  ["score_differential", "posteam score minus defteam score before the play"],
  ["wp", "posteam win probability before the play (0-1)"],
  ["epa", "expected points added"],
  ["wpa", "win probability added"],
  ["success", "1 if epa > 0"],
  [
    "play_type",
    "'pass','run','punt','field_goal','kickoff','extra_point','qb_kneel','qb_spike','no_play'",
  ],
  ["qb_dropback", "1 on dropbacks (passes, sacks, scrambles)"],
  ["qb_scramble", "1 if QB scramble"],
  ["sack", "1 if sack"],
  ["pass_attempt", "1 on pass attempts (includes sacks)"],
  ["complete_pass, incomplete_pass, interception", "0/1"],
  ["touchdown, pass_touchdown, rush_touchdown", "0/1"],
  ["yards_gained", "yards on the play"],
  ["air_yards", "intended air yards"],
  ["yards_after_catch", "YAC"],
  ["pass_length", "'short' or 'deep'"],
  ["pass_location, run_location", "'left','middle','right'"],
  ["shotgun, no_huddle", "0/1"],
  ["first_down", "1 if play gained a first down"],
  ["third_down_converted, third_down_failed", "0/1"],
  ["fourth_down_converted, fourth_down_failed", "0/1"],
  ["penalty, penalty_yards", "penalty flag and yards"],
  ["fumble, fumble_lost", "0/1"],
  ["cpoe", "completion % over expected (pass attempts only)"],
  ["xpass", "probability the play is a pass"],
  ["passer_full_name, passer_id", "dropback QB incl. sacks/scrambles"],
  ["rusher_full_name, rusher_id", "ball carrier (not scrambles)"],
  ["receiver_full_name, receiver_id", "targeted receiver"],
  ["drive", "drive number in game"],
  ["roof, surface, temp, wind", "game conditions"],
  ["div_game", "1 if divisional game"],
  ["spread_line, total_line", "closing line (spread_line > 0 = home favored)"],
  ["field_goal_result, kick_distance", "'made','missed','blocked'; yards"],
];

const PLAYER_WEEK_COLS: Col[] = [
  ["player_id, player_display_name", "gsis id, full name"],
  ["position, position_group", "e.g. 'QB','WR'"],
  ["season, week, season_type, game_id", ""],
  ["team, opponent_team", "abbr"],
  [
    "completions, attempts, passing_yards, passing_tds, passing_interceptions",
    "",
  ],
  [
    "sacks_suffered, passing_air_yards, passing_first_downs, passing_epa, passing_cpoe",
    "",
  ],
  ["carries, rushing_yards, rushing_tds, rushing_first_downs, rushing_epa", ""],
  [
    "receptions, targets, receiving_yards, receiving_tds, receiving_air_yards, receiving_yards_after_catch, receiving_epa",
    "",
  ],
  [
    "target_share, air_yards_share, wopr, racr",
    "per-game shares/ratios: average them, don't sum",
  ],
  [
    "def_tackles_solo, def_tackle_assists, def_tackles_for_loss, def_sacks, def_qb_hits, def_interceptions, def_pass_defended, def_fumbles_forced, def_tds",
    "",
  ],
  ["fg_made, fg_att, fg_long, pat_made, pat_att", ""],
  ["fantasy_points, fantasy_points_ppr", ""],
];

const TEAM_WEEK_COLS: Col[] = [
  ["season, week, season_type, game_id, team, opponent_team", ""],
  [
    "same stat columns as player_week (passing_yards, rushing_yards, def_sacks, ...)",
    "",
  ],
];

const TEAM_GAMES_COLS: Col[] = [
  ["game_id, season, week, gameday", ""],
  [
    "season_type, game_type",
    "'REG'/'POST'; game_type 'REG','WC','DIV','CON','SB'",
  ],
  ["team, opponent, is_home", "is_home true/false"],
  ["points_for, points_against", "NULL if not played yet"],
  ["win, loss, tie", "1/0 (NULL if not played yet)"],
  ["favored_by", "closing spread from this team's view (negative = underdog)"],
  [
    "total_line, overtime, div_game, qb_name, coach, roof, surface, temp, wind",
    "",
  ],
];

const GAMES_COLS: Col[] = [
  ["game_id, season, week", ""],
  ["game_type", "'REG','WC','DIV','CON','SB'"],
  ["gameday", "'YYYY-MM-DD'"],
  ["home_team, away_team, home_score, away_score", ""],
  ["result", "home_score - away_score"],
  ["total, overtime", ""],
  [
    "spread_line, total_line, home_moneyline, away_moneyline",
    "spread_line > 0 = home favored",
  ],
  ["home_qb_name, away_qb_name, home_coach, away_coach", ""],
  ["roof, surface, temp, wind, stadium, div_game", ""],
];

const ROSTER_COLS: Col[] = [
  ["season, team, position, full_name, gsis_id", ""],
  [
    "birth_date, height, weight, college, years_exp, rookie_year, draft_number",
    "",
  ],
];

const PFR_COMMON: Col = [
  "season, week, game_type, game_id, team, opponent, pfr_player_name, player_id, position",
  "game_type 'REG' or playoff codes; pfr_player_name is the full name; player_id joins player_week; position e.g. 'RB'",
];
const PFR_RUSH_COLS: Col[] = [
  PFR_COMMON,
  ["carries", ""],
  ["rushing_yards_before_contact, rushing_yards_after_contact", ""],
  ["rushing_broken_tackles, receiving_broken_tackles", ""],
];
const PFR_REC_COLS: Col[] = [
  PFR_COMMON,
  ["receiving_drop", "passes dropped"],
  ["receiving_broken_tackles", ""],
  ["receiving_int", "interceptions when targeted"],
  ["receiving_rat", "passer rating when targeted"],
];
const PFR_PASS_COLS: Col[] = [
  PFR_COMMON,
  ["passing_drops", "drops by the QB's receivers"],
  ["passing_bad_throws", ""],
  [
    "times_blitzed, times_hurried, times_hit, times_pressured, times_sacked",
    "",
  ],
];
const PFR_DEF_COLS: Col[] = [
  PFR_COMMON,
  [
    "def_targets, def_completions_allowed, def_yards_allowed, def_receiving_td_allowed",
    "in coverage",
  ],
  [
    "def_ints, def_sacks, def_pressures, def_times_hurried, def_times_hitqb, def_times_blitzed",
    "",
  ],
  ["def_tackles_combined, def_missed_tackles", ""],
];

const XFP_COLS: Col[] = [
  ["season, week, season_type, game_id", "season_type 'REG' or 'POST'"],
  [
    "player_id, player_name, position, team",
    "player_id is the gsis id (joins player_week.player_id)",
  ],
  ["targets, carries, pass_attempts", ""],
  ["receptions, receptions_exp", "actual and expected catches"],
  [
    "rec_yards, rec_yards_exp, rush_yards, rush_yards_exp, pass_yards, pass_yards_exp",
    "",
  ],
  ["touchdowns, touchdowns_exp", "all TDs scored, actual and expected"],
  [
    "rec_air_yards, team_air_yards, team_targets, team_carries",
    "team totals in the same game, for shares",
  ],
  [
    "fantasy_points, fantasy_points_exp, fantasy_points_diff",
    "PPR: actual, expected from the player's usage, actual minus expected",
  ],
  [
    "pass_fantasy_points, pass_fantasy_points_exp, rec_fantasy_points, rec_fantasy_points_exp, rush_fantasy_points, rush_fantasy_points_exp",
    "by phase",
  ],
];
const NGS_COMMON: Col = [
  "season, season_type, week, player_display_name, player_position, player_id, team",
  "week 0 = whole season (season_type 'REG'); only players over the NFL's weekly minimum appear",
];
const NGS_PASS_COLS: Col[] = [
  NGS_COMMON,
  [
    "attempts, completions, pass_yards, pass_touchdowns, interceptions, passer_rating",
    "",
  ],
  ["avg_time_to_throw", "seconds"],
  ["aggressiveness", "% of throws into tight coverage"],
  [
    "avg_intended_air_yards, avg_completed_air_yards, avg_air_yards_to_sticks",
    "",
  ],
  [
    "expected_completion_percentage, completion_percentage_above_expectation",
    "percent units",
  ],
];
const NGS_REC_COLS: Col[] = [
  NGS_COMMON,
  ["targets, receptions, yards, rec_touchdowns, catch_percentage", ""],
  ["avg_separation", "yards from the nearest defender when the ball arrives"],
  ["avg_cushion", "yards off the receiver at the snap"],
  ["avg_intended_air_yards, percent_share_of_intended_air_yards", ""],
  ["avg_yac, avg_expected_yac, avg_yac_above_expectation", ""],
];
const NGS_RUSH_COLS: Col[] = [
  NGS_COMMON,
  ["rush_attempts, rush_yards, avg_rush_yards, rush_touchdowns", ""],
  [
    "expected_rush_yards, rush_yards_over_expected, rush_yards_over_expected_per_att, rush_pct_over_expected",
    "RYOE",
  ],
  ["percent_attempts_gte_eight_defenders", "% of carries vs 8+ in the box"],
  [
    "efficiency, avg_time_to_los",
    "distance run per yard gained; seconds to the line",
  ],
];
const FTN_COLS: Col[] = [
  ["game_id, play_id", "JOIN pbp USING (game_id, play_id); 2022 on"],
  ["season, week", ""],
  [
    "is_play_action, is_motion, is_screen_pass, is_rpo, is_trick_play, is_qb_sneak",
    "booleans",
  ],
  [
    "is_qb_out_of_pocket, is_throw_away, is_interception_worthy",
    "interception_worthy = a bad decision whether or not it was picked",
  ],
  [
    "is_catchable_ball, is_contested_ball, is_created_reception, is_drop",
    "created = a tough catch the receiver made himself",
  ],
  ["n_blitzers, n_pass_rushers, n_defense_box, n_offense_backfield", ""],
  ["qb_location", "'S' shotgun, 'U' under center, 'P' pistol"],
];
const SNAP_COLS: Col[] = [
  [
    "season, week, game_type, game_id, player, player_id, position, team, opponent",
    "game_type 'REG' or playoff codes",
  ],
  [
    "offense_snaps, offense_pct, defense_snaps, defense_pct, st_snaps, st_pct",
    "pct is a 0-1 share of the team's snaps",
  ],
];
const ROUTE_COLS: Col[] = [
  ["season, week, game_id, player_id, team, position", "regular season, RB/WR/TE"],
  [
    "routes, estimated",
    "pass plays he was on the field for; estimated = true when the real count isn't published yet (the current season), then routes is snaps times the team's dropback rate",
  ],
  ["targets, receptions, rec_yards", ""],
];
const QBR_COLS: Col[] = [
  [
    "season, season_type, team, player_name, qualified",
    "season_type 'Regular' or 'Playoffs'",
  ],
  ["qbr_total", "ESPN Total QBR, 0-100"],
  ["pts_added, qb_plays, epa_total", ""],
];
const CONTRACT_COLS: Col[] = [
  [
    "player_name, player_id, position, team, is_active",
    "one row per contract; is_active = the current deal",
  ],
  ["year_signed, years, value, apy, guaranteed", "millions of dollars"],
  ["apy_cap_pct", "0-1 share of the cap when signed"],
  ["draft_year, draft_round, draft_overall", ""],
];
const CONTRACT_YEAR_COLS: Col[] = [
  [
    "player_name, player_id, position, season, team",
    "one row per player per season",
  ],
  [
    "cap_number, cash_paid, base_salary, guaranteed_salary",
    "millions of dollars",
  ],
  ["cap_percent", "percent units (5.2 = 5.2% of the cap)"],
];

const PROJ_COLS: Col[] = [
  [
    "player_id, name, position, team, opp, season, week, game_id",
    "each player's next game",
  ],
  [
    "proj, floor, median, ceiling",
    "projected PPR; floor/ceiling = 10th/90th percentile",
  ],
  [
    "breakout_prob",
    "chance a not-yet-starter averages starter PPR over his next 4 games (NULL if already a starter)",
  ],
  [
    "ppr_pg, xfp_pg, ppr_l3, xfp_l3, luck_pg",
    "season and last-3 PPR and expected PPR per game; luck = actual minus expected",
  ],
  [
    "tgt_share, tgt_share_l3, car_share, car_share_l3, snap_pct, snap_l3",
    "0-1 shares",
  ],
  ["vacated_tgt, vacated_car", "team share freed up by teammates who are out"],
  ["implied_total, spread, temp_f, wind_mph, indoor", "game context"],
  [
    "ros_proj, ros_games, ros_ppg",
    "rest-of-season projected PPR total, games left, per game",
  ],
  [
    "ros_sos",
    "remaining schedule: opponents' PPR allowed to the position minus league average (positive = easy)",
  ],
  ["out_next", "true if ruled out of his next game"],
];
const PROJ_WEEKLY_COLS: Col[] = [
  [
    "player_id, name, team, position, season, week, opp, home, horizon",
    "horizon 1 = next game",
  ],
  ["proj, floor, median, ceiling", "projected PPR for that game"],
];

const FUZZY = `- projections, "who should I start", ceiling, upside, sleepers, breakouts this week: the projections table (this week only). Highest ceiling = ORDER BY ceiling DESC; breakout candidates = ORDER BY breakout_prob DESC. Rest of season = ros_proj (projections); a specific future week = projections_weekly.
- expected fantasy points / "due for regression" / lucky or unlucky in fantasy: xfp. SUM(fantasy_points_diff) per player; most negative = unlucky (due to bounce back), most positive = lucky (due to fall off). Show games, opportunities (targets + carries), actual and expected points.
- separation, cushion, YAC over expected, time to throw, aggressiveness, rush yards over expected (RYOE), stacked boxes: the ngs_* tables (week 0 for season numbers).
- play action, motion, RPOs, screens, blitzes, contested or catchable targets, drops, created receptions, interception-worthy throws: pbp JOIN ftn USING (game_id, play_id), 2022 on.
- QBR: qbr_season or qbr_week.
- "overpaid" / "bad contract" / value per dollar: contract_years cap_number for that season joined on player_id to production (player_week fantasy points or EPA); rank cost per point. "Best value" is the reverse.
- snap share, "plays every snap", "barely plays": snaps.offense_pct.
- yards per route run (YPRR), targets per route run (TPRR), routes run, route participation: the routes table. YPRR = SUM(rec_yards) / SUM(routes) per player; TPRR = SUM(targets) / SUM(routes). Require a minimum (SUM(routes) >= 100 for a season) and compare within a position.
- broken tackles, drops, bad throws, pressure, missed tackles, yards after contact: the pfr_* tables (2018 on). SUM per player_id, pfr_player_name; filter game_type = 'REG' for the regular season. Their counts are often NULL, so wrap each in coalesce(x, 0) before adding columns together. "Broken tackles" for a runner means rushing_broken_tackles unless the question says catches too.
- "fraud" team: won more than its points say it should. From team_games: wins - games * POW(pf, 2.37) / (POW(pf, 2.37) + POW(pa, 2.37)) where pf/pa are summed points; higher = bigger fraud. Show record, point differential and expected wins. "Unlucky" is the reverse.
- "lucky": record in one-score games (ABS(points_for - points_against) <= 8).
- QB "carried by his receivers" / YAC merchant: on completions (pbp complete_pass = 1), SUM(yards_after_catch) / SUM(passing_yards) is the share of his yards gained after the catch; also SUM(yards_after_catch - xyac_mean_yardage) = YAC over expected. Min 100 completions for a season.
- "garbage time": pbp plays in the 4th quarter with wp < 0.10 or wp > 0.90. Garbage-time PPR points per play: 0.1 * coalesce(rushing_yards,0) + 0.1 * coalesce(receiving_yards,0) + complete_pass (for the receiver) + 6 * touchdown (for the rusher or receiver) + 0.04 * coalesce(passing_yards,0) + 4 * pass_touchdown - 2 * interception (for the passer). Credit each player via rusher_id/receiver_id/passer_id with their full name; show garbage-time points and the share of their total.
- "clutch": 4th quarter or overtime with score_differential BETWEEN -8 AND 0; rank by SUM(wpa) or EPA with a minimum sample. "Choker" team: games it lost after its win probability hit 0.90 (max of wp when posteam = team, 1 - wp when defteam = team).
- "vulture": touchdowns from inside the 5 (yardline_100 <= 5) per touch there.
- "gunslinger": highest average air_yards on pass attempts plus interceptions; "checkdown king": lowest average air_yards.
- "washed": biggest drop in a key stat from the previous season to this one (self-join on season - 1), min sample both years.
- "empty stats" / stat padder: production in losses or in garbage time.
- "covers the spread": team_games margin (points_for - points_against) > favored_by.`;

const IDIOMS = `NFL IDIOMS (use these exact definitions)
- QB season totals (passing yards, TDs, INTs, completion %): player_week, named player_display_name. passer_full_name/passer_id exist ONLY in pbp.
- QB efficiency / "per dropback": pbp WHERE qb_dropback = 1, GROUP BY passer_id, passer_full_name.
- Season rate stats (completion %, yards per attempt/carry/target, TD %): from player_week totals, e.g. SUM(completions) / SUM(attempts). In pbp (situational splits only): AVG(complete_pass) WHERE pass_attempt = 1 AND sack = 0.
- Designed runs: play_type = 'run' AND qb_scramble = 0.
- Team offense EPA/play: WHERE play_type IN ('pass','run') GROUP BY posteam. Defense: GROUP BY defteam (lower is better).
- Success rate: AVG(success). Red zone: yardline_100 <= 20. Deep pass: air_yards >= 20.
- 3rd/4th-down conversions: attempts = SUM(third_down_converted) + SUM(third_down_failed) (4th: fourth_down_*); rate = SUM(..._converted) / attempts. Report attempts as the sample size.
- "Neutral"/"competitive" situations only if asked: wp BETWEEN 0.1 AND 0.9.
- Player season or career TOTALS (yards, TDs, sacks, fantasy points): SUM over player_week, GROUP BY player_id, player_display_name. Don't GROUP BY team (traded players would split); show STRING_AGG(DISTINCT team, '/') AS team instead. Use pbp only for situational splits or play-level metrics (EPA, CPOE, success, air yards).
- Team records, points scored/allowed, home/away splits: team_games (one row per team per game). Filter points_for IS NOT NULL to skip unplayed games.`;

const EXAMPLES = `EXAMPLES
Q: Who led the league in rushing yards in 2024?
{"plan": "Sum rushing_yards from player_week for 2024 regular season per player.", "sql": "SELECT player_display_name, STRING_AGG(DISTINCT team, '/') AS team, SUM(carries) AS carries, SUM(rushing_yards) AS rushing_yards, SUM(rushing_tds) AS rushing_tds FROM player_week WHERE season = 2024 AND season_type = 'REG' GROUP BY player_id, player_display_name ORDER BY rushing_yards DESC LIMIT 10", ${NO_CHART}}

Q: Most passing yards in 2023, with touchdowns, interceptions and completion percentage
{"plan": "player_week QB season totals for 2023 REG: sum passing stats per player_display_name.", "sql": "SELECT player_display_name, STRING_AGG(DISTINCT team, '/') AS team, SUM(completions) AS completions, SUM(attempts) AS attempts, ROUND(100.0 * SUM(completions) / SUM(attempts), 1) AS completion_pct, SUM(passing_yards) AS passing_yards, SUM(passing_tds) AS passing_tds, SUM(passing_interceptions) AS interceptions FROM player_week WHERE season = 2023 AND season_type = 'REG' AND position = 'QB' GROUP BY player_id, player_display_name ORDER BY passing_yards DESC LIMIT 25", ${NO_CHART}}

Q: Best QBs by EPA per dropback on 3rd down from 2021 to 2023, minimum 150 dropbacks
{"plan": "pbp dropbacks on 3rd down 2021-2023 REG, avg epa per passer, min 150.", "sql": "SELECT passer_full_name, COUNT(*) AS dropbacks, ROUND(AVG(epa), 3) AS epa_per_dropback, ROUND(AVG(success), 3) AS success_rate FROM pbp WHERE season BETWEEN 2021 AND 2023 AND season_type = 'REG' AND down = 3 AND qb_dropback = 1 GROUP BY passer_id, passer_full_name HAVING COUNT(*) >= 150 ORDER BY epa_per_dropback DESC LIMIT 25", ${NO_CHART}}

Q: Chiefs record and point differential each season since 2020
{"plan": "team_games for KC, REG, since 2020, per season wins, losses and points for minus against.", "sql": "SELECT season, COUNT(*) AS games, SUM(win) AS wins, SUM(loss) AS losses, SUM(points_for) - SUM(points_against) AS point_diff FROM team_games WHERE team = 'KC' AND season_type = 'REG' AND season >= 2020 AND points_for IS NOT NULL GROUP BY season ORDER BY season", ${NO_CHART}}

Q: Justin Jefferson game log in 2022
{"plan": "player_week rows for Jefferson in 2022, one per game.", "sql": "SELECT week, season_type, opponent_team, targets, receptions, receiving_yards, receiving_tds FROM player_week WHERE player_display_name ILIKE 'j%jefferson%' AND season = 2022 ORDER BY season_type DESC, week", ${NO_CHART}}

Q: Which defenses allowed the lowest success rate on designed runs in 2023?
{"plan": "pbp designed runs 2023 REG grouped by defteam, avg success ascending.", "sql": "SELECT defteam, COUNT(*) AS n_plays, ROUND(AVG(success), 3) AS success_rate_allowed, ROUND(AVG(epa), 3) AS epa_per_play FROM pbp WHERE season = 2023 AND season_type = 'REG' AND play_type = 'run' AND qb_scramble = 0 GROUP BY defteam ORDER BY success_rate_allowed ASC LIMIT 32", ${NO_CHART}}

Q: Most sacks in a single season since 2010
{"plan": "Sum def_sacks per player per season from player_week REG since 2010.", "sql": "SELECT player_display_name, season, STRING_AGG(DISTINCT team, '/') AS team, SUM(def_sacks) AS sacks FROM player_week WHERE season >= 2010 AND season_type = 'REG' GROUP BY player_id, player_display_name, season ORDER BY sacks DESC LIMIT 25", ${NO_CHART}}

Q: Josh Allen completion percentage and EPA on deep passes by season
{"plan": "pbp pass attempts by Allen with air_yards >= 20, per season.", "sql": "SELECT season, COUNT(*) AS attempts, ROUND(100 * AVG(complete_pass), 1) AS completion_pct, ROUND(AVG(epa), 3) AS epa_per_attempt FROM pbp WHERE passer_full_name ILIKE 'j%allen%' AND pass_attempt = 1 AND sack = 0 AND air_yards >= 20 AND season_type = 'REG' GROUP BY season ORDER BY season", ${NO_CHART}}

Q: Scatter of QB CPOE vs EPA per dropback from 2022 to 2023, min 400 dropbacks
{"plan": "pbp dropbacks 2022-2023 REG per passer: avg cpoe and epa, min 400, every qualifying QB.", "sql": "SELECT passer_full_name, ARG_MAX(posteam, game_id) AS team, COUNT(*) AS dropbacks, ROUND(AVG(cpoe), 1) AS cpoe, ROUND(AVG(epa), 3) AS epa_per_dropback FROM pbp WHERE season BETWEEN 2022 AND 2023 AND season_type = 'REG' AND qb_dropback = 1 GROUP BY passer_id, passer_full_name HAVING COUNT(*) >= 400 ORDER BY AVG(epa) DESC LIMIT 100", "chart": {"type": "scatter", "x": "cpoe", "y": "epa_per_dropback", "label": "passer_full_name", "series": "", "title": "QB CPOE vs EPA per dropback, 2022-2023"}}

Q: Chart the Bills and Chiefs point differential by season since 2018
{"plan": "team_games BUF and KC REG since 2018, point differential per team per season.", "sql": "SELECT season, team, SUM(points_for) - SUM(points_against) AS point_diff, COUNT(*) AS games FROM team_games WHERE team IN ('BUF', 'KC') AND season_type = 'REG' AND season >= 2018 AND points_for IS NOT NULL GROUP BY season, team ORDER BY season, team", "chart": {"type": "line", "x": "season", "y": "point_diff", "label": "", "series": "team", "title": "Point differential by season"}}

Q: Which players have been unluckiest in fantasy this season?
{"plan": "xfp 2026 REG per player: actual minus expected PPR points, most negative first, min 40 opportunities.", "sql": "SELECT player_name, ARG_MAX(team, week) AS team, ANY_VALUE(position) AS position, COUNT(*) AS games, SUM(targets) + SUM(carries) AS opportunities, ROUND(SUM(fantasy_points), 1) AS ppr_points, ROUND(SUM(fantasy_points_exp), 1) AS expected_points, ROUND(SUM(fantasy_points_diff), 1) AS points_vs_expected FROM xfp WHERE season = 2026 AND season_type = 'REG' GROUP BY player_id, player_name HAVING SUM(targets) + SUM(carries) >= 40 ORDER BY SUM(fantasy_points_diff) ASC LIMIT 25", ${NO_CHART}}

Q: Which receivers get the most separation?
{"plan": "ngs_receiving season rows (week 0) for 2026, min 30 targets, by avg_separation.", "sql": "SELECT player_display_name, team, targets, ROUND(avg_separation, 2) AS avg_separation, ROUND(avg_cushion, 2) AS avg_cushion, ROUND(avg_yac_above_expectation, 2) AS yac_over_expected FROM ngs_receiving WHERE season = 2026 AND week = 0 AND season_type = 'REG' AND targets >= 30 ORDER BY avg_separation DESC LIMIT 25", ${NO_CHART}}

Q: Best QBs on play action in 2025
{"plan": "pbp dropbacks joined to ftn where is_play_action, 2025 REG, EPA per dropback, min 80.", "sql": "SELECT p.passer_full_name, ARG_MAX(p.posteam, p.game_id) AS team, COUNT(*) AS play_action_dropbacks, ROUND(AVG(p.epa), 3) AS epa_per_dropback FROM pbp p JOIN ftn f USING (game_id, play_id) WHERE p.season = 2025 AND p.season_type = 'REG' AND p.qb_dropback = 1 AND f.is_play_action GROUP BY p.passer_id, p.passer_full_name HAVING COUNT(*) >= 80 ORDER BY AVG(p.epa) DESC LIMIT 25", ${NO_CHART}}

Q: Bar chart of the top 15 running backs by rushing EPA per carry in 2023, min 150 carries
{"plan": "player_week RBs 2023 REG: rushing_epa / carries per player, min 150 carries, top 15.", "sql": "SELECT player_display_name, ARG_MAX(team, game_id) AS team, SUM(carries) AS carries, ROUND(SUM(rushing_epa) / SUM(carries), 3) AS epa_per_carry FROM player_week WHERE season = 2023 AND season_type = 'REG' AND position = 'RB' GROUP BY player_id, player_display_name HAVING SUM(carries) >= 150 ORDER BY SUM(rushing_epa) / SUM(carries) DESC LIMIT 15", "chart": {"type": "bar", "x": "", "y": "epa_per_carry", "label": "player_display_name", "series": "", "title": "Rushing EPA per carry, 2023 RBs"}}`;

function seasonContext(info: DataInfo): string {
  const inProgress = info.maxSeasonType === "REG" && info.maxWeek < 18;
  const lastComplete = inProgress ? info.maxSeason - 1 : info.maxSeason;
  const lines = [
    `DATA: seasons ${info.minSeason}-${info.maxSeason}. Latest data: ${info.maxSeason} ${info.maxSeasonType === "POST" ? "postseason" : `week ${info.maxWeek}`}.`,
    `"This season"/"this year" = ${info.maxSeason}${inProgress ? " (in progress)" : ""}. "Last season" = ${lastComplete}.`,
    `"Last N seasons" = the N most recent complete seasons, ending ${lastComplete} (last 2 = ${lastComplete - 1}-${lastComplete}).`,
  ];
  if (inProgress) {
    lines.push(
      `If the user asks for "all-time"/"career" leaders, the ${info.maxSeason} season is partial.`,
    );
  }
  return lines.join("\n");
}

export const nflPrompt: SportPrompt = {
  intro:
    "You write one DuckDB SQL SELECT that answers an NFL stats question using nflverse data.",
  seasonContext,
  rules: [
    RULE.oneSelect,
    RULE.onlyListed,
    "Default to the regular season (season_type = 'REG', or game_type = 'REG' in games) unless the question mentions playoffs/postseason.",
    RULE.leaderboard,
    RULE.sample("plays or games", "n_plays, dropbacks, attempts, games"),
    RULE.round("ORDER BY SUM(completions) / SUM(attempts) DESC"),
    `Players: match on LAST NAME with ILIKE, e.g. player_display_name ILIKE '%stroud%' (player_week) or passer_full_name / rusher_full_name / receiver_full_name ILIKE '%stroud%' (pbp). Names contain punctuation ("C.J. Stroud", "Amon-Ra St. Brown"), so never match the full name. For common last names (Allen, Brown, Davis, Harris, Jackson, Johnson, Jones, Moore, Smith, Taylor, Thomas, Williams, Wilson) also match the first initial: ILIKE 'j%allen%'.`,
    `If the question names a position ("running backs", "QBs", "tight ends"), filter it: player_week.position = 'RB' (QB, RB, WR, TE, K, ...). pbp has no position column; join player_week or players on the id if needed.`,
    "Teams are abbreviations: ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA(Rams) LAC LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS. Relocated teams use the current code for every season.",
  ],
  tables: [
    {
      view: "pbp",
      title: (i) => `one row per play, ${i.minSeason}-${i.maxSeason}`,
      cols: PBP_COLS,
    },
    {
      view: "player_week",
      title: () => "one row per player per game (box score stats)",
      cols: PLAYER_WEEK_COLS,
    },
    {
      view: "team_week",
      title: () => "one row per team per game",
      cols: TEAM_WEEK_COLS,
    },
    {
      view: "team_games",
      title: () => "one row per team per game (records, scoring, home/away)",
      cols: TEAM_GAMES_COLS,
    },
    {
      view: "games",
      title: () => "one row per game (schedule, scores, betting lines)",
      cols: GAMES_COLS,
    },
    {
      view: "rosters",
      title: () => "one row per player per season",
      cols: ROSTER_COLS,
    },
    {
      view: "pfr_rush",
      title: () =>
        "Pro Football Reference charting, one row per player per game, 2018 on",
      cols: PFR_RUSH_COLS,
    },
    {
      view: "pfr_rec",
      title: () => "the same for pass catchers",
      cols: PFR_REC_COLS,
    },
    {
      view: "pfr_pass",
      title: () => "the same for quarterbacks",
      cols: PFR_PASS_COLS,
    },
    {
      view: "pfr_def",
      title: () => "the same for defenders",
      cols: PFR_DEF_COLS,
    },
    {
      view: "projections",
      title: () =>
        "model projections for each skill player's next game (refreshed daily)",
      cols: PROJ_COLS,
    },
    {
      view: "projections_weekly",
      title: () => "projection for every remaining game of the season",
      cols: PROJ_WEEKLY_COLS,
    },
    {
      view: "xfp",
      title: () =>
        "expected fantasy points (PPR), one row per player per game, 2006 on",
      cols: XFP_COLS,
    },
    {
      view: "ngs_passing",
      title: () =>
        "NFL Next Gen Stats tracking data for QBs, per week and season, 2016 on",
      cols: NGS_PASS_COLS,
    },
    {
      view: "ngs_receiving",
      title: () => "Next Gen Stats for pass catchers",
      cols: NGS_REC_COLS,
    },
    {
      view: "ngs_rushing",
      title: () => "Next Gen Stats for rushers",
      cols: NGS_RUSH_COLS,
    },
    {
      view: "ftn",
      title: () => "FTN hand charting, one row per play",
      cols: FTN_COLS,
    },
    {
      view: "snaps",
      title: () => "snap counts, one row per player per game, 2012 on",
      cols: SNAP_COLS,
    },
    {
      view: "routes",
      title: () => "routes run per player per game, 2015 on",
      cols: ROUTE_COLS,
    },
    {
      view: "qbr_season",
      title: () =>
        "ESPN Total QBR per QB per season (qbr_week: same columns plus week, opponent). Leaderboards: WHERE qualified",
      cols: QBR_COLS,
    },
    {
      view: "contracts",
      title: () => "OverTheCap contracts",
      cols: CONTRACT_COLS,
    },
    {
      view: "contract_years",
      title: () => "cap hit per player per season",
      cols: CONTRACT_YEAR_COLS,
    },
  ],
  idioms: IDIOMS,
  fuzzy: FUZZY,
  chartTeamHint:
    "Player charts: include the latest team as ARG_MAX(posteam, game_id) AS team (pbp) or ARG_MAX(team, game_id) AS team (player_week) so points get team colors.",
  examples: EXAMPLES,
  errorHint(error, sql) {
    // Most common mix-up: pbp's passer_/rusher_/receiver_ columns used on player_week.
    if (
      /Referenced column "(passer|rusher|receiver)_\w+"/.test(error) &&
      /\bplayer_week\b/i.test(sql)
    ) {
      return "\nHint: player_week has no passer_/rusher_/receiver_ columns. Players there are player_id and player_display_name, with stats like completions, attempts, passing_yards, carries, rushing_yards, targets, receptions.";
    }
    return "";
  },
  emptyHint:
    "It ran but returned 0 rows. Names contain punctuation (e.g. 'C.J. Stroud'), so match players on last name only (ILIKE '%stroud%'). Also check team codes, season_type and season filters.",
};
