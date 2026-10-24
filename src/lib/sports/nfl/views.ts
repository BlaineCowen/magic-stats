import { parquetView, sqlLit, type SportViews } from "../view-kit";

/** nflverse data from scripts/refresh-nfl-data.mjs. */
export const nflViews: SportViews = {
  envVar: "NFL_DATA_DIR",
  rev: 8,
  required: ["pbp", "players.parquet"],
  async create({ run, dir, has }) {
    await run(
      `CREATE VIEW players AS SELECT * FROM read_parquet(${sqlLit(`${dir}/players.parquet`)})`,
    );
    // schedules keep pre-relocation codes (OAK/SD/STL) while pbp and the stats
    // files use current ones for every season; normalize so joins/filters agree.
    const team = (c: string) =>
      `CASE ${c} WHEN 'OAK' THEN 'LV' WHEN 'SD' THEN 'LAC' WHEN 'STL' THEN 'LA' ELSE ${c} END AS ${c}`;
    await run(`
      CREATE VIEW games AS
      SELECT * REPLACE (${team("home_team")}, ${team("away_team")})
      FROM read_parquet(${sqlLit(`${dir}/games.parquet`)})`);
    // One row per team per game, so records/scoring/home-away splits don't need
    // the home/away UNION that small models reliably get wrong.
    const side = (t: string, opp: string, isHome: boolean) => `
      SELECT game_id, season, week, game_type,
        CASE WHEN game_type = 'REG' THEN 'REG' ELSE 'POST' END AS season_type,
        gameday, ${t}_team AS team, ${opp}_team AS opponent, ${isHome} AS is_home,
        ${t}_score AS points_for, ${opp}_score AS points_against,
        CASE WHEN ${t}_score > ${opp}_score THEN 1 WHEN ${t}_score IS NOT NULL THEN 0 END AS win,
        CASE WHEN ${t}_score < ${opp}_score THEN 1 WHEN ${t}_score IS NOT NULL THEN 0 END AS loss,
        CASE WHEN ${t}_score = ${opp}_score THEN 1 WHEN ${t}_score IS NOT NULL THEN 0 END AS tie,
        ${isHome ? "" : "-"}spread_line AS favored_by, total_line, overtime, div_game,
        ${t}_qb_name AS qb_name, ${t}_coach AS coach, roof, surface, temp, wind
      FROM games`;
    await run(
      `CREATE VIEW team_games AS ${side("home", "away", true)} UNION ALL ${side("away", "home", false)}`,
    );
    for (const ds of ["player_week", "team_week", "rosters"]) {
      if (has(ds)) await run(parquetView(ds, `${dir}/${ds}/*.parquet`));
    }
    // Pro Football Reference charting stats (2018 on), with the gsis id and
    // position from players so they filter and join like player_week.
    for (const ds of ["pfr_pass", "pfr_rush", "pfr_rec", "pfr_def"]) {
      if (!has(ds)) continue;
      await run(`
        CREATE VIEW ${ds} AS
        SELECT r.*, p.player_id, p.position
        FROM read_parquet(${sqlLit(`${dir}/${ds}/*.parquet`)}, union_by_name = true) r
        LEFT JOIN (
          SELECT pfr_id, any_value(gsis_id) AS player_id, any_value(position) AS position
          FROM players WHERE pfr_id IS NOT NULL GROUP BY pfr_id
        ) p ON p.pfr_id = r.pfr_player_id`);
    }
    // Expected fantasy points (ffopportunity, PPR) per player per game. The
    // upstream file has ~160 columns; keep the ones people ask about.
    if (has("xfp")) {
      await run(`
        CREATE VIEW xfp AS
        SELECT season::INTEGER AS season, week::INTEGER AS week,
          CASE WHEN week::INTEGER > CASE WHEN season::INTEGER >= 2021 THEN 18 ELSE 17 END
            THEN 'POST' ELSE 'REG' END AS season_type,
          game_id, player_id, full_name AS player_name, position, posteam AS team,
          pass_attempt AS pass_attempts, rec_attempt AS targets, rush_attempt AS carries,
          receptions, receptions_exp,
          rec_yards_gained AS rec_yards, rec_yards_gained_exp AS rec_yards_exp,
          rush_yards_gained AS rush_yards, rush_yards_gained_exp AS rush_yards_exp,
          pass_yards_gained AS pass_yards, pass_yards_gained_exp AS pass_yards_exp,
          total_touchdown AS touchdowns, total_touchdown_exp AS touchdowns_exp,
          rec_air_yards, rec_air_yards_team AS team_air_yards, rec_attempt_team AS team_targets,
          rush_attempt_team AS team_carries,
          pass_fantasy_points, pass_fantasy_points_exp,
          rec_fantasy_points, rec_fantasy_points_exp,
          rush_fantasy_points, rush_fantasy_points_exp,
          total_fantasy_points AS fantasy_points,
          total_fantasy_points_exp AS fantasy_points_exp,
          total_fantasy_points_diff AS fantasy_points_diff
        FROM read_parquet(${sqlLit(`${dir}/xfp/*.parquet`)}, union_by_name = true)
        WHERE player_id IS NOT NULL AND full_name IS NOT NULL`);
    }
    // FTN hand charting, one row per play from 2022; join pbp on (game_id, play_id).
    if (has("ftn")) {
      await run(`
        CREATE VIEW ftn AS
        SELECT nflverse_game_id AS game_id, nflverse_play_id::DOUBLE AS play_id,
          season, week, qb_location, n_offense_backfield, n_defense_box,
          is_motion, is_play_action, is_screen_pass, is_rpo, is_trick_play,
          is_qb_out_of_pocket, is_interception_worthy, is_throw_away, read_thrown,
          is_catchable_ball, is_contested_ball, is_created_reception, is_drop,
          is_qb_sneak, n_blitzers, n_pass_rushers, is_qb_fault_sack
        FROM read_parquet(${sqlLit(`${dir}/ftn/*.parquet`)}, union_by_name = true)`);
    }
    if (has("snaps")) {
      await run(`
        CREATE VIEW snaps AS
        SELECT s.* EXCLUDE (pfr_game_id), p.player_id
        FROM read_parquet(${sqlLit(`${dir}/snaps/*.parquet`)}, union_by_name = true) s
        LEFT JOIN (SELECT pfr_id, any_value(gsis_id) AS player_id FROM players
                   WHERE pfr_id IS NOT NULL GROUP BY pfr_id) p ON p.pfr_id = s.pfr_player_id`);
    }
    // Next Gen Stats; week 0 rows are season totals.
    for (const k of ["passing", "receiving", "rushing"]) {
      if (!has(`ngs_${k}.parquet`)) continue;
      await run(`
        CREATE VIEW ngs_${k} AS
        SELECT * EXCLUDE (player_gsis_id, team_abbr, player_first_name, player_last_name,
                          player_jersey_number, player_short_name),
          player_gsis_id AS player_id, team_abbr AS team
        FROM read_parquet(${sqlLit(`${dir}/ngs_${k}.parquet`)})`);
    }
    if (has("qbr_week.parquet")) {
      await run(`
        CREATE VIEW qbr_week AS
        SELECT season, season_type, game_week AS week, team_abb AS team, name_display AS player_name,
          qbr_total, pts_added, qb_plays, epa_total, opp_abb AS opponent, qualified
        FROM read_parquet(${sqlLit(`${dir}/qbr_week.parquet`)})`);
    }
    if (has("qbr_season.parquet")) {
      await run(`
        CREATE VIEW qbr_season AS
        SELECT season, season_type, team_abb AS team, name_display AS player_name,
          qbr_total, pts_added, qb_plays, epa_total, qualified
        FROM read_parquet(${sqlLit(`${dir}/qbr_season.parquet`)})`);
    }
    // OverTheCap contracts (money in millions of dollars). contract_years has one
    // row per player per season from the most recent contract's year-by-year history.
    if (has("contracts.parquet")) {
      const src = `read_parquet(${sqlLit(`${dir}/contracts.parquet`)})`;
      await run(`
        CREATE VIEW contracts AS
        SELECT player AS player_name, gsis_id AS player_id, position, team, is_active,
          year_signed, years, value, apy, guaranteed, apy_cap_pct,
          draft_year, draft_round, draft_overall
        FROM ${src}`);
      await run(`
        CREATE VIEW contract_years AS
        SELECT player_name, player_id, position, TRY_CAST(h.year AS INTEGER) AS season,
          t.team_abbr AS team,
          h.cap_number, h.cash_paid, h.cap_percent, h.base_salary, h.guaranteed_salary
        FROM (
          SELECT player AS player_name, gsis_id AS player_id, position, year_signed,
            unnest(season_history) AS h
          FROM ${src}
        )
        LEFT JOIN (
          SELECT team_nick, any_value(team_abbr) AS team_abbr
          FROM read_parquet(${sqlLit(`${dir}/teams.parquet`)}) GROUP BY team_nick
        ) t ON t.team_nick = h.team
        WHERE regexp_matches(h.year, '^[0-9]{4}$')
        QUALIFY row_number() OVER (PARTITION BY player_name, player_id, h.year ORDER BY year_signed DESC) = 1`);
    }
    // Routes run per player per game (scripts/projections/build.py).
    if (has("routes.parquet")) {
      await run(parquetView("routes", `${dir}/routes.parquet`));
    }
    // Model output from scripts/projections (next game + breakout chance).
    if (has("projections.parquet")) {
      await run(parquetView("projections", `${dir}/projections.parquet`));
    }
    if (has("projections_weekly.parquet")) {
      await run(
        parquetView("projections_weekly", `${dir}/projections_weekly.parquet`),
      );
    }
    // Colors and logo URLs per team code (includes historical codes like OAK).
    if (has("teams.parquet")) {
      await run(parquetView("teams", `${dir}/teams.parquet`));
    }
    // pbp names are abbreviated ("P.Mahomes"); join full names so a small model
    // can filter with ILIKE '%mahomes%' without knowing the abbreviation.
    // passer_id/rusher_id/receiver_id follow nflfastR's dropback convention
    // (passer includes scrambles and sacks), unlike the *_player_id columns.
    await run(`
      CREATE VIEW pbp AS
      WITH names AS (
        SELECT gsis_id, any_value(display_name) AS display_name
        FROM players WHERE gsis_id IS NOT NULL GROUP BY gsis_id
      )
      SELECT p.*,
        pn.display_name AS passer_full_name,
        rn.display_name AS rusher_full_name,
        cn.display_name AS receiver_full_name
      FROM read_parquet(${sqlLit(`${dir}/pbp/*.parquet`)}, union_by_name = true) p
      LEFT JOIN names pn ON pn.gsis_id = p.passer_id
      LEFT JOIN names rn ON rn.gsis_id = p.rusher_id
      LEFT JOIN names cn ON cn.gsis_id = p.receiver_id`);
  },
  infoSql: `
    WITH latest AS (SELECT max(season) AS s FROM pbp)
    SELECT (SELECT min(season) FROM pbp) AS min_season,
           l.s AS max_season,
           max(p.week) AS max_week,
           arg_max(p.season_type, p.week) AS max_season_type
    FROM pbp p, latest l WHERE p.season = l.s GROUP BY l.s`,
};
