/** The sports Magic Stats can answer questions about. Safe to import from client code. */

export const SPORTS = ["nfl", "nba", "mlb"] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABEL: Record<Sport, string> = {
  nfl: "NFL",
  nba: "NBA",
  mlb: "MLB",
};

export function isSport(x: unknown): x is Sport {
  return typeof x === "string" && (SPORTS as readonly string[]).includes(x);
}

/** Logo URL for a team code. NFL is the route's default, so its URLs stay as they were. */
export function logoUrl(sport: Sport, team: string): string {
  const base = `/api/charts/logo/${encodeURIComponent(team)}`;
  return sport === "nfl" ? base : `${base}?sport=${sport}`;
}
