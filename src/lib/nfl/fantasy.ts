import { runSafeSelect, type Row } from "./db";

/**
 * Data for the fantasy pages: the model's projections (scripts/projections,
 * data/nfl/projections.parquet) and per-player weekly usage. Every value put
 * into SQL below is a checked id or a number.
 */

const num = (v: Row[string] | undefined) => (v == null ? null : Number(v));
const str = (v: Row[string] | undefined) => (v == null ? null : String(v));

export type Reason = [label: string, points: number];

export type Projection = {
  player_id: string;
  name: string;
  position: string;
  team: string;
  opp: string;
  home: boolean;
  week: number;
  /** Listed Out or Doubtful for this game: no next-game projection. */
  out_next: boolean;
  proj: number;
  floor: number;
  median: number;
  ceiling: number;
  breakout_prob: number | null;
  why: Reason[];
  games: number;
  ppr_pg: number | null;
  xfp_pg: number | null;
  ppr_l3: number | null;
  xfp_l3: number | null;
  luck_pg: number | null;
  tgt_share: number | null;
  tgt_share_l3: number | null;
  car_share: number | null;
  car_share_l3: number | null;
  snap_pct: number | null;
  snap_l3: number | null;
  /** Routes run per game this season (estimated from snaps until the real counts are out). */
  routes_pg: number | null;
  /** Receiving yards and targets per route run, this season and last. */
  yprr: number | null;
  tprr: number | null;
  yprr_prev: number | null;
  separation: number | null;
  yac_oe: number | null;
  ryoe_att: number | null;
  vacated_tgt: number | null;
  vacated_car: number | null;
  implied_total: number | null;
  spread: number | null;
  indoor: boolean;
  temp_f: number | null;
  wind_mph: number | null;
  opp_pos_allowed: number | null;
  age: number | null;
  years_exp: number | null;
  headshot: string | null;
  team_color: string | null;
  /** Rest of season, this week included unless he's out. */
  ros_proj: number | null;
  ros_games: number | null;
  ros_ppg: number | null;
  /** Remaining opponents' PPR allowed to the position minus the league average. */
  ros_sos: number | null;
  /** Next few games: [week, opponent ("@KC" when away), projection, out]. */
  upcoming: [number, string, number, boolean][];
  /** ESPN injury status ("Injured Reserve", "Questionable"...) and expected return. */
  injury_status: string | null;
  return_date: string | null;
  injury: string | null;
  injury_note: string | null;
  /** Teammates out for his next game whose targets/carries open up. */
  vacated_names: string | null;
};

const enoughRoutes = (r: Row) =>
  (num(r.routes_pg) ?? 0) * Number(r.games_to_date ?? 0) >= 40;

function toProjection(r: Row): Projection {
  let why: Reason[] = [];
  try {
    why = JSON.parse(String(r.why ?? "[]")) as Reason[];
  } catch {
    // leave empty
  }
  return {
    player_id: String(r.player_id),
    name: String(r.name),
    position: String(r.position),
    team: String(r.team),
    opp: String(r.opp),
    home: Number(r.home) === 1,
    week: Number(r.week),
    out_next: r.out_next === true,
    proj: Number(r.proj),
    floor: Number(r.floor),
    median: Number(r.median),
    ceiling: Number(r.ceiling),
    breakout_prob: num(r.breakout_prob),
    why,
    games: Number(r.games_to_date ?? 0),
    ppr_pg: num(r.ppr_pg),
    xfp_pg: num(r.xfp_pg),
    ppr_l3: num(r.ppr_l3),
    xfp_l3: num(r.xfp_l3),
    luck_pg: num(r.luck_pg),
    tgt_share: num(r.tgt_share),
    tgt_share_l3: num(r.tgt_share_l3),
    car_share: num(r.car_share),
    car_share_l3: num(r.car_share_l3),
    snap_pct: num(r.snap_pct),
    snap_l3: num(r.snap_l3),
    routes_pg: num(r.routes_pg),
    // Under 40 routes the rates are mostly noise.
    yprr: enoughRoutes(r) ? num(r.yprr) : null,
    tprr: enoughRoutes(r) ? num(r.tprr) : null,
    yprr_prev: num(r.yprr_prev),
    separation: num(r.separation),
    yac_oe: num(r.yac_oe),
    ryoe_att: num(r.ryoe_att),
    vacated_tgt: num(r.vacated_tgt),
    vacated_car: num(r.vacated_car),
    implied_total: num(r.implied_total),
    spread: num(r.spread),
    indoor: Number(r.indoor) === 1,
    temp_f: num(r.temp_f),
    wind_mph: num(r.wind_mph),
    opp_pos_allowed: num(r.opp_pos_allowed),
    age: num(r.age),
    years_exp: num(r.years_exp),
    headshot: str(r.headshot),
    team_color: str(r.team_color),
    ros_proj: num(r.ros_proj),
    ros_games: num(r.ros_games),
    ros_ppg: num(r.ros_ppg),
    ros_sos: num(r.ros_sos),
    upcoming: String(r.upcoming ?? "")
      .split("|")
      .filter(Boolean)
      .map((x) => {
        const [w, o, v, a] = x.split(":");
        return [Number(w), o!, Number(v), a === "1"] as [
          number,
          string,
          number,
          boolean,
        ];
      }),
    injury_status: str(r.injury_status),
    return_date:
      r.return_date == null ? null : String(r.return_date).slice(0, 10),
    injury: str(r.injury),
    injury_note: str(r.injury_note),
    vacated_names: str(r.vacated_names),
  };
}

const PROJ_SQL = `
  WITH nxt AS (
    SELECT player_id,
      string_agg(week || ':' || CASE WHEN home = 1 THEN '' ELSE '@' END || opp || ':' || proj
        || ':' || CASE WHEN absent THEN '1' ELSE '0' END, '|' ORDER BY week) AS upcoming
    FROM projections_weekly WHERE horizon <= 5 GROUP BY player_id
  )
  SELECT p.*, pl.headshot, t.team_color, nxt.upcoming
  FROM projections p
  LEFT JOIN nxt USING (player_id)
  LEFT JOIN (SELECT gsis_id, any_value(headshot) AS headshot FROM players GROUP BY gsis_id) pl
    ON pl.gsis_id = p.player_id
  LEFT JOIN teams t ON t.team_abbr = p.team`;

/** This week's projections for every skill player, best projection first. */
export async function getProjections(): Promise<Projection[]> {
  try {
    const { rows } = await runSafeSelect(`${PROJ_SQL} ORDER BY p.proj DESC`, {
      maxRows: 2000,
    });
    return rows.map(toProjection);
  } catch {
    // No projections file yet (model not run): the page says so.
    return [];
  }
}

export type PlayerWeek = {
  week: number;
  opponent: string;
  ppr: number;
  xfp: number | null;
  snap_pct: number | null;
  /** Routes run; null for QBs. */
  routes: number | null;
  /** True when routes is estimated from snaps (real counts come out after the season). */
  routes_est: boolean;
  tgt_share: number | null;
  car_share: number | null;
  targets: number;
  receptions: number;
  carries: number;
  rec_yards: number;
  rush_yards: number;
  pass_yards: number;
  tds: number;
  separation: number | null;
  ryoe_att: number | null;
};

export type WeekProjection = {
  week: number;
  opp: string;
  home: boolean;
  proj: number;
  floor: number;
  ceiling: number;
  implied_total: number | null;
  absent: boolean;
};

export type PlayerPage = {
  id: string;
  name: string;
  position: string;
  team: string | null;
  team_name: string | null;
  team_color: string | null;
  headshot: string | null;
  age: number | null;
  college: string | null;
  draft: string | null;
  seasons: number[];
  season: number;
  weeks: PlayerWeek[];
  rank: { ppr: number | null; xfp: number | null; of: number } | null;
  cap_hit: number | null;
  projection: Projection | null;
  remaining: WeekProjection[];
};

const ID_RE = /^[0-9]{2}-[0-9]{7}$/;

export async function getPlayerPage(
  id: string,
  seasonParam?: number,
): Promise<PlayerPage | null> {
  if (!ID_RE.test(id)) return null;
  const lit = `'${id}'`;
  const bio = (
    await runSafeSelect(`
      SELECT p.display_name, p.position, p.latest_team, p.headshot, p.birth_date,
        p.college_name, p.draft_year, p.draft_round, p.draft_pick, p.draft_team,
        t.team_name, t.team_color
      FROM players p LEFT JOIN teams t ON t.team_abbr = p.latest_team
      WHERE p.gsis_id = ${lit} LIMIT 1`)
  ).rows[0];
  if (!bio) return null;

  const seasons = (
    await runSafeSelect(`
      SELECT DISTINCT season FROM player_week
      WHERE player_id = ${lit} AND season_type = 'REG' ORDER BY season DESC`)
  ).rows.map((r) => Number(r.season));
  const season =
    seasonParam && seasons.includes(seasonParam)
      ? seasonParam
      : (seasons[0] ?? new Date().getFullYear());

  const { rows } = await runSafeSelect(`
    SELECT w.week, w.opponent_team AS opponent, w.fantasy_points_ppr AS ppr,
      x.fantasy_points_exp AS xfp, s.snap_pct, rt.routes, rt.estimated AS routes_est,
      w.targets / nullif(x.team_targets, 0) AS tgt_share,
      w.carries / nullif(x.team_carries, 0) AS car_share,
      w.targets, w.receptions, w.carries, w.receiving_yards AS rec_yards,
      w.rushing_yards AS rush_yards, w.passing_yards AS pass_yards,
      coalesce(w.passing_tds, 0) + coalesce(w.rushing_tds, 0) + coalesce(w.receiving_tds, 0) AS tds,
      nr.avg_separation AS separation, nu.rush_yards_over_expected_per_att AS ryoe_att
    FROM player_week w
    LEFT JOIN xfp x ON x.player_id = w.player_id AND x.game_id = w.game_id
    LEFT JOIN (SELECT player_id, game_id, max(offense_pct) AS snap_pct FROM snaps GROUP BY ALL) s
      ON s.player_id = w.player_id AND s.game_id = w.game_id
    LEFT JOIN routes rt ON rt.player_id = w.player_id AND rt.game_id = w.game_id
    LEFT JOIN ngs_receiving nr ON nr.player_id = w.player_id AND nr.season = w.season
      AND nr.week = w.week AND nr.season_type = 'REG'
    LEFT JOIN ngs_rushing nu ON nu.player_id = w.player_id AND nu.season = w.season
      AND nu.week = w.week AND nu.season_type = 'REG'
    WHERE w.player_id = ${lit} AND w.season = ${season} AND w.season_type = 'REG'
    ORDER BY w.week`);
  const weeks: PlayerWeek[] = rows.map((r) => ({
    week: Number(r.week),
    opponent: String(r.opponent),
    ppr: Number(r.ppr ?? 0),
    xfp: num(r.xfp),
    snap_pct: num(r.snap_pct),
    routes: num(r.routes),
    routes_est: r.routes_est === true,
    tgt_share: num(r.tgt_share),
    car_share: num(r.car_share),
    targets: Number(r.targets ?? 0),
    receptions: Number(r.receptions ?? 0),
    carries: Number(r.carries ?? 0),
    rec_yards: Number(r.rec_yards ?? 0),
    rush_yards: Number(r.rush_yards ?? 0),
    pass_yards: Number(r.pass_yards ?? 0),
    tds: Number(r.tds ?? 0),
    separation: num(r.separation),
    ryoe_att: num(r.ryoe_att),
  }));

  // Rank among the position by PPR and expected PPR per game (half the games or more).
  const pos = String(bio.position);
  const rank = (
    await runSafeSelect(`
      WITH s AS (
        SELECT w.player_id, avg(w.fantasy_points_ppr) AS ppr, avg(x.fantasy_points_exp) AS xfp, count(*) AS g
        FROM player_week w LEFT JOIN xfp x ON x.player_id = w.player_id AND x.game_id = w.game_id
        WHERE w.season = ${season} AND w.season_type = 'REG' AND w.position = '${pos.replace(/[^A-Z]/g, "")}'
        GROUP BY w.player_id
      ),
      q AS (SELECT * FROM s WHERE g >= 0.5 * (SELECT max(g) FROM s))
      SELECT
        (SELECT count(*) + 1 FROM q WHERE q.ppr > me.ppr) AS ppr_rank,
        (SELECT count(*) + 1 FROM q WHERE q.xfp > me.xfp) AS xfp_rank,
        (SELECT count(*) FROM q) AS n
      FROM q me WHERE me.player_id = ${lit}`)
  ).rows[0];

  const cap = (
    await runSafeSelect(`
      SELECT cap_number FROM contract_years
      WHERE player_id = ${lit} AND season = ${season} LIMIT 1`).catch(() => ({
      rows: [] as Row[],
    }))
  ).rows[0];

  const proj = (
    await runSafeSelect(`${PROJ_SQL} WHERE p.player_id = ${lit}`).catch(() => ({
      rows: [] as Row[],
    }))
  ).rows[0];

  const remaining = (
    await runSafeSelect(`
      SELECT week, opp, home, proj, floor, ceiling, implied_total, absent
      FROM projections_weekly WHERE player_id = ${lit} ORDER BY week`).catch(
      () => ({ rows: [] as Row[] }),
    )
  ).rows.map((r) => ({
    week: Number(r.week),
    opp: String(r.opp),
    home: Number(r.home) === 1,
    proj: Number(r.proj),
    floor: Number(r.floor),
    ceiling: Number(r.ceiling),
    implied_total: num(r.implied_total),
    absent: r.absent === true,
  }));

  const age = bio.birth_date
    ? (Date.now() - new Date(String(bio.birth_date)).getTime()) /
      (365.25 * 86400e3)
    : null;
  return {
    id,
    name: String(bio.display_name),
    position: pos,
    team: str(bio.latest_team),
    team_name: str(bio.team_name),
    team_color: str(bio.team_color),
    headshot: str(bio.headshot),
    age: age == null ? null : Math.floor(age),
    college: str(bio.college_name),
    draft: bio.draft_year
      ? `${String(bio.draft_year)} round ${String(bio.draft_round)}, pick ${String(bio.draft_pick)}${bio.draft_team ? ` (${String(bio.draft_team)})` : ""}`
      : "Undrafted",
    seasons,
    season,
    weeks,
    rank: rank
      ? {
          ppr: num(rank.ppr_rank),
          xfp: num(rank.xfp_rank),
          of: Number(rank.n),
        }
      : null,
    cap_hit: cap ? num(cap.cap_number) : null,
    projection: proj ? toProjection(proj) : null,
    remaining,
  };
}

/** Name search for the player index: skill players with a game in the last two seasons. */
export async function searchablePlayers(): Promise<
  { id: string; name: string; position: string; team: string }[]
> {
  const { rows } = await runSafeSelect(
    `
    SELECT player_id AS id, any_value(player_display_name) AS name,
      arg_max(position, season * 100 + week) AS position, arg_max(team, season * 100 + week) AS team,
      sum(fantasy_points_ppr) AS pts
    FROM player_week
    WHERE season >= (SELECT max(season) FROM player_week) - 1 AND season_type = 'REG'
      AND position IN ('QB', 'RB', 'WR', 'TE')
    GROUP BY player_id
    ORDER BY pts DESC`,
    { maxRows: 3000 },
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    position: String(r.position),
    team: String(r.team),
  }));
}
