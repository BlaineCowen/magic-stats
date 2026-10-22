import type { Sport } from "@/lib/sports/types";

export type ExampleGroup = { title: string; questions: string[] };

// What the Ask page says and suggests for each sport. Clicking an example
// fills the box and runs it, so keep each one answerable from that sport's data.
export const SPORT_ASK: Record<
  Sport,
  {
    coverage: string;
    placeholder: string;
    /** Credited under charts. */
    source: string;
    groups: ExampleGroup[];
  }
> = {
  nfl: {
    coverage: "Answers come from every NFL play since 1999.",
    source: "nflverse",
    placeholder: "Most rushing yards in 2024?",
    groups: [
      {
        title: "Quarterbacks",
        questions: [
          "Top 10 quarterbacks in 2024 by EPA per dropback, minimum 300 dropbacks",
          "CJ Stroud's 10 longest completions by air yards in 2024",
          "Quarterbacks with the most touchdown passes on third down in 2024",
          "Prove CJ Stroud is the best QB in the NFL",
        ],
      },
      {
        title: "Running backs & receivers",
        questions: [
          "Running backs in 2024 with at least 100 carries ranked by rushing EPA per carry, with total rushing yards",
          "Receivers in 2024 with at least 50 targets: target share, air yards share and yards per target",
          "Most receiving yards after the catch in 2024",
        ],
      },
      {
        title: "Teams & defense",
        questions: [
          "Which defenses allowed the lowest EPA per dropback from 2021 to 2025?",
          "Which teams went for it on 4th down most often in 2024?",
          "Teams with the most sacks in 2024",
        ],
      },
      {
        title: "Fantasy",
        questions: [
          "Top 15 players in PPR fantasy points in 2024 who played at least 10 games",
          "Wide receivers with the most red zone targets in 2024",
          "Running backs with the most PPR points per game in 2024, at least 8 games",
        ],
      },
    ],
  },
  nba: {
    coverage:
      "Answers come from every NBA box score since 1996-97, with advanced stats and crabsketball fantasy points.",
    placeholder: "Most points per game this season?",
    source: "NBA Stats via sportsdataverse, ESPN",
    groups: [
      {
        title: "Scoring & shooting",
        questions: [
          "Highest scoring average in 2024-25, minimum 50 games",
          "Best three-point percentage in 2024-25 with at least 300 attempts",
          "Most 40-point games since 2020",
          "Make the case that SGA is the best player in 2025-26",
        ],
      },
      {
        title: "Advanced",
        questions: [
          "Highest usage rate in 2024-25, minimum 1500 minutes",
          "Players with the best box plus/minus in 2024-25",
          "Scatter of usage rate vs true shooting in 2024-25, minimum 1500 minutes",
        ],
      },
      {
        title: "Teams",
        questions: [
          "Best net rating in 2024-25",
          "Which teams played the fastest pace in 2024-25?",
          "Celtics record at home vs away in 2024-25",
        ],
      },
      {
        title: "Crabsketball fantasy",
        questions: [
          "Top crabsketball fantasy points per game this season",
          "Best crabsketball points per game over the last 2 weeks, at least 4 games",
          "Centers with the most crabsketball points per game in 2024-25",
        ],
      },
    ],
  },
  mlb: {
    coverage:
      "Answers come from every MLB season since 2000, with Statcast data from 2015 on.",
    placeholder: "Highest wRC+ in 2025?",
    source: "MLB Stats API, Baseball Savant",
    groups: [
      {
        title: "Hitting",
        questions: [
          "Most home runs in 2025",
          "Best wRC+ among qualified hitters in 2025",
          "Career WAR leaders since 2000 among hitters",
          "Prove Shohei Ohtani is the best player in baseball",
        ],
      },
      {
        title: "Pitching",
        questions: [
          "Lowest ERA among qualified starters in 2025, with FIP",
          "Pitchers with the highest strikeout rate in 2025, at least 100 innings",
          "Best sweepers by run value in 2025",
        ],
      },
      {
        title: "Statcast",
        questions: [
          "Hardest-hitting batters by average exit velocity in 2025, at least 300 PA",
          "Fastest sprint speeds in 2025",
          "Batters whose xwOBA beat their wOBA by the most in 2025",
        ],
      },
      {
        title: "Teams",
        questions: [
          "Best run differential in 2025",
          "Dodgers wins and run differential by season since 2015",
          "Which teams hit the most home runs in 2025?",
        ],
      },
    ],
  },
};
