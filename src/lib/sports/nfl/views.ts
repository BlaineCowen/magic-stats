import { parquetView, sqlLit, type SportViews } from "../view-kit";

/** nflverse data from scripts/refresh-nfl-data.mjs. */
export const nflViews: SportViews = {
  envVar: "NFL_DATA_DIR",
  rev: 3,
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
