import { leaders, type Case } from "./types.mts";

// MLB cases: reference SQL runs against data/mlb.
export const CASES: Case[] = [
  // Slang and opinion questions: any sensible stand-in passes.
  { q: "What team is the biggest fraud?", fuzzy: true },
  { q: "Who is the luckiest hitter?", fuzzy: true },
  { q: "Who is the most three true outcomes hitter?", fuzzy: true },
  { q: "Make the case for the Dodgers", proof: "Dodgers" },
  // No year or "this year": must mean the current season, not the model's training year.
  {
    q: "Who hit the most home runs?",
    ref: "SELECT player_name n, home_runs v FROM batting_seasons WHERE season=(SELECT MAX(season) FROM batting_seasons) ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Which team won the most games this year?",
    ref: "SELECT team n, wins v FROM team_seasons WHERE season=(SELECT MAX(season) FROM team_seasons) ORDER BY v DESC LIMIT 5",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Who hit the most home runs in 2022?",
    ref: "SELECT player_name n, home_runs v FROM batting_seasons WHERE season=2022 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "How many home runs did Shohei Ohtani hit in 2024?",
    ref: "SELECT home_runs v FROM batting_seasons WHERE player_name ILIKE '%ohtani%' AND season=2024",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Highest batting average among qualified hitters in 2023",
    ref: "SELECT player_name n, avg v FROM batting_seasons WHERE season=2023 AND pa >= 502 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Best wRC+ among qualified hitters in 2024",
    ref: "SELECT player_name n, wrc_plus v FROM batting_seasons WHERE season=2024 AND pa >= 502 ORDER BY v DESC LIMIT 20",
    pick: (r) => ({ oneOf: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "Most stolen bases in 2023",
    ref: "SELECT player_name n, stolen_bases v FROM batting_seasons WHERE season=2023 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Lowest ERA among qualified pitchers in 2024",
    ref: "SELECT player_name n, era v FROM pitching_seasons WHERE season=2024 AND innings >= 162 ORDER BY v ASC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Which pitcher had the highest WAR in 2023?",
    ref: "SELECT player_name n, war v FROM pitching_seasons WHERE season=2023 ORDER BY v DESC LIMIT 20",
    pick: (r) => ({ oneOf: [String(r[0]!.n)] }),
    scope: "top1",
  },
  {
    q: "Most saves in 2022",
    ref: "SELECT player_name n, saves v FROM pitching_seasons WHERE season=2022 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Which team had the best record in 2022?",
    ref: "SELECT team n, wins v FROM team_seasons WHERE season=2022 ORDER BY v DESC LIMIT 5",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Highest average exit velocity in 2024 with at least 400 plate appearances",
    ref: "SELECT player_name n, avg_exit_velo v FROM statcast_batting WHERE season=2024 AND pa >= 400 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Who had the fastest sprint speed in 2023?",
    ref: "SELECT player_name n, sprint_speed v FROM sprint_speed WHERE season=2023 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Most strikeouts by a pitcher in a single game in 2025",
    ref: "SELECT player_name n, strikeouts v FROM pitching_games WHERE season=2025 AND season_type='REG' ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "How many home runs has Giancarlo Stanton hit in his career?",
    ref: "SELECT SUM(home_runs) v FROM batting_seasons WHERE player_name ILIKE '%stanton%' AND player_name ILIKE 'g%'",
    pick: (r) => ({ numbers: [Number(r[0]!.v)] }),
    scope: "any",
  },
  {
    q: "Which team scored the most runs in the 2024 postseason?",
    ref: "SELECT team n, SUM(runs_for) v FROM team_games WHERE season=2024 AND season_type='POST' GROUP BY team ORDER BY v DESC LIMIT 5",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Best slider by run value in 2024, at least 300 sliders thrown",
    ref: "SELECT player_name n, run_value v FROM pitch_arsenal WHERE season=2024 AND pitch_name='Slider' AND pitches >= 300 ORDER BY v DESC LIMIT 20",
    pick: leaders,
    scope: "top1",
  },
  {
    q: "Scatter of strikeout rate vs walk rate for qualified pitchers in 2024",
    chart: { type: "scatter", x: /k/, y: /bb|walk/ },
  },
  {
    q: "Chart Aaron Judge's wRC+ by season",
    chart: { type: "line", x: /season/, y: /wrc/ },
  },
  {
    q: "Bar chart of team home runs in 2024",
    chart: { type: "bar", y: /home|hr/ },
  },
];
