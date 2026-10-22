export type ViewContext = {
  run: (sql: string) => Promise<void>;
  /** The sport's data directory (absolute). */
  dir: string;
  /** Whether a file or folder exists under dir. */
  has: (p: string) => boolean;
};

/** How one sport's parquet files become the views its prompt describes. */
export type SportViews = {
  /** Env var that overrides data/<sport>. */
  envVar: string;
  /** Bump when the view definitions change, so a running server rebuilds. */
  rev: number;
  /** Paths under dir that must exist before the views can be built. */
  required: string[];
  create: (ctx: ViewContext) => Promise<void>;
  /** Extra DuckDB SET statements, applied before the settings are locked. */
  settings?: string[];
  /**
   * One row: min_season, max_season, and optionally max_week,
   * max_season_type, latest_date ('YYYY-MM-DD') and stats_through.
   */
  infoSql: string;
};

export const sqlLit = (s: string) => `'${s.replaceAll("'", "''")}'`;

/** CREATE VIEW over a parquet file or glob. */
export function parquetView(name: string, source: string): string {
  return `CREATE VIEW ${name} AS SELECT * FROM read_parquet(${sqlLit(source)}, union_by_name = true)`;
}
