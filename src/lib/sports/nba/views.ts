import type { SportViews } from "../view-kit";

// Placeholder until scripts/refresh-nba-data.mjs exists.
export const nbaViews: SportViews = {
  envVar: "NBA_DATA_DIR",
  rev: 1,
  required: ["manifest.json"],
  async create() {},
  infoSql: "SELECT 0 AS min_season, 0 AS max_season",
};
