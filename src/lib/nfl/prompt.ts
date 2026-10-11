import { describeView, getDataInfo, type DataInfo } from "./db";

/**
 * System prompt for text-to-SQL with a small local model (qwen 9B, ~26k ctx).
 * Kept to a few thousand tokens: a curated column list per table, the
 * nflfastR idioms small models get wrong, and worked examples. Column lists are
 * filtered against the live parquet schema so a renamed column can't slip in.
 */

type Col = [name: string, desc: string];

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

async function renderTable(view: string, cols: Col[]): Promise<string> {
  const have = await describeView(view).catch(() => null);
  if (!have) return "";
  const lines = cols
    .map(([names, desc]) => {
      // Prose placeholders (with spaces) pass through; real names must exist.
      const kept = names
        .split(",")
        .map((s) => s.trim())
        .filter((n) => n.includes(" ") || have.has(n));
      if (!kept.length) return null;
      return `  ${kept.join(", ")}${desc ? ` -- ${desc}` : ""}`;
    })
    .filter(Boolean);
  return lines.join("\n");
}

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

const CHARTS = `CHARTS
Default to "none" (every field ""). Only chart if the question literally asks for a chart/plot/graph, asks for a trend over time, or compares two different stats as two columns per row (e.g. CPOE vs EPA). A same-stat split like "home vs away" is not a chart -- stays "none".
- x, y, label and series are column aliases from your own SELECT.
- scatter: one row per player/team with both stats as columns; x = the first stat named, y = the second, label = the name column. Return every qualifying row (LIMIT 100) with a sensible minimum sample.
- line: one row per season (or week) per player/team, ORDER BY the time column. x = season or week, y = the stat, series = the player/team column ("" for one player or team).
- bar: 10-25 rows ordered by the stat. y = the stat, label = the name column, x = "".
- Player charts: include the latest team as ARG_MAX(posteam, game_id) AS team (pbp) or ARG_MAX(team, game_id) AS team (player_week) so points get team colors.
- title: a short chart title, or "".`;

const NO_CHART = `"chart": {"type": "none", "x": "", "y": "", "label": "", "series": "", "title": ""}`;

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

Q: Bar chart of the top 15 running backs by rushing EPA per carry in 2023, min 150 carries
{"plan": "player_week RBs 2023 REG: rushing_epa / carries per player, min 150 carries, top 15.", "sql": "SELECT player_display_name, ARG_MAX(team, game_id) AS team, SUM(carries) AS carries, ROUND(SUM(rushing_epa) / SUM(carries), 3) AS epa_per_carry FROM player_week WHERE season = 2023 AND season_type = 'REG' AND position = 'RB' GROUP BY player_id, player_display_name HAVING SUM(carries) >= 150 ORDER BY SUM(rushing_epa) / SUM(carries) DESC LIMIT 15", "chart": {"type": "bar", "x": "", "y": "epa_per_carry", "label": "player_display_name", "series": "", "title": "Rushing EPA per carry, 2023 RBs"}}`;

export type PromptMode = "fast" | "deep";

let cached: { key: string; prompt: string } | null = null;

export async function buildSystemPrompt(mode: PromptMode): Promise<string> {
  const info = await getDataInfo();
  const key = `${mode}:${info.version}`;
  if (cached?.key === key) return cached.prompt;

  const [pbp, pw, tw, teamGames, games, rosters] = await Promise.all([
    renderTable("pbp", PBP_COLS),
    renderTable("player_week", PLAYER_WEEK_COLS),
    renderTable("team_week", TEAM_WEEK_COLS),
    renderTable("team_games", TEAM_GAMES_COLS),
    renderTable("games", GAMES_COLS),
    renderTable("rosters", ROSTER_COLS),
  ]);

  const output =
    mode === "fast"
      ? `OUTPUT: JSON {"plan": one short sentence naming the table, filters and metric, "sql": the query, "chart": see CHARTS}.`
      : `OUTPUT: think it through, then reply with the final query in a \`\`\`sql fenced block, followed by the chart object in a \`\`\`json fenced block, e.g. {"type": "none", "x": "", "y": "", "label": "", "series": "", "title": ""}.`;

  const prompt = `You write one DuckDB SQL SELECT that answers an NFL stats question using nflverse data.

${seasonContext(info)}

RULES
1. Exactly one SELECT statement (CTEs allowed). DuckDB SQL dialect.
2. Use ONLY the tables and columns listed below. Never invent column names.
3. Default to the regular season (season_type = 'REG', or game_type = 'REG' in games) unless the question mentions playoffs/postseason.
4. Leaderboards: ORDER BY the requested metric itself (not sample size) and LIMIT 25 unless asked otherwise (max 100). Charts follow the CHARTS row counts.
5. When averaging over plays or games, include a sample-size column (n_plays, dropbacks, attempts, games). When ranking a rate, require a sensible minimum sample unless the user gives one.
6. ROUND rates to 3 decimals and percentages to 1 in the SELECT list, but ORDER BY the unrounded expression (e.g. ORDER BY SUM(completions) / SUM(attempts) DESC) so rounding does not create ties.
7. Players: match on LAST NAME with ILIKE, e.g. player_display_name ILIKE '%stroud%' (player_week) or passer_full_name / rusher_full_name / receiver_full_name ILIKE '%stroud%' (pbp). Names contain punctuation ("C.J. Stroud", "Amon-Ra St. Brown"), so never match the full name. For common last names (Allen, Brown, Davis, Harris, Jackson, Johnson, Jones, Moore, Smith, Taylor, Thomas, Williams, Wilson) also match the first initial: ILIKE 'j%allen%'.
8. If the question names a position ("running backs", "QBs", "tight ends"), filter it: player_week.position = 'RB' (QB, RB, WR, TE, K, ...). pbp has no position column; join player_week or players on the id if needed.
9. Teams are abbreviations: ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA(Rams) LAC LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS. Relocated teams use the current code for every season.

TABLES
pbp -- one row per play, ${info.minSeason}-${info.maxSeason}
${pbp}

player_week -- one row per player per game (box score stats)
${pw}

team_week -- one row per team per game
${tw}

team_games -- one row per team per game (records, scoring, home/away)
${teamGames}

games -- one row per game (schedule, scores, betting lines)
${games}

rosters -- one row per player per season
${rosters}

${IDIOMS}

${CHARTS}

${EXAMPLES}

${output}`;
  cached = { key, prompt };
  return prompt;
}

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
