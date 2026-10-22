import { leaders, type Case } from "./types.mts";

// NBA cases: reference SQL runs against data/nba (seasons named by the year they end).
export const CASES: Case[] = [
  // Slang and opinion questions: any sensible stand-in passes.
  { q: "What team was the biggest fraud in 2025-26?", fuzzy: true },
  { q: "Who pads their stats the most in garbage time?", fuzzy: true },
  { q: "Who is the biggest brick layer?", fuzzy: true },
  { q: "Why are the Thunder so good?", proof: "Thunder" },
  // No year or "this year": must mean the current season, not the model's training year.
  {
    q: "Who has scored the most points so far?",
    ref: "SELECT player_name n, SUM(pts) v FROM player_games WHERE season=(SELECT MAX(season) FROM player_games) AND season_type='REG' GROUP BY player_id, n ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Most rebounds in a game this year",
    ref: "SELECT player_name n, reb v FROM player_games WHERE season=(SELECT MAX(season) FROM player_games) AND season_type='REG' ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Who averaged the most points per game in 2023-24, minimum 50 games?",
    ref: "SELECT player_name n, AVG(pts) v FROM player_games WHERE season=2024 AND season_type='REG' GROUP BY player_id, n HAVING COUNT(*) >= 50 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "How many points did Nikola Jokic score in the 2023 playoffs?",
    ref: "SELECT SUM(pts) v FROM player_games WHERE strip_accents(player_name) ILIKE '%jokic%' AND season=2023 AND season_type='POST'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Which team had the best regular season record in 2015-16?",
    ref: "SELECT team n, SUM(win) v FROM team_games WHERE season=2016 AND season_type='REG' GROUP BY team ORDER BY v DESC LIMIT 5",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Most three-pointers made in a single season since 2010",
    ref: "SELECT player_name n, season s, SUM(fg3m) v FROM player_games WHERE season >= 2010 AND season_type='REG' GROUP BY player_id, n, s ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Who had the most total assists in 2022-23?",
    ref: "SELECT player_name n, SUM(ast) v FROM player_games WHERE season=2023 AND season_type='REG' GROUP BY player_id, n ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Best true shooting percentage in 2024-25 among players with at least 1000 field goal attempts",
    ref: "SELECT player_name n, ts_pct v FROM player_seasons WHERE season=2025 AND season_type='REG' AND fga >= 1000 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Highest usage rate in 2023-24 for players with at least 2000 minutes",
    ref: "SELECT player_name n, usg_pct v FROM player_seasons WHERE season=2024 AND season_type='REG' AND min >= 2000 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Which team had the best net rating in 2024-25?",
    ref: "SELECT team n, net_rating v FROM team_seasons WHERE season=2025 AND season_type='REG' ORDER BY v DESC LIMIT 5",
    pick: (r) => ({ oneOf: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "Most crabsketball fantasy points in a single game since 2015",
    ref: "SELECT player_name n, fantasy_pts v FROM player_games WHERE season >= 2015 AND season_type='REG' ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Top 10 in crabsketball fantasy points per game in 2024-25, minimum 50 games",
    ref: "SELECT player_name n, AVG(fantasy_pts) v FROM player_games WHERE season=2025 AND season_type='REG' GROUP BY player_id, n HAVING COUNT(*) >= 50 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Most total crabsketball fantasy points so far this season",
    ref: "SELECT player_name n, SUM(fantasy_pts) v FROM player_games WHERE season=(SELECT MAX(season) FROM player_games) AND season_type='REG' GROUP BY player_id, n ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "How many triple-doubles did Russell Westbrook have in 2016-17?",
    ref: "SELECT SUM(CASE WHEN (pts>=10)::INT + (reb>=10)::INT + (ast>=10)::INT + (stl>=10)::INT + (blk>=10)::INT >= 3 THEN 1 ELSE 0 END) v FROM player_games WHERE player_name ILIKE '%westbrook%' AND season=2017 AND season_type='REG'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Which team allowed the fewest points per game in 2023-24?",
    ref: "SELECT team n, AVG(points_against) v FROM team_games WHERE season=2024 AND season_type='REG' GROUP BY team ORDER BY v ASC LIMIT 5",
    pick: (r) => ({ oneOf: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "LeBron James total career playoff points",
    ref: "SELECT SUM(pts) v FROM player_games WHERE player_name ILIKE '%lebron%' AND season_type='POST'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Scatter of usage rate vs true shooting percentage in 2024-25 for players with at least 1500 minutes",
    chart: { type: "scatter", x: /us/, y: /ts|true/ },
  },
  {
    q: "Chart Stephen Curry's points per game by season",
    chart: { type: "line", x: /season/, y: /p/ },
  },
  {
    q: "Bar chart of the 15 best defensive ratings in 2024-25",
    chart: { type: "bar", y: /def/ },
  },
];
