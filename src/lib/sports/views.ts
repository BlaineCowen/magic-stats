import type { Sport } from "./types";
import { mlbViews } from "./mlb/views";
import { nbaViews } from "./nba/views";
import { nflViews } from "./nfl/views";
import type { SportViews } from "./view-kit";

export type { SportViews } from "./view-kit";

export const VIEWS: Record<Sport, SportViews> = {
  nfl: nflViews,
  nba: nbaViews,
  mlb: mlbViews,
};
