import { parquetView, sqlLit, type SportViews } from "../view-kit";

/**
 * MLB data from scripts/refresh-mlb-data.mjs: MLB Stats API season lines and
 * game results, Baseball Savant leaderboards (2015+) and recent game logs.
 */
export const mlbViews: SportViews = {
  envVar: "MLB_DATA_DIR",
  rev: 1,
  required: ["batting", "pitching", "games"],
  async create({ run, dir, has }) {
    const src = (ds: string) =>
      `read_parquet(${sqlLit(`${dir}/${ds}/*.parquet`)}, union_by_name = true)`;
    const view = async (name: string, ds: string) => {
      if (has(ds)) await run(parquetView(name, `${dir}/${ds}/*.parquet`));
    };

    await view("batting_seasons", "batting");
    await view("pitching_seasons", "pitching");
    await view("fielding_seasons", "fielding");
    await view("team_seasons", "team_seasons");
    // A suspended game is listed on both its dates; keep the day it finished.
    await run(`
      CREATE VIEW games AS
      SELECT * FROM ${src("games")}
      QUALIFY ROW_NUMBER() OVER (PARTITION BY game_pk ORDER BY game_date DESC) = 1`);
    await view("batting_games", "batting_games");
    await view("pitching_games", "pitching_games");
    // Game logs only exist after the first full refresh; keep the views valid.
    for (const v of ["batting_games", "pitching_games"]) {
      if (!has(v))
        await run(`CREATE VIEW ${v} AS SELECT NULL::INT AS season, NULL::DATE AS game_date WHERE false`);
    }

    // One row per team per game, so records and splits don't need a home/away UNION.
    const side = (t: string, o: string, isHome: boolean) => `
      SELECT game_pk, season, game_type, season_type, game_date,
        ${t}_team AS team, ${o}_team AS opponent, ${isHome} AS is_home,
        ${t}_score AS runs_for, ${o}_score AS runs_against,
        CASE WHEN ${t}_score > ${o}_score THEN 1 ELSE 0 END AS win,
        CASE WHEN ${t}_score < ${o}_score THEN 1 ELSE 0 END AS loss,
        venue, day_night
      FROM games`;
    await run(
      `CREATE VIEW team_games AS ${side("home", "away", true)} UNION ALL ${side("away", "home", false)}`,
    );

    // Savant: batted-ball quality joined to expected stats, per player-season.
    const sv = (name: string) => `savant/${name}`;
    for (const [viewName, quality, expected, extra] of [
      ["statcast_batting", "statcast_batting", "expected_batting", ""],
      ["statcast_pitching", "statcast_pitching", "expected_pitching", ", x.era, x.xera"],
    ] as const) {
      if (!has(sv(quality)) || !has(sv(expected))) continue;
      await run(`
        CREATE VIEW ${viewName} AS
        SELECT q.season, q.player_id, q.player_name, x.pa,
          q.attempts AS batted_balls,
          q.avg_hit_speed AS avg_exit_velo, q.max_hit_speed AS max_exit_velo, q.ev50,
          q.avg_hit_angle AS avg_launch_angle, q.anglesweetspotpercent AS sweet_spot_pct,
          q.ev95percent AS hard_hit_pct, q.barrels, q.brl_percent AS barrel_pct,
          q.brl_pa AS barrels_per_pa, q.avg_distance, q.avg_hr_distance, q.max_distance,
          x.ba, x.est_ba AS xba, x.slg, x.est_slg AS xslg, x.woba, x.est_woba AS xwoba${extra}
        FROM ${src(sv(quality))} q
        LEFT JOIN ${src(sv(expected))} x ON x.player_id = q.player_id AND x.season = q.season`);
    }
    if (has(sv("pitch_arsenal"))) {
      await run(`
        CREATE VIEW pitch_arsenal AS
        SELECT season, player_id, player_name, team_name_alt AS team, pitch_type, pitch_name,
          pitches, pitch_usage AS usage_pct, run_value, run_value_per_100, pa,
          ba, est_ba AS xba, slg, est_slg AS xslg, woba, est_woba AS xwoba,
          whiff_percent AS whiff_pct, k_percent AS k_pct, put_away AS put_away_pct,
          hard_hit_percent AS hard_hit_pct
        FROM ${src(sv("pitch_arsenal"))}`);
    }
    if (has(sv("sprint_speed"))) {
      await run(`
        CREATE VIEW sprint_speed AS
        SELECT season, player_id, player_name, team, position, age,
          sprint_speed, competitive_runs, bolts, hp_to_1b
        FROM ${src(sv("sprint_speed"))}`);
    }
    if (has(sv("oaa")) && has("teams.parquet")) {
      await run(`
        CREATE VIEW outs_above_average AS
        SELECT o.season, o.player_id, o.player_name,
          -- Savant names teams by nickname ('Cubs', 'Red Sox')
          coalesce(t.team_abbr, o.display_team_name) AS team,
          primary_pos_formatted AS position, outs_above_average, fielding_runs_prevented,
          outs_above_average_infront AS oaa_in, outs_above_average_behind AS oaa_back,
          outs_above_average_lateral_toward3bline AS oaa_toward_3b,
          outs_above_average_lateral_toward1bline AS oaa_toward_1b
        FROM ${src(sv("oaa"))} o
        LEFT JOIN read_parquet(${sqlLit(`${dir}/teams.parquet`)}) t
          ON t.team_name = o.display_team_name OR t.team_name LIKE '% ' || o.display_team_name`);
    }
    if (has("teams.parquet")) {
      await run(parquetView("teams", `${dir}/teams.parquet`));
    }
  },
  infoSql: `
    SELECT (SELECT min(season) FROM batting_seasons) AS min_season,
      max(season) AS max_season,
      arg_max(season_type, game_date) AS max_season_type,
      strftime(max(game_date), '%Y-%m-%d') AS latest_date,
      (SELECT min(season) FROM batting_games) AS game_logs_from,
      2015 AS statcast_from
    FROM games`,
};
