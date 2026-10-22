// Example questions on the Ask page, grouped the way a fan would browse them.
// Clicking one fills the box and runs it, so keep each one answerable from
// play-by-play and weekly player stats.
export const EXAMPLE_GROUPS: { title: string; questions: string[] }[] = [
  {
    title: "Quarterbacks",
    questions: [
      "Top 10 quarterbacks in 2024 by EPA per dropback, minimum 300 dropbacks",
      "CJ Stroud's 10 longest completions by air yards in 2024",
      "Quarterbacks with the most touchdown passes on third down in 2024",
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
];
