import { z } from "zod";
import { getDataInfo, runSafeSelect, type Row } from "./db";
import {
  ALL_DOWNS,
  ALL_QTRS,
  type ChartData,
  type ChartFilters,
  type ChartKind,
  type QbPoint,
  type TeamPoint,
} from "./chart-types";

/**
 * Fixed-SQL charts in the style of rbsdm.com. Every value interpolated into
 * the SQL below has been parsed to a number or a known enum first.
 */

const int = z.coerce.number().int();

const intList = (allowed: number[]) =>
  z
    .string()
    .optional()
    .transform((s) => {
      const picked = [...new Set((s ?? "").split(",").map(Number))]
        .filter((n) => allowed.includes(n))
        .sort((a, b) => a - b);
      return picked.length ? picked : allowed;
    });

const paramsSchema = z.object({
  chart: z.enum(["teams", "qbs"]).default("teams"),
  seasonFrom: int.optional(),
  seasonTo: int.optional(),
  weekFrom: int.min(1).max(18).optional(),
  weekTo: int.min(1).max(18).optional(),
  playoffs: z.enum(["none", "include", "only"]).default("none"),
  wpMin: int.min(0).max(100).default(0),
  wpMax: int.min(0).max(100).default(100),
  downs: intList(ALL_DOWNS),
  qtrs: intList(ALL_QTRS),
  plays: z.enum(["all", "pass", "run"]).default("all"),
  minPlays: int.min(1).max(20000).optional(),
});

export class ChartParamsError extends Error {}

/** Parse query params, filling defaults from the data actually on disk. */
export async function resolveParams(params: URLSearchParams): Promise<{
  chart: ChartKind;
  filters: ChartFilters;
  seasons: ChartData["seasons"];
}> {
  const parsed = paramsSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    throw new ChartParamsError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  }
  const p = parsed.data;
  const info = await getDataInfo();
  const clampSeason = (n: number) =>
    Math.min(info.maxSeason, Math.max(info.minSeason, n));

  let seasonTo = clampSeason(p.seasonTo ?? p.seasonFrom ?? info.maxSeason);
  let seasonFrom = clampSeason(p.seasonFrom ?? seasonTo);
  if (seasonFrom > seasonTo) [seasonFrom, seasonTo] = [seasonTo, seasonFrom];

  // Regular seasons are 18 weeks from 2021 and 17 before; the current season
  // only runs as far as the latest week with plays.
  const lastWeek =
    seasonTo === info.maxSeason && info.maxSeasonType === "REG"
      ? info.maxWeek
      : seasonTo >= 2021
        ? 18
        : 17;
  let weekFrom = Math.min(p.weekFrom ?? 1, lastWeek);
  let weekTo = Math.min(p.weekTo ?? lastWeek, lastWeek);
  if (weekFrom > weekTo) [weekFrom, weekTo] = [weekTo, weekFrom];

  const [wpMin, wpMax] =
    p.wpMin <= p.wpMax ? [p.wpMin, p.wpMax] : [p.wpMax, p.wpMin];

  return {
    chart: p.chart,
    seasons: { min: info.minSeason, max: info.maxSeason },
    filters: {
      seasonFrom,
      seasonTo,
      weekFrom,
      weekTo,
      playoffs: p.playoffs,
      wpMin,
      wpMax,
      downs: p.downs,
      qtrs: p.qtrs,
      // Runs have no CPOE, so a runs-only QB chart would be empty.
      plays: p.chart === "qbs" && p.plays === "run" ? "all" : p.plays,
      minPlays: p.minPlays ?? null,
    },
  };
}

/** Plays that count for EPA/play: dropbacks (incl. sacks, scrambles) and runs. */
function playFilter(f: ChartFilters): string {
  const weeks = `season_type = 'REG' AND week BETWEEN ${f.weekFrom} AND ${f.weekTo}`;
  const phase =
    f.playoffs === "only"
      ? "season_type = 'POST'"
      : f.playoffs === "include"
        ? `(season_type = 'POST' OR (${weeks}))`
        : weeks;
  const type =
    f.plays === "pass"
      ? "pass = 1"
      : f.plays === "run"
        ? "rush = 1"
        : "(pass = 1 OR rush = 1)";
  return [
    `season BETWEEN ${f.seasonFrom} AND ${f.seasonTo}`,
    phase,
    type,
    `down IN (${f.downs.join(", ")})`,
    `qtr IN (${f.qtrs.join(", ")})`,
    "epa IS NOT NULL",
  ].join(" AND ");
}

/** Win-probability filter for one side; `expr` is that team's win probability. */
function wpFilter(f: ChartFilters, expr: string): string {
  if (f.wpMin === 0 && f.wpMax === 100) return "TRUE";
  return `${expr} BETWEEN ${f.wpMin / 100} AND ${f.wpMax / 100}`;
}

const num = (v: Row[string] | undefined) => (v == null ? 0 : Number(v));
const str = (v: Row[string] | undefined) => (v == null ? null : String(v));

async function teamTiers(f: ChartFilters): Promise<TeamPoint[]> {
  const { rows } = await runSafeSelect(`
    WITH plays AS (
      SELECT game_id, posteam, defteam, epa, success, wp
      FROM pbp WHERE ${playFilter(f)}
    ),
    off AS (
      SELECT posteam AS team, avg(epa) AS off_epa, avg(success) AS off_success,
             count(*) AS off_plays, count(DISTINCT game_id) AS games
      FROM plays WHERE posteam IS NOT NULL AND ${wpFilter(f, "wp")}
      GROUP BY posteam
    ),
    def AS (
      SELECT defteam AS team, avg(epa) AS def_epa, avg(success) AS def_success,
             count(*) AS def_plays
      FROM plays WHERE defteam IS NOT NULL AND ${wpFilter(f, "1 - wp")}
      GROUP BY defteam
    )
    SELECT o.team, t.team_name, t.team_color, t.team_color2,
           o.off_epa, d.def_epa, o.off_success, d.def_success,
           o.off_plays, d.def_plays, o.games
    FROM off o JOIN def d USING (team)
    LEFT JOIN teams t ON t.team_abbr = o.team
    ORDER BY o.off_epa - d.def_epa DESC`);
  return rows.map((r) => ({
    team: String(r.team),
    team_name: str(r.team_name),
    team_color: str(r.team_color),
    team_color2: str(r.team_color2),
    off_epa: num(r.off_epa),
    def_epa: num(r.def_epa),
    off_success: num(r.off_success),
    def_success: num(r.def_success),
    off_plays: num(r.off_plays),
    def_plays: num(r.def_plays),
    games: num(r.games),
  }));
}

/**
 * QB EPA/play counts every dropback (passes, sacks, scrambles) plus designed
 * runs, using qb_epa so a receiver's fumble isn't charged to the QB. CPOE is
 * averaged over pass attempts.
 */
async function quarterbacks(
  f: ChartFilters,
): Promise<{ qbs: QbPoint[]; minPlays: number }> {
  const { rows } = await runSafeSelect(`
    WITH plays AS (
      SELECT game_id, posteam, pass, rush, passer_id, passer, rusher_id, rusher,
             qb_epa, cpoe, success
      FROM pbp
      WHERE ${playFilter(f)} AND qb_epa IS NOT NULL AND ${wpFilter(f, "wp")}
    ),
    qb_ids AS (SELECT DISTINCT gsis_id FROM players WHERE position = 'QB'),
    qb_plays AS (
      SELECT passer_id AS id, passer AS name, posteam, game_id, qb_epa, cpoe, success
      FROM plays WHERE pass = 1 AND passer_id IN (SELECT gsis_id FROM qb_ids)
      UNION ALL
      SELECT rusher_id, rusher, posteam, game_id, qb_epa, NULL, success
      FROM plays WHERE rush = 1 AND pass = 0 AND rusher_id IN (SELECT gsis_id FROM qb_ids)
    ),
    -- Default minimum: 40% of a typical team's QB plays under these filters
    -- (~16 per game unfiltered), so narrow filters still show a full field.
    team_qb_plays AS (
      SELECT median(n) AS n FROM (SELECT count(*) AS n FROM qb_plays GROUP BY posteam)
    ),
    threshold AS (
      SELECT ${f.minPlays ?? "greatest(1, round(0.4 * (SELECT n FROM team_qb_plays)))::INTEGER"} AS min_plays
    ),
    agg AS (
      SELECT id, arg_max(name, game_id) AS name, arg_max(posteam, game_id) AS team,
             count(*) AS plays, count(DISTINCT game_id) AS games,
             avg(qb_epa) AS epa, avg(cpoe) AS cpoe, avg(success) AS success
      FROM qb_plays GROUP BY id
    ),
    names AS (
      SELECT gsis_id, any_value(display_name) AS full_name
      FROM players GROUP BY gsis_id
    )
    SELECT a.*, n.full_name, t.team_color, t.team_color2,
           (SELECT min_plays FROM threshold) AS min_plays
    FROM agg a
    LEFT JOIN names n ON n.gsis_id = a.id
    LEFT JOIN teams t ON t.team_abbr = a.team
    WHERE a.plays >= (SELECT min_plays FROM threshold) AND a.cpoe IS NOT NULL
    ORDER BY a.epa DESC`);
  const minPlays = rows[0] ? num(rows[0].min_plays) : (f.minPlays ?? 0);
  return {
    minPlays,
    qbs: rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      full_name: str(r.full_name),
      team: String(r.team),
      team_color: str(r.team_color),
      team_color2: str(r.team_color2),
      plays: num(r.plays),
      games: num(r.games),
      epa: num(r.epa),
      cpoe: num(r.cpoe),
      success: num(r.success),
    })),
  };
}

export async function buildChart(params: URLSearchParams): Promise<ChartData> {
  const started = Date.now();
  const { chart, filters, seasons } = await resolveParams(params);
  if (chart === "teams") {
    const teams = await teamTiers(filters);
    return {
      chart,
      filters,
      seasons,
      minPlays: null,
      teams,
      ms: Date.now() - started,
    };
  }
  const { qbs, minPlays } = await quarterbacks(filters);
  return { chart, filters, seasons, minPlays, qbs, ms: Date.now() - started };
}
