"""Features for the fantasy projection and breakout models: one row per skill
player per regular-season game since 2016, using only what was known before
kickoff, plus rows for each team's next unplayed game.

  ../fourth-down/.venv/bin/python build.py
Reads data/nfl (nflverse + ffopportunity) and work/weather.parquet (weather.py).
Writes work/player_games.parquet.

Feature groups
  player usage   last 3 games and season to date: expected PPR points (xFP),
                 snap share, target/carry/air-yards share, expected TDs (red
                 zone work), actual PPR and points over expected (luck)
  prior season   PPR and xFP per game, games played
  tracking       Next Gen Stats to date: separation, YAC over expected,
                 rush yards over expected per carry, time to throw
  player         position, age, years in the league, draft capital
  game           Vegas implied team total and spread (game script), home,
                 rest days, divisional, primetime, indoor, temperature, wind,
                 rain
  team           pass rate over expected, plays per game, offensive EPA/play,
                 starting QB's EPA per dropback over his last 16 games
  opponent       PPR allowed to the position per game (season to date and last
                 season), defensive EPA/play allowed
  teammates      target and carry share vacated by teammates who aren't playing
"""

from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
D = HERE.parents[1] / "data" / "nfl"
WORK = HERE / "work"
FIRST = 2016
POS = "('QB', 'RB', 'WR', 'TE')"


def pq(name: str) -> str:
    p = D / name
    return f"read_parquet('{p}/*.parquet', union_by_name = true)" if p.is_dir() else f"read_parquet('{p}')"


def main() -> None:
    con = duckdb.connect()
    con.execute("SET threads = 4")
    con.execute(f"CREATE VIEW games AS SELECT * FROM {pq('games.parquet')}")
    con.execute(f"CREATE VIEW players AS SELECT * FROM {pq('players.parquet')}")
    con.execute(f"CREATE VIEW weather AS SELECT * FROM read_parquet('{WORK / 'weather.parquet'}')")

    # One row per team per regular-season game, with the betting context.
    # spread_line > 0 means the home team is favored.
    con.execute(f"""
      CREATE TABLE team_games AS
      WITH g AS (
        SELECT g.*, w.indoor, w.temp_f, w.wind_mph, w.precip_mm
        FROM games g LEFT JOIN weather w USING (game_id)
        WHERE g.season >= {FIRST - 1} AND g.game_type = 'REG'
      ),
      sides AS (
        SELECT game_id, season, week, gameday, gametime, home_team AS team, away_team AS opp, 1 AS home,
          spread_line AS spread, total_line, home_rest AS rest, div_game, indoor, temp_f, wind_mph, precip_mm,
          home_qb_id AS qb_id, home_score IS NOT NULL AS played
        FROM g
        UNION ALL
        SELECT game_id, season, week, gameday, gametime, away_team, home_team, 0,
          -spread_line, total_line, away_rest, div_game, indoor, temp_f, wind_mph, precip_mm,
          away_qb_id, home_score IS NOT NULL
        FROM g
      )
      SELECT *, total_line / 2 + spread / 2 AS implied_total,
        (gametime >= '19:00' OR dayname(gameday::DATE) IN ('Monday', 'Thursday'))::INT AS primetime
      FROM sides""")

    # Per player per game: production, expected production and shares.
    con.execute(f"""
      CREATE TABLE pg AS
      WITH w AS (
        SELECT player_id, season, week, game_id, team, position, fantasy_points_ppr AS ppr,
          targets, carries, receptions, air_yards_share, target_share,
          passing_epa, attempts
        FROM {pq('player_week')}
        WHERE season_type = 'REG' AND season >= {FIRST - 1} AND position IN {POS}
      ),
      x AS (
        SELECT player_id, game_id, total_fantasy_points_exp AS xfp,
          total_touchdown_exp AS xtd, rec_attempt_team AS team_targets, rush_attempt_team AS team_carries
        FROM {pq('xfp')} WHERE player_id IS NOT NULL
      ),
      s AS (
        SELECT p.gsis_id AS player_id, s.game_id, max(s.offense_pct) AS snap_pct
        FROM {pq('snaps')} s JOIN players p ON p.pfr_id = s.pfr_player_id
        GROUP BY ALL
      )
      SELECT w.*, x.xfp, x.xtd,
        w.targets / nullif(x.team_targets, 0) AS tgt_share,
        w.carries / nullif(x.team_carries, 0) AS car_share,
        s.snap_pct
      FROM w LEFT JOIN x USING (player_id, game_id) LEFT JOIN s USING (player_id, game_id)""")

    # Next Gen Stats, weekly rows (week > 0).
    con.execute(f"""
      CREATE TABLE ngs AS
      SELECT coalesce(r.player_id, u.player_id, p.player_id) AS player_id,
        coalesce(r.season, u.season, p.season) AS season, coalesce(r.week, u.week, p.week) AS week,
        r.avg_separation, r.avg_yac_above_expectation, r.targets AS ngs_targets,
        u.rush_yards_over_expected_per_att, u.rush_attempts AS ngs_rushes,
        p.avg_time_to_throw, p.aggressiveness, p.attempts AS ngs_attempts
      FROM (SELECT player_gsis_id AS player_id, season, week, avg_separation, avg_yac_above_expectation, targets
            FROM {pq('ngs_receiving.parquet')} WHERE week > 0 AND season_type = 'REG') r
      FULL JOIN (SELECT player_gsis_id AS player_id, season, week, rush_yards_over_expected_per_att, rush_attempts
            FROM {pq('ngs_rushing.parquet')} WHERE week > 0 AND season_type = 'REG') u USING (player_id, season, week)
      FULL JOIN (SELECT player_gsis_id AS player_id, season, week, avg_time_to_throw, aggressiveness, attempts
            FROM {pq('ngs_passing.parquet')} WHERE week > 0 AND season_type = 'REG') p USING (player_id, season, week)""")

    # Team tendencies per game from play-by-play.
    con.execute(f"""
      CREATE TABLE team_pbp AS
      SELECT game_id, posteam AS team,
        count(*) AS plays,
        avg(pass - xpass) FILTER (WHERE xpass IS NOT NULL AND wp BETWEEN 0.2 AND 0.8 AND down <= 3) AS proe,
        avg(epa) AS off_epa
      FROM {pq('pbp')}
      WHERE season >= {FIRST - 1} AND season_type = 'REG' AND (pass = 1 OR rush = 1) AND posteam IS NOT NULL
      GROUP BY ALL""")
    con.execute(f"""
      CREATE TABLE def_pbp AS
      SELECT game_id, defteam AS team, avg(epa) AS def_epa
      FROM {pq('pbp')}
      WHERE season >= {FIRST - 1} AND season_type = 'REG' AND (pass = 1 OR rush = 1) AND defteam IS NOT NULL
      GROUP BY ALL""")
    # QB quality: EPA per dropback per game, then each QB's last 16 games before a date.
    con.execute(f"""
      CREATE TABLE qb_games AS
      SELECT passer_id AS qb_id, game_id, any_value(season) AS season, any_value(week) AS week,
        sum(qb_epa) AS epa, count(*) AS dropbacks
      FROM {pq('pbp')}
      WHERE season >= {FIRST - 2} AND season_type = 'REG' AND qb_dropback = 1 AND passer_id IS NOT NULL
      GROUP BY ALL""")

    # Every row we want a prediction for: played games and the next unplayed game.
    # Upcoming rows take players who played for that team in its last 3 games.
    con.execute(f"""
      CREATE TABLE rows AS
      WITH next_game AS (
        SELECT team, arg_min(game_id, gameday) AS game_id, min(week) AS week, any_value(season) AS season
        FROM team_games WHERE NOT played AND season = (SELECT max(season) FROM team_games)
        GROUP BY team
      ),
      recent AS (
        SELECT player_id, team, position
        FROM pg
        WHERE season = (SELECT max(season) FROM pg)
          AND week >= (SELECT max(week) FROM pg WHERE season = (SELECT max(season) FROM pg)) - 3
        QUALIFY row_number() OVER (PARTITION BY player_id ORDER BY week DESC) = 1
      )
      SELECT player_id, season, week, game_id, team, position, ppr, xfp, false AS upcoming FROM pg
      WHERE season >= {FIRST}
      UNION ALL
      SELECT r.player_id, n.season, n.week, n.game_id, r.team, r.position, NULL, NULL, true
      FROM recent r JOIN next_game n USING (team)""")

    # Rolling player history (prior games only) via window frames over all of a
    # player's games in that season, upcoming row included.
    con.execute("""
      CREATE TABLE hist AS
      WITH raw AS (
        SELECT r.player_id, r.season, r.week, r.game_id, r.upcoming,
          p.ppr, p.xfp, p.xtd, p.tgt_share, p.car_share, p.air_yards_share, p.snap_pct,
          p.targets, p.carries,
          median(p.snap_pct) OVER (PARTITION BY r.player_id, r.season ORDER BY r.week
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS typical_snap,
          count(p.snap_pct) OVER (PARTITION BY r.player_id, r.season ORDER BY r.week
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS snap_games,
          median(p.xfp) OVER (PARTITION BY r.player_id, r.season ORDER BY r.week
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS typical_xfp
        FROM rows r LEFT JOIN pg p USING (player_id, game_id)
      ),
      -- A game with well under his usual snaps (75%) and usage (60%) is an
      -- early exit (injury, ejection, blowout rest): leave it out of his
      -- averages, the way fantasy sites do, so one partial game doesn't sink
      -- him. Requiring both keeps normal rotation swings in.
      h AS (
        SELECT * REPLACE (
          CASE WHEN partial THEN NULL ELSE ppr END AS ppr,
          CASE WHEN partial THEN NULL ELSE xfp END AS xfp,
          CASE WHEN partial THEN NULL ELSE xtd END AS xtd,
          CASE WHEN partial THEN NULL ELSE tgt_share END AS tgt_share,
          CASE WHEN partial THEN NULL ELSE car_share END AS car_share,
          CASE WHEN partial THEN NULL ELSE air_yards_share END AS air_yards_share,
          CASE WHEN partial THEN NULL ELSE snap_pct END AS snap_pct)
        FROM (
          SELECT *, coalesce(snap_games >= 2 AND snap_pct < 0.75 * typical_snap
            AND xfp < 0.6 * typical_xfp, false) AS partial
          FROM raw
        )
      )
      SELECT player_id, game_id,
        count(ppr) OVER prior AS games_to_date,
        avg(ppr) OVER prior AS ppr_pg,
        avg(xfp) OVER prior AS xfp_pg,
        avg(ppr - xfp) OVER prior AS luck_pg,
        avg(xtd) OVER prior AS xtd_pg,
        avg(tgt_share) OVER prior AS tgt_share,
        avg(car_share) OVER prior AS car_share,
        avg(air_yards_share) OVER prior AS ay_share,
        avg(snap_pct) OVER prior AS snap_pct,
        avg(ppr) OVER last3 AS ppr_l3,
        avg(xfp) OVER last3 AS xfp_l3,
        avg(xtd) OVER last3 AS xtd_l3,
        avg(tgt_share) OVER last3 AS tgt_share_l3,
        avg(car_share) OVER last3 AS car_share_l3,
        avg(snap_pct) OVER last3 AS snap_l3,
        max(xfp) OVER prior AS xfp_max,
        lag(xfp) OVER ord AS xfp_last
      FROM h
      WINDOW ord AS (PARTITION BY player_id, season ORDER BY week),
        prior AS (PARTITION BY player_id, season ORDER BY week ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),
        last3 AS (PARTITION BY player_id, season ORDER BY week ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING)""")

    con.execute("""
      CREATE TABLE prev_season AS
      SELECT player_id, season + 1 AS season, avg(ppr) AS ppr_prev, avg(xfp) AS xfp_prev,
        count(*) AS games_prev, avg(tgt_share) AS tgt_share_prev, avg(snap_pct) AS snap_prev
      FROM pg GROUP BY player_id, season""")

    # Tracking stats to date, weighted by volume.
    con.execute("""
      CREATE TABLE ngs_hist AS
      SELECT r.player_id, r.game_id,
        sum(n.avg_separation * n.ngs_targets) / nullif(sum(n.ngs_targets) FILTER (WHERE n.avg_separation IS NOT NULL), 0) AS separation,
        sum(n.avg_yac_above_expectation * n.ngs_targets) / nullif(sum(n.ngs_targets) FILTER (WHERE n.avg_yac_above_expectation IS NOT NULL), 0) AS yac_oe,
        sum(n.rush_yards_over_expected_per_att * n.ngs_rushes) / nullif(sum(n.ngs_rushes) FILTER (WHERE n.rush_yards_over_expected_per_att IS NOT NULL), 0) AS ryoe_att,
        sum(n.avg_time_to_throw * n.ngs_attempts) / nullif(sum(n.ngs_attempts) FILTER (WHERE n.avg_time_to_throw IS NOT NULL), 0) AS time_to_throw
      FROM rows r LEFT JOIN ngs n ON n.player_id = r.player_id AND n.season = r.season AND n.week < r.week
      GROUP BY r.player_id, r.game_id""")

    # Team form to date (prior games this season).
    con.execute("""
      CREATE TABLE team_form AS
      WITH t AS (
        SELECT tg.team, tg.game_id, tg.season, tg.week, tp.plays, tp.proe, tp.off_epa, dp.def_epa
        FROM team_games tg
        LEFT JOIN team_pbp tp ON tp.game_id = tg.game_id AND tp.team = tg.team
        LEFT JOIN def_pbp dp ON dp.game_id = tg.game_id AND dp.team = tg.team
      )
      SELECT team, game_id,
        avg(plays) OVER w AS team_plays, avg(proe) OVER w AS team_proe,
        avg(off_epa) OVER w AS team_off_epa, avg(def_epa) OVER w AS team_def_epa
      FROM t
      WINDOW w AS (PARTITION BY team, season ORDER BY week ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)""")

    # Fantasy points allowed to each position, per defense-game, then to date.
    con.execute("""
      CREATE TABLE def_pos AS
      WITH a AS (
        SELECT tg.opp AS defense, tg.season, tg.week, pg.position, sum(pg.ppr) AS ppr_allowed
        FROM pg JOIN team_games tg ON tg.game_id = pg.game_id AND tg.team = pg.team
        GROUP BY ALL
      ),
      slots AS (
        SELECT DISTINCT tg.opp AS defense, tg.season, tg.week, p.position
        FROM team_games tg, (VALUES ('QB'), ('RB'), ('WR'), ('TE')) p(position)
      )
      SELECT s.defense, s.position, s.season, s.week,
        avg(a.ppr_allowed) AS opp_pos_allowed, count(a.week) AS opp_games
      FROM slots s
      LEFT JOIN a ON a.defense = s.defense AND a.position = s.position
        AND a.season = s.season AND a.week < s.week
      GROUP BY ALL""")
    con.execute("""
      CREATE TABLE def_pos_prev AS
      SELECT tg.opp AS defense, pg.position, pg.season + 1 AS season,
        sum(pg.ppr) / count(DISTINCT pg.game_id) AS opp_pos_allowed_prev
      FROM pg JOIN team_games tg ON tg.game_id = pg.game_id AND tg.team = pg.team
      GROUP BY ALL""")

    # Starting QB's EPA/dropback over his previous 16 games. For upcoming games
    # with no listed starter, the team's most recent starter.
    con.execute("""
      CREATE TABLE qb_form AS
      WITH starter AS (
        SELECT tg.team, tg.game_id, tg.season, tg.week, tg.gameday,
          coalesce(tg.qb_id, last_value(tg.qb_id IGNORE NULLS) OVER (
            PARTITION BY tg.team ORDER BY tg.season, tg.week ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)) AS qb_id
        FROM team_games tg
      ),
      q AS (
        SELECT s.team, s.game_id, sum(g.epa) / nullif(sum(g.dropbacks), 0) AS qb_epa,
          sum(g.dropbacks) AS qb_dropbacks
        FROM starter s
        LEFT JOIN qb_games g ON g.qb_id = s.qb_id AND (g.season < s.season OR (g.season = s.season AND g.week < s.week))
          AND g.season >= s.season - 2
        GROUP BY s.team, s.game_id
      )
      SELECT * FROM q""")

    # Vacated share: teammates who played the team's previous game but not this one
    # (for upcoming games: listed Out or Doubtful, or on injured reserve).
    con.execute(f"""
      CREATE TABLE vacated AS
      WITH ordered AS (
        SELECT team, game_id, season, week, played,
          lag(game_id) OVER (PARTITION BY team, season ORDER BY week) AS prev_game
        FROM team_games
      ),
      inj AS (
        SELECT gsis_id AS player_id, season, week, team
        FROM {pq('injuries')}
        WHERE report_status IN ('Out', 'Doubtful') AND game_type = 'REG'
      ),
      prev_players AS (
        SELECT o.team, o.game_id, o.played, o.season, o.week, p.player_id,
          h.tgt_share, h.car_share
        FROM ordered o
        JOIN pg p ON p.game_id = o.prev_game AND p.team = o.team
        LEFT JOIN hist h ON h.player_id = p.player_id AND h.game_id = p.game_id
      )
      SELECT pp.team, pp.game_id,
        sum(coalesce(pp.tgt_share, 0)) FILTER (WHERE missing) AS vacated_tgt,
        sum(coalesce(pp.car_share, 0)) FILTER (WHERE missing) AS vacated_car
      FROM (
        SELECT pp.*,
          CASE WHEN pp.played THEN NOT EXISTS (
                 SELECT 1 FROM pg x WHERE x.game_id = pp.game_id AND x.player_id = pp.player_id)
               ELSE EXISTS (
                 SELECT 1 FROM inj i WHERE i.player_id = pp.player_id AND i.season = pp.season AND i.week = pp.week)
          END AS missing
        FROM prev_players pp
      ) pp
      GROUP BY pp.team, pp.game_id""")

    # Out or doubtful players themselves are dropped from upcoming rows.
    con.execute(f"""
      CREATE TABLE out_now AS
      SELECT DISTINCT gsis_id AS player_id, season, week FROM {pq('injuries')}
      WHERE report_status IN ('Out', 'Doubtful') AND game_type = 'REG'""")

    con.execute(f"""
      CREATE TABLE features AS
      SELECT r.player_id, pl.display_name AS name, r.season, r.week, r.game_id, r.team, tg.opp,
        r.position, r.upcoming, r.ppr, r.xfp AS xfp_game,
        h.* EXCLUDE (player_id, game_id),
        ps.ppr_prev, ps.xfp_prev, ps.games_prev, ps.tgt_share_prev, ps.snap_prev,
        n.separation, n.yac_oe, n.ryoe_att, n.time_to_throw,
        (r.position = 'QB')::INT AS is_qb, (r.position = 'RB')::INT AS is_rb,
        (r.position = 'WR')::INT AS is_wr, (r.position = 'TE')::INT AS is_te,
        date_diff('day', pl.birth_date::DATE, tg.gameday::DATE) / 365.25 AS age,
        r.season - coalesce(pl.rookie_season, pl.draft_year, r.season) AS years_exp,
        coalesce(pl.draft_round, 8) AS draft_round, coalesce(pl.draft_pick, 260) AS draft_pick,
        tg.home, tg.spread, tg.implied_total, tg.total_line, tg.rest, tg.div_game, tg.primetime,
        tg.indoor, tg.temp_f, tg.wind_mph, tg.precip_mm,
        tf.team_plays, tf.team_proe, tf.team_off_epa,
        otf.team_def_epa AS opp_def_epa,
        dp.opp_pos_allowed, dp.opp_games, dpp.opp_pos_allowed_prev,
        q.qb_epa, q.qb_dropbacks,
        coalesce(v.vacated_tgt, 0) AS vacated_tgt, coalesce(v.vacated_car, 0) AS vacated_car,
        -- Listed Out or Doubtful for the next game: no next-game projection,
        -- but the rest of his season still counts.
        r.upcoming AND EXISTS (
          SELECT 1 FROM out_now o WHERE o.player_id = r.player_id AND o.season = r.season AND o.week = r.week
        ) AS out_next
      FROM rows r
      JOIN team_games tg ON tg.game_id = r.game_id AND tg.team = r.team
      LEFT JOIN players pl ON pl.gsis_id = r.player_id
      LEFT JOIN hist h ON h.player_id = r.player_id AND h.game_id = r.game_id
      LEFT JOIN prev_season ps ON ps.player_id = r.player_id AND ps.season = r.season
      LEFT JOIN ngs_hist n ON n.player_id = r.player_id AND n.game_id = r.game_id
      LEFT JOIN team_form tf ON tf.team = r.team AND tf.game_id = r.game_id
      LEFT JOIN team_form otf ON otf.team = tg.opp AND otf.game_id = r.game_id
      LEFT JOIN def_pos dp ON dp.defense = tg.opp AND dp.position = r.position AND dp.season = r.season AND dp.week = r.week
      LEFT JOIN def_pos_prev dpp ON dpp.defense = tg.opp AND dpp.position = r.position AND dpp.season = r.season
      LEFT JOIN qb_form q ON q.team = r.team AND q.game_id = r.game_id
      LEFT JOIN vacated v ON v.team = r.team AND v.game_id = r.game_id""")

    # Later games for the rest-of-season view: each player's numbers as of now
    # (copied from his next-game row) with that game's own opponent, venue,
    # rest, betting lines and weather. Lines and forecasts only exist about two
    # weeks out, so most of these have NULLs there (train.py uses a model
    # without those inputs for them). Teammates' injuries are unknown that far
    # ahead, so vacated share is 0.
    con.execute("""
      CREATE TABLE future_games AS
      SELECT *, row_number() OVER (PARTITION BY team ORDER BY gameday, week) AS horizon
      FROM team_games
      WHERE NOT played AND season = (SELECT max(season) FROM team_games)""")
    con.execute("""
      CREATE TABLE features_future AS
      SELECT f.* REPLACE (
          fg.game_id AS game_id, fg.week AS week, fg.opp AS opp, fg.home AS home,
          fg.spread AS spread, fg.implied_total AS implied_total, fg.total_line AS total_line,
          fg.rest AS rest, fg.div_game AS div_game, fg.primetime AS primetime,
          fg.indoor AS indoor, fg.temp_f AS temp_f, fg.wind_mph AS wind_mph, fg.precip_mm AS precip_mm,
          otf.team_def_epa AS opp_def_epa, dp.opp_pos_allowed AS opp_pos_allowed, dp.opp_games AS opp_games,
          dpp.opp_pos_allowed_prev AS opp_pos_allowed_prev,
          0.0 AS vacated_tgt, 0.0 AS vacated_car, false AS out_next
        ),
        fg.horizon
      FROM features f
      JOIN future_games fg ON fg.team = f.team AND fg.horizon > 1
      LEFT JOIN team_form otf ON otf.team = fg.opp AND otf.game_id = fg.game_id
      LEFT JOIN def_pos dp ON dp.defense = fg.opp AND dp.position = f.position
        AND dp.season = fg.season AND dp.week = fg.week
      LEFT JOIN def_pos_prev dpp ON dpp.defense = fg.opp AND dpp.position = f.position
        AND dpp.season = fg.season
      WHERE f.upcoming""")
    con.execute("""
      CREATE TABLE all_rows AS
      SELECT *, CASE WHEN upcoming THEN 1 ELSE 0 END AS horizon FROM features
      UNION ALL BY NAME
      SELECT * FROM features_future""")

    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / "player_games.parquet"
    con.execute(f"COPY all_rows TO '{out}' (FORMAT parquet)")
    print(con.sql("SELECT horizon > 0 AS upcoming, count(*) n, max(horizon) max_horizon FROM all_rows GROUP BY 1").df())


if __name__ == "__main__":
    main()
