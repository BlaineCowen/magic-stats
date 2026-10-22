import fs from "node:fs";
import path from "node:path";
import {
  DuckDBDecimalValue,
  DuckDBInstance,
  StatementType,
  type DuckDBValue,
} from "@duckdb/node-api";
import type { TeamColors } from "@/lib/nfl/chart-spec";
import { logoUrl, type Sport } from "./types";
import { VIEWS } from "./views";

/**
 * Read-only DuckDB per sport over the zstd parquet files written by
 * scripts/refresh-<sport>-data.mjs. No database file: views glob the parquet
 * directly, so DuckDB only reads the columns and seasons a query touches.
 */

export function dataDir(sport: Sport): string {
  const v = VIEWS[sport];
  return path.resolve(
    process.env[v.envVar] ?? path.join(process.cwd(), `data/${sport}`),
  );
}

const MAX_ROWS = 500;
const QUERY_TIMEOUT_MS = 20_000;

type DbState = { instance: DuckDBInstance; key: string };

const stateKey = (sport: Sport) => `${dataVersion(sport)}:${VIEWS[sport].rev}`;

// Cached on globalThis so `next dev` hot reloads don't open a new instance each time.
const g = globalThis as unknown as {
  __sportsDb?: Partial<Record<Sport, Promise<DbState>>>;
};
g.__sportsDb ??= {};
const dbs = g.__sportsDb;

/** Changes whenever the sport's refresh script rewrites its manifest. */
export function dataVersion(sport: Sport): string {
  try {
    return String(
      Math.floor(
        fs.statSync(path.join(dataDir(sport), "manifest.json")).mtimeMs,
      ),
    );
  } catch {
    return "none";
  }
}

export const sqlStr = (s: string) => `'${s.replaceAll("'", "''")}'`;

async function createDb(sport: Sport): Promise<DbState> {
  const key = stateKey(sport);
  const spec = VIEWS[sport];
  const dir = dataDir(sport);
  const has = (p: string) => fs.existsSync(path.join(dir, p));
  if (!spec.required.every(has)) {
    throw new Error(
      `No ${sport.toUpperCase()} data in ${dir}. Run: node scripts/refresh-${sport}-data.mjs`,
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
  await spec.create({ run: (sql) => conn.run(sql).then(() => undefined), dir, has });
  for (const s of spec.settings ?? []) await conn.run(s);
  // LLM-written SQL may only read this sport's data directory: no other files,
  // no network, and no changing these settings afterwards.
  await conn.run(`SET allowed_directories = [${sqlStr(`${dir}/`)}]`);
  await conn.run("SET enable_external_access = false");
  await conn.run("SET lock_configuration = true");
  conn.closeSync();
  return { instance, key };
}

async function getDb(sport: Sport): Promise<DbState> {
  const existing = dbs[sport];
  if (existing) {
    const state = await existing.catch(() => null);
    // Rebuild after a refresh so view schemas pick up new/changed files.
    if (state && state.key === stateKey(sport)) return state;
    if (state) state.instance.closeSync();
  }
  const next = createDb(sport);
  dbs[sport] = next;
  next.catch(() => {
    if (dbs[sport] === next) delete dbs[sport];
  });
  return next;
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
  sport: Sport,
  rawSql: string,
): Promise<{ columns: string[]; rows: Row[]; truncated: boolean }> {
  const sql = cleanSql(rawSql);
  const { instance } = await getDb(sport);
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
export async function describeView(
  sport: Sport,
  view: string,
): Promise<Set<string>> {
  const { instance } = await getDb(sport);
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
  /** NFL only (0 elsewhere). */
  maxWeek: number;
  maxSeasonType: string;
  /** Date of the latest game played, 'YYYY-MM-DD' (NBA, MLB). */
  latestDate: string | null;
  /** Latest season in the season-level tables, which can lag the game logs (NBA). */
  statsThrough: number | null;
  /** Any other columns the sport's infoSql returned. */
  extra: Row;
};

const infoCache = new Map<Sport, DataInfo>();

/** Latest season actually present, so prompts never hardcode "this season". */
export async function getDataInfo(sport: Sport): Promise<DataInfo> {
  const version = dataVersion(sport);
  const hit = infoCache.get(sport);
  if (hit?.version === version) return hit;
  const { rows } = await runSafeSelect(sport, VIEWS[sport].infoSql);
  const r = rows[0] ?? {};
  const info: DataInfo = {
    version,
    minSeason: Number(r.min_season),
    maxSeason: Number(r.max_season),
    maxWeek: Number(r.max_week ?? 0),
    maxSeasonType: String(r.max_season_type ?? ""),
    latestDate: r.latest_date == null ? null : String(r.latest_date),
    statsThrough: r.stats_through == null ? null : Number(r.stats_through),
    extra: r,
  };
  infoCache.set(sport, info);
  return info;
}

const colorsCache = new Map<Sport, { version: string; colors: TeamColors }>();

/**
 * Team code -> colors and logo from the sport's teams view; empty if it isn't
 * loaded. Only a successful query is cached, so a later refresh that adds the
 * view is picked up on the next call.
 */
export async function getTeamColors(sport: Sport): Promise<TeamColors> {
  const version = dataVersion(sport);
  const hit = colorsCache.get(sport);
  if (hit?.version === version) return hit.colors;
  try {
    const { rows } = await runSafeSelect(
      sport,
      "SELECT team_abbr, team_color, team_color2 FROM teams",
    );
    const colors: TeamColors = {};
    for (const r of rows) {
      const abbr = String(r.team_abbr);
      colors[abbr] = {
        color: r.team_color == null ? null : String(r.team_color),
        color2: r.team_color2 == null ? null : String(r.team_color2),
        logo: logoUrl(sport, abbr),
      };
    }
    colorsCache.set(sport, { version, colors });
    return colors;
  } catch {
    // No teams view (older data dir): charts fall back to neutral colors.
    return {};
  }
}
