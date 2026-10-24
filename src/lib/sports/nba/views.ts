import { parquetView, sqlLit, type SportViews } from "../view-kit";

/**
 * NBA data from scripts/refresh-nba-data.mjs: NBA Stats API files via
 * sportsdataverse (seasons named by the year they end), plus ESPN box scores
 * for the current season until upstream publishes it.
 */

// season_type_id on box scores / season_type on the other files -> what the prompt uses.
const boxType = (t: string) =>
  `CASE ${t}.season_type_id WHEN '2' THEN 'REG' WHEN '4' THEN 'POST' WHEN '5' THEN 'PLAYIN' WHEN '6' THEN 'CUP' END`;
const statsType = (t: string) =>
  `CASE ${t}.season_type WHEN 'regular-season' THEN 'REG' WHEN 'playoffs' THEN 'POST' END`;
// '35:56' -> 35.93
const MINUTES = `(TRY_CAST(split_part(minutes, ':', 1) AS DOUBLE) + coalesce(TRY_CAST(split_part(minutes, ':', 2) AS DOUBLE), 0) / 60)`;
const PLAYED_TYPES = `('2', '4', '5', '6')`;
const TRACKING = ["catchshoot", "pullupshot", "drives", "defense", "passing", "possessions", "painttouch", "posttouch", "elbowtouch", "rebounding", "speeddistance"];
// Synergy's play_type labels -> the names the prompt uses.
const PLAY_TYPES = [
  ["Isolation", "isolation"], ["PRBallHandler", "pnr_ball_handler"], ["PRRollMan", "pnr_roll_man"],
  ["Spotup", "spot_up"], ["Transition", "transition"], ["Postup", "post_up"], ["Cut", "cut"],
  ["OffScreen", "off_screen"], ["Handoff", "handoff"], ["OffRebound", "putback"], ["Misc", "misc"],
];

export const nbaViews: SportViews = {
  envVar: "NBA_DATA_DIR",
  rev: 2,
  required: ["player_box", "team_box", "schedules"],
  // DuckDB 1.5 fails filtering on the joined position ("Can't convert
  // TableFilterType (BLOOM_FILTER) from global to local indexes") unless the
  // join filter pushdown optimizer is off.
  settings: ["SET disabled_optimizers = 'join_filter_pushdown'"],
  async create({ run, dir, has }) {
    const src = (ds: string) =>
      `read_parquet(${sqlLit(`${dir}/${ds}/*.parquet`)}, union_by_name = true)`;

    await run(`
      CREATE VIEW games AS
      SELECT game_id, season,
        CASE season_type WHEN 'regular-season' THEN 'REG' WHEN 'playoffs' THEN 'POST'
          WHEN 'play-in' THEN 'PLAYIN' WHEN 'nba-cup' THEN 'CUP' END AS season_type,
        CAST(game_date AS DATE) AS game_date,
        home_team_abbreviation AS home_team, away_team_abbreviation AS away_team,
        home_pts, away_pts
      FROM ${src("schedules")}
      WHERE season_type IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')`);

    // Latest known roster position per player ('G', 'F', 'C', 'G-F', 'F-C', ...).
    await run(
      has("rosters")
        ? `CREATE TABLE player_positions AS
           SELECT player_id, arg_max(position, season) AS position
           FROM ${src("rosters")} WHERE coalesce(position, '') <> '' GROUP BY player_id`
        : `CREATE TABLE player_positions (player_id BIGINT, position VARCHAR)`,
    );

    // One row per player per game played; DNPs are dropped.
    await run(`
      CREATE VIEW player_games AS
      WITH s AS (
        SELECT game_id, any_value(CAST(game_date AS DATE)) AS game_date,
          any_value(home_team_abbreviation) AS home, any_value(away_team_abbreviation) AS away,
          any_value(home_pts) AS home_pts, any_value(away_pts) AS away_pts
        FROM ${src("schedules")} GROUP BY game_id
      ),
      b AS (SELECT *, ${MINUTES} AS mins FROM ${src("player_box")})
      SELECT b.game_id, b.season, ${boxType("b")} AS season_type, s.game_date,
        b.person_id AS player_id, trim(b.first_name || ' ' || b.family_name) AS player_name,
        pp.position, b.team_tricode AS team,
        CASE WHEN b.side = 'home' THEN s.away ELSE s.home END AS opponent,
        b.side = 'home' AS is_home,
        CASE WHEN s.home_pts IS NULL THEN NULL
             WHEN (b.side = 'home') = (s.home_pts > s.away_pts) THEN 1 ELSE 0 END AS win,
        coalesce(b.position, '') <> '' AS started,
        round(b.mins, 2) AS min,
        b.points AS pts, b.rebounds_total AS reb, b.rebounds_offensive AS oreb,
        b.rebounds_defensive AS dreb, b.assists AS ast, b.steals AS stl, b.blocks AS blk,
        b.turnovers AS tov, b.fouls_personal AS pf,
        b.field_goals_made AS fgm, b.field_goals_attempted AS fga,
        b.three_pointers_made AS fg3m, b.three_pointers_attempted AS fg3a,
        b.free_throws_made AS ftm, b.free_throws_attempted AS fta,
        b.plus_minus_points AS plus_minus,
        -- crabsketball scoring
        b.points + b.rebounds_total + b.assists + b.steals + b.blocks - b.turnovers
          + (b.field_goals_made - b.field_goals_attempted)
          + (b.free_throws_made - b.free_throws_attempted) AS fantasy_pts
      FROM b LEFT JOIN s USING (game_id)
      LEFT JOIN player_positions pp ON pp.player_id = b.person_id
      WHERE b.mins > 0 AND b.season_type_id IN ${PLAYED_TYPES}`);

    // One row per team per game, with the opponent's line for defense and pace.
    await run(`
      CREATE VIEW team_games AS
      WITH s AS (
        SELECT game_id, any_value(CAST(game_date AS DATE)) AS game_date
        FROM ${src("schedules")} GROUP BY game_id
      ),
      t AS (SELECT * FROM ${src("team_box")} WHERE season_type_id IN ${PLAYED_TYPES})
      SELECT t.game_id, t.season, ${boxType("t")} AS season_type, s.game_date,
        t.team_tricode AS team, o.team_tricode AS opponent, t.side = 'home' AS is_home,
        t.points AS points_for, o.points AS points_against,
        CASE WHEN t.points > o.points THEN 1 ELSE 0 END AS win,
        CASE WHEN t.points < o.points THEN 1 ELSE 0 END AS loss,
        t.field_goals_made AS fgm, t.field_goals_attempted AS fga,
        t.three_pointers_made AS fg3m, t.three_pointers_attempted AS fg3a,
        t.free_throws_made AS ftm, t.free_throws_attempted AS fta,
        t.rebounds_offensive AS oreb, t.rebounds_defensive AS dreb, t.rebounds_total AS reb,
        t.assists AS ast, t.steals AS stl, t.blocks AS blk, t.turnovers AS tov, t.fouls_personal AS pf,
        t.field_goals_attempted - t.rebounds_offensive + t.turnovers + 0.44 * t.free_throws_attempted AS possessions,
        o.field_goals_made AS opp_fgm, o.field_goals_attempted AS opp_fga,
        o.three_pointers_made AS opp_fg3m, o.three_pointers_attempted AS opp_fg3a,
        o.free_throws_attempted AS opp_fta, o.rebounds_offensive AS opp_oreb,
        o.rebounds_total AS opp_reb, o.turnovers AS opp_tov,
        o.field_goals_attempted - o.rebounds_offensive + o.turnovers + 0.44 * o.free_throws_attempted AS opp_possessions
      FROM t JOIN t o ON o.game_id = t.game_id AND o.side <> t.side
      LEFT JOIN s ON s.game_id = t.game_id`);

    // team_id -> tricode for the season files, which only carry ids and names.
    await run(`
      CREATE VIEW team_ids AS
      SELECT season, team_id, any_value(team_tricode) AS team
      FROM ${src("team_box")} WHERE team_id IS NOT NULL GROUP BY season, team_id`);

    if (has("player_season") && has("impact")) {
      await run(`
        CREATE VIEW player_seasons AS
        WITH ps AS (SELECT * FROM ${src("player_season")} WHERE per_mode = 'totals'),
        base AS (SELECT * FROM ps WHERE measure_type = 'base'),
        adv AS (SELECT * FROM ps WHERE measure_type = 'advanced'),
        imp AS (
          SELECT *, CASE season_type WHEN 'Playoffs' THEN 'playoffs' ELSE 'regular-season' END AS st
          FROM ${src("impact")}
        )
        SELECT b.season, ${statsType("b")} AS season_type,
          b.player_id, b.player_name, pp.position, b.team_abbreviation AS team, b.team_count,
          b.age, b.gp, b.w, b.l, round(b.min, 1) AS min,
          b.pts, b.reb, b.oreb, b.dreb, b.ast, b.stl, b.blk, b.tov, b.pf,
          b.fgm, b.fga, b.fg3m, b.fg3a, b.ftm, b.fta, b.plus_minus, b.dd2, b.td3,
          b.pts + b.reb + b.ast + b.stl + b.blk - b.tov + (b.fgm - b.fga) + (b.ftm - b.fta) AS fantasy_pts,
          a.ts_pct, a.efg_pct, a.usg_pct, a.ast_pct, a.ast_to, a.oreb_pct, a.dreb_pct, a.reb_pct,
          a.tm_tov_pct AS tov_pct, a.off_rating, a.def_rating, a.net_rating, a.pace, a.pie, a.poss,
          i.bpm, i.obpm, i.dbpm, i.rapm, i.o_rapm, i.d_rapm,
          i.darko_projected_rating AS darko
        FROM base b
        LEFT JOIN adv a ON a.player_id = b.player_id AND a.season = b.season AND a.season_type = b.season_type
        LEFT JOIN imp i ON i.player_id = b.player_id AND i.season = b.season AND i.st = b.season_type
        LEFT JOIN player_positions pp ON pp.player_id = b.player_id
        WHERE b.season_type IN ('regular-season', 'playoffs')`);
    }

    // Second Spectrum tracking, 2014 on: one row per player per season and
    // season_type (team = last team), season totals except the averages.
    if (TRACKING.every((m) => has(`tracking_${m}`))) {
      const t = (m: string) =>
        `(SELECT * FROM ${src(`tracking_${m}`)} WHERE season_type IN ('Regular Season', 'Playoffs'))`;
      const on = (a: string) =>
        `ON ${a}.player_id = cs.player_id AND ${a}.season = cs.season AND ${a}.season_type = cs.season_type`;
      await run(`
        CREATE VIEW player_tracking AS
        SELECT cs.season,
          CASE cs.season_type WHEN 'Regular Season' THEN 'REG' ELSE 'POST' END AS season_type,
          cs.player_id, cs.player_name, pp.position, cs.team_abbreviation AS team, cs.gp, cs.min,
          cs.catch_shoot_fgm, cs.catch_shoot_fga, cs.catch_shoot_fg3_m AS catch_shoot_fg3m,
          cs.catch_shoot_fg3_a AS catch_shoot_fg3a, cs.catch_shoot_pts,
          pu.pull_up_fgm, pu.pull_up_fga, pu.pull_up_fg3_m AS pull_up_fg3m,
          pu.pull_up_fg3_a AS pull_up_fg3a, pu.pull_up_pts,
          dr.drives, dr.drive_fgm, dr.drive_fga, dr.drive_ftm, dr.drive_fta, dr.drive_pts,
          dr.drive_passes, dr.drive_ast, dr.drive_tov,
          po.touches, po.front_ct_touches, po.time_of_poss, po.avg_sec_per_touch,
          po.avg_drib_per_touch, po.pts_per_touch,
          pt.paint_touches, pt.paint_touch_fgm, pt.paint_touch_fga, pt.paint_touch_pts,
          ps.post_touches, ps.post_touch_fgm, ps.post_touch_fga, ps.post_touch_pts,
          el.elbow_touches, el.elbow_touch_fgm, el.elbow_touch_fga, el.elbow_touch_pts,
          pa.passes_made, pa.passes_received, pa.potential_ast, pa.secondary_ast, pa.ft_ast,
          pa.ast_pts_created,
          de.def_rim_fgm, de.def_rim_fga,
          rb.reb_contest, rb.reb_uncontest, rb.reb_chances, rb.oreb_contest, rb.dreb_contest,
          rb.avg_reb_dist,
          sd.dist_miles, sd.dist_miles_off, sd.dist_miles_def, sd.avg_speed, sd.avg_speed_off,
          sd.avg_speed_def
        FROM ${t("catchshoot")} cs
        LEFT JOIN ${t("pullupshot")} pu ${on("pu")}
        LEFT JOIN ${t("drives")} dr ${on("dr")}
        LEFT JOIN ${t("possessions")} po ${on("po")}
        LEFT JOIN ${t("painttouch")} pt ${on("pt")}
        LEFT JOIN ${t("posttouch")} ps ${on("ps")}
        LEFT JOIN ${t("elbowtouch")} el ${on("el")}
        LEFT JOIN ${t("passing")} pa ${on("pa")}
        LEFT JOIN ${t("defense")} de ${on("de")}
        LEFT JOIN ${t("rebounding")} rb ${on("rb")}
        LEFT JOIN ${t("speeddistance")} sd ${on("sd")}
        LEFT JOIN player_positions pp ON pp.player_id = cs.player_id
        WHERE cs.season >= 2014`);
    }

    if (has("hustle_regular-season")) {
      await run(`
        CREATE VIEW player_hustle AS
        SELECT season, CASE season_type WHEN 'playoffs' THEN 'POST' ELSE 'REG' END AS season_type,
          h.player_id, player_name, pp.position, team_abbreviation AS team, g AS gp, min,
          contested_shots, contested_shots_2_pt AS contested_shots_2pt,
          contested_shots_3_pt AS contested_shots_3pt, deflections, charges_drawn,
          screen_assists, screen_ast_pts, loose_balls_recovered, off_loose_balls_recovered,
          def_loose_balls_recovered, box_outs, off_boxouts, def_boxouts
        FROM read_parquet(${sqlLit(`${dir}/hustle_*/*.parquet`)}, union_by_name = true) h
        LEFT JOIN player_positions pp ON pp.player_id = h.player_id`);
    }

    // Synergy play types, 2016 on. Upstream splits traded players by team;
    // this sums them into one row per player, season, play type and side.
    if (has("synergy_regular-season_isolation_offensive")) {
      await run(`
        CREATE VIEW play_types AS
        WITH s AS (
          SELECT * FROM read_parquet(${sqlLit(`${dir}/synergy_*/*.parquet`)}, union_by_name = true)
          WHERE poss > 0
        )
        SELECT season, CASE season_type WHEN 'playoffs' THEN 'POST' ELSE 'REG' END AS season_type,
          s.player_id, any_value(player_name) AS player_name, any_value(pp.position) AS position,
          STRING_AGG(DISTINCT team_abbreviation, '/' ORDER BY team_abbreviation) AS team,
          CASE play_type ${PLAY_TYPES.map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(" ")} END AS play_type,
          CASE type_grouping WHEN 'Defensive' THEN 'defense' ELSE 'offense' END AS side,
          SUM(gp) AS gp, SUM(poss) AS poss, SUM(pts) AS pts, SUM(fgm) AS fgm, SUM(fga) AS fga,
          ROUND(SUM(pts) / SUM(poss), 3) AS ppp,
          ROUND(SUM(poss) / SUM(poss / NULLIF(poss_pct, 0)), 3) AS freq,
          ROUND(SUM(tov_poss_pct * poss) / SUM(poss), 3) AS tov_pct,
          ROUND(SUM(ft_poss_pct * poss) / SUM(poss), 3) AS ft_freq,
          ROUND(SUM(score_poss_pct * poss) / SUM(poss), 3) AS score_pct,
          arg_max(percentile, poss) AS percentile
        FROM s LEFT JOIN player_positions pp ON pp.player_id = s.player_id
        GROUP BY season, s.season_type, s.player_id, s.play_type, s.type_grouping`);
    }

    if (has("team_season")) {
      await run(`
        CREATE VIEW team_seasons AS
        WITH ts AS (SELECT * FROM ${src("team_season")} WHERE per_mode = 'totals'),
        base AS (SELECT * FROM ts WHERE measure_type = 'base'),
        adv AS (SELECT * FROM ts WHERE measure_type = 'advanced')
        SELECT b.season, ${statsType("b")} AS season_type,
          coalesce(ti.team, b.team_name) AS team, b.team_name,
          b.gp, b.w AS wins, b.l AS losses, b.w_pct AS win_pct,
          b.pts, b.reb, b.oreb, b.dreb, b.ast, b.stl, b.blk, b.tov, b.pf,
          b.fgm, b.fga, b.fg3m, b.fg3a, b.ftm, b.fta, b.plus_minus,
          a.off_rating, a.def_rating, a.net_rating, a.pace, a.ts_pct, a.efg_pct,
          a.ast_pct, a.oreb_pct, a.dreb_pct, a.reb_pct, a.tm_tov_pct AS tov_pct, a.pie, a.poss
        FROM base b
        LEFT JOIN adv a ON a.team_id = b.team_id AND a.season = b.season AND a.season_type = b.season_type
        LEFT JOIN team_ids ti ON ti.team_id = b.team_id AND ti.season = b.season
        WHERE b.season_type IN ('regular-season', 'playoffs')`);
    }

    if (has("standings")) {
      await run(`
        CREATE VIEW standings AS
        SELECT s.season, coalesce(ti.team, s.team_city || ' ' || s.team_name) AS team,
          s.team_city || ' ' || s.team_name AS team_name, s.conference, s.division,
          s.wins, s.losses, s.win_pct, s.playoff_rank AS conference_seed,
          s.conference_games_back, s.division_rank, s.home, s.road, s.l10 AS last_10,
          s.str_current_streak AS streak, s.points_pg, s.opp_points_pg, s.diff_points_pg,
          trim(s.clinch_indicator) AS clinched
        FROM ${src("standings")} s
        LEFT JOIN team_ids ti ON ti.team_id = s.team_id AND ti.season = s.season`);
    }

    if (has("rosters")) {
      await run(`
        CREATE VIEW rosters AS
        SELECT r.season, ti.team, r.player_id, r.player AS player_name, r.position,
          r.height, TRY_CAST(r.weight AS INT) AS weight, r.age,
          CASE WHEN r.exp = 'R' THEN 0 ELSE TRY_CAST(r.exp AS INT) END AS years_exp,
          r.school, r.num AS jersey
        FROM ${src("rosters")} r
        LEFT JOIN team_ids ti ON ti.team_id = r.team_id AND ti.season = r.season`);
    }

    if (has("teams.parquet")) {
      await run(parquetView("teams", `${dir}/teams.parquet`));
    }
  },
  infoSql: `
    SELECT min(season) AS min_season, max(season) AS max_season,
      arg_max(season_type, game_date) AS max_season_type,
      strftime(max(game_date), '%Y-%m-%d') AS latest_date,
      (SELECT max(season) FROM player_seasons) AS stats_through
    FROM games WHERE home_pts IS NOT NULL`,
};
