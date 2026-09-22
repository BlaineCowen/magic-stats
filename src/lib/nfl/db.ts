import fs from "node:fs";
import path from "node:path";
import {
  DuckDBDecimalValue,
  DuckDBInstance,
  StatementType,
  type DuckDBValue,
} from "@duckdb/node-api";
import type { TeamColors } from "./chart-spec";

/**
 * Read-only DuckDB over the zstd parquet files written by
 * scripts/refresh-nfl-data.mjs. No database file: views glob the parquet
 * directly, so DuckDB only reads the columns and seasons a query touches.
 */

export const NFL_DATA_DIR = path.resolve(
  process.env.NFL_DATA_DIR ?? path.join(process.cwd(), "data/nfl"),
);

const MAX_ROWS = 500;
const QUERY_TIMEOUT_MS = 20_000;

// Bump when the view definitions below change, so a running server rebuilds.
const VIEWS_REV = 3;

type DbState = { instance: DuckDBInstance; key: string };

const stateKey = () => `${dataVersion()}:${VIEWS_REV}`;

// Cached on globalThis so `next dev` hot reloads don't open a new instance each time.
const g = globalThis as unknown as { __nflDb?: Promise<DbState> };

/** Changes whenever the refresh script rewrites the manifest. */
export function dataVersion(): string {
  try {
    return String(
      Math.floor(fs.statSync(path.join(NFL_DATA_DIR, "manifest.json")).mtimeMs),
    );
  } catch {
    return "none";
  }
}

const sqlStr = (s: string) => `'${s.replaceAll("'", "''")}'`;

function viewSql(name: string, source: string): string {
  return `CREATE VIEW ${name} AS SELECT * FROM read_parquet(${sqlStr(source)}, union_by_name = true)`;
}

async function createDb(): Promise<DbState> {
  const key = stateKey();
  const has = (p: string) => fs.existsSync(path.join(NFL_DATA_DIR, p));
  if (!has("pbp") || !has("players.parquet")) {
    throw new Error(
      `No NFL data in ${NFL_DATA_DIR}. Run: node scripts/refresh-nfl-data.mjs`,
    );
  }

  const instance = await DuckDBInstance.create(":memory:", {
    threads: "4",
    memory_limit: "1500MB",
    // allowed_directories can't be passed as a startup option, so the file
    // lockdown is applied with SET statements once the views exist (below).
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
  });
  const conn = await instance.connect();
  const dir = NFL_DATA_DIR;
  await conn.run(
    `CREATE VIEW players AS SELECT * FROM read_parquet(${sqlStr(`${dir}/players.parquet`)})`,
  );
  // schedules keep pre-relocation codes (OAK/SD/STL) while pbp and the stats
  // files use current ones for every season; normalize so joins/filters agree.
  const team = (c: string) =>
    `CASE ${c} WHEN 'OAK' THEN 'LV' WHEN 'SD' THEN 'LAC' WHEN 'STL' THEN 'LA' ELSE ${c} END AS ${c}`;
  await conn.run(`
    CREATE VIEW games AS
    SELECT * REPLACE (${team("home_team")}, ${team("away_team")})
    FROM read_parquet(${sqlStr(`${dir}/games.parquet`)})`);
  // One row per team per game, so records/scoring/home-away splits don't need
  // the home/away UNION that small models reliably get wrong.
  const side = (team: string, opp: string, isHome: boolean) => `
    SELECT game_id, season, week, game_type,
      CASE WHEN game_type = 'REG' THEN 'REG' ELSE 'POST' END AS season_type,
      gameday, ${team}_team AS team, ${opp}_team AS opponent, ${isHome} AS is_home,
      ${team}_score AS points_for, ${opp}_score AS points_against,
      CASE WHEN ${team}_score > ${opp}_score THEN 1 WHEN ${team}_score IS NOT NULL THEN 0 END AS win,
      CASE WHEN ${team}_score < ${opp}_score THEN 1 WHEN ${team}_score IS NOT NULL THEN 0 END AS loss,
      CASE WHEN ${team}_score = ${opp}_score THEN 1 WHEN ${team}_score IS NOT NULL THEN 0 END AS tie,
      ${isHome ? "" : "-"}spread_line AS favored_by, total_line, overtime, div_game,
      ${team}_qb_name AS qb_name, ${team}_coach AS coach, roof, surface, temp, wind
    FROM games`;
  await conn.run(
    `CREATE VIEW team_games AS ${side("home", "away", true)} UNION ALL ${side("away", "home", false)}`,
  );
  for (const ds of ["player_week", "team_week", "rosters"]) {
    if (has(ds)) await conn.run(viewSql(ds, `${dir}/${ds}/*.parquet`));
  }
  // Colors and logo URLs per team code (includes historical codes like OAK).
  if (has("teams.parquet")) {
    await conn.run(viewSql("teams", `${dir}/teams.parquet`));
  }
  // pbp names are abbreviated ("P.Mahomes"); join full names so a small model
  // can filter with ILIKE '%mahomes%' without knowing the abbreviation.
  // passer_id/rusher_id/receiver_id follow nflfastR's dropback convention
  // (passer includes scrambles and sacks), unlike the *_player_id columns.
  await conn.run(`
    CREATE VIEW pbp AS
    WITH names AS (
      SELECT gsis_id, any_value(display_name) AS display_name
      FROM players WHERE gsis_id IS NOT NULL GROUP BY gsis_id
    )
    SELECT p.*,
      pn.display_name AS passer_full_name,
      rn.display_name AS rusher_full_name,
      cn.display_name AS receiver_full_name
    FROM read_parquet(${sqlStr(`${dir}/pbp/*.parquet`)}, union_by_name = true) p
    LEFT JOIN names pn ON pn.gsis_id = p.passer_id
    LEFT JOIN names rn ON rn.gsis_id = p.rusher_id
    LEFT JOIN names cn ON cn.gsis_id = p.receiver_id`);
  // LLM-written SQL may only read our data directory: no other files, no
  // network, and no changing these settings afterwards.
  await conn.run(`SET allowed_directories = [${sqlStr(`${dir}/`)}]`);
  await conn.run("SET enable_external_access = false");
  await conn.run("SET lock_configuration = true");
  conn.closeSync();
  return { instance, key };
}

async function getDb(): Promise<DbState> {
  if (g.__nflDb) {
    const state = await g.__nflDb.catch(() => null);
    // Rebuild after a refresh so view schemas pick up new/changed files.
    if (state && state.key === stateKey()) return state;
    if (state) state.instance.closeSync();
  }
  g.__nflDb = createDb();
  g.__nflDb.catch(() => {
    g.__nflDb = undefined;
  });
  return g.__nflDb;
}

export type Row = Record<string, string | number | boolean | null>;

function toJsonValue(
  v: DuckDBValue | undefined,
): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof DuckDBDecimalValue) return v.toDouble();
  return String(v);
}

export class SqlRejectedError extends Error {}

/** Trim whitespace, trailing semicolons and a stray ```sql fence. */
export function cleanSql(sql: string): string {
  return sql
    .trim()
    .replace(/^```(?:sql)?\s*/i, "")
    .replace(/```$/, "")
    .trim()
    .replace(/;+\s*$/, "")
    .trim();
}

/**
 * Validate and run one SELECT. Throws SqlRejectedError for non-SELECT input and
 * plain Errors (DuckDB's messages) for bind/runtime failures, which are useful
 * feedback to hand back to the LLM.
 */
export async function runSafeSelect(
  rawSql: string,
): Promise<{ columns: string[]; rows: Row[]; truncated: boolean }> {
  const sql = cleanSql(rawSql);
  const { instance } = await getDb();
  const conn = await instance.connect();
  const timer = setTimeout(() => conn.interrupt(), QUERY_TIMEOUT_MS);
  try {
    const extracted = await conn.extractStatements(sql);
    if (extracted.count !== 1) {
      throw new SqlRejectedError(
        `Expected exactly one SQL statement, got ${extracted.count}`,
      );
    }
    const stmt = await extracted.prepare(0);
    if (stmt.statementType !== StatementType.SELECT) {
      throw new SqlRejectedError("Only SELECT queries are allowed");
    }
    // Validated as a single SELECT, so wrapping it in a subquery is safe.
    const reader = await conn.runAndReadAll(
      `SELECT * FROM (${sql}) LIMIT ${MAX_ROWS + 1}`,
    );
    const columns = reader.columnNames();
    const rows = reader.getRowObjects().map((r) => {
      const out: Row = {};
      for (const c of columns) out[c] = toJsonValue(r[c]);
      return out;
    });
    const truncated = rows.length > MAX_ROWS;
    return { columns, rows: rows.slice(0, MAX_ROWS), truncated };
  } catch (e) {
    if (e instanceof Error && /interrupt/i.test(e.message)) {
      throw new Error(
        `Query took longer than ${QUERY_TIMEOUT_MS / 1000}s and was stopped`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
    conn.closeSync();
  }
}

/** Column names of a view, straight from the parquet schema. */
export async function describeView(view: string): Promise<Set<string>> {
  const { instance } = await getDb();
  const conn = await instance.connect();
  try {
    const r = await conn.runAndReadAll(`DESCRIBE ${view}`);
    return new Set(r.getRowObjectsJson().map((x) => x.column_name as string));
  } finally {
    conn.closeSync();
  }
}

export type DataInfo = {
  version: string;
  minSeason: number;
  maxSeason: number;
  maxWeek: number;
  maxSeasonType: string;
};

let infoCache: DataInfo | null = null;

/** Latest season/week actually present, so prompts never hardcode "this season". */
export async function getDataInfo(): Promise<DataInfo> {
  const version = dataVersion();
  if (infoCache?.version === version) return infoCache;
  const { rows } = await runSafeSelect(`
    WITH latest AS (SELECT max(season) AS s FROM pbp)
    SELECT (SELECT min(season) FROM pbp) AS min_season,
           l.s AS max_season,
           max(p.week) AS max_week,
           arg_max(p.season_type, p.week) AS max_season_type
    FROM pbp p, latest l WHERE p.season = l.s GROUP BY l.s`);
  const r = rows[0] ?? {};
  infoCache = {
    version,
    minSeason: Number(r.min_season),
    maxSeason: Number(r.max_season),
    maxWeek: Number(r.max_week),
    maxSeasonType: String(r.max_season_type),
  };
  return infoCache;
}

let colorsCache: { version: string; colors: TeamColors } | null = null;

/** team_abbr -> colors from the teams view; empty if it isn't loaded. */
export async function getTeamColors(): Promise<TeamColors> {
  const version = dataVersion();
  if (colorsCache?.version === version) return colorsCache.colors;
  const colors: TeamColors = {};
  try {
    const { rows } = await runSafeSelect(
      "SELECT team_abbr, team_color, team_color2 FROM teams",
    );
    for (const r of rows) {
      colors[String(r.team_abbr)] = {
        color: r.team_color == null ? null : String(r.team_color),
        color2: r.team_color2 == null ? null : String(r.team_color2),
      };
    }
  } catch {
    // No teams view (older data dir): charts fall back to neutral colors.
  }
  colorsCache = { version, colors };
  return colors;
}
