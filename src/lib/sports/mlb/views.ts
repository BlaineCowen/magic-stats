import type { SportViews } from "../view-kit";

// Placeholder until scripts/refresh-mlb-data.mjs exists.
export const mlbViews: SportViews = {
  envVar: "MLB_DATA_DIR",
  rev: 1,
  required: ["manifest.json"],
  async create() {},
  infoSql: "SELECT 0 AS min_season, 0 AS max_season",
};
