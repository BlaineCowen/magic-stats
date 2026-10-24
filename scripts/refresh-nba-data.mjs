#!/usr/bin/env node
/**
 * NBA data for Magic Stats, stored as zstd parquet under data/nba/.
 *
 * - 1997 onward: sportsdataverse-data releases (NBA Stats API box scores,
 *   schedules, season stats incl. advanced, standings, rosters, and
 *   RAPM/BPM/WAR impact metrics). Seasons are labelled by the year they end
 *   (2025 = 2024-25), as upstream does.
 * - The current season, until sportsdataverse publishes it: box scores built
 *   from ESPN's public game summaries, written in the same columns.
 * - Team colors and logos from ESPN.
 *
 *   node scripts/refresh-nba-data.mjs                # check everything, fetch what changed
 *   node scripts/refresh-nba-data.mjs --force
 *   node scripts/refresh-nba-data.mjs --seasons 2024-2027
 *
 * Env: NBA_DATA_DIR (default <repo>/data/nba)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  espnTeams,
  fetchJson,
  loadManifest,
  printTotals,
  refreshLogos,
  saveManifest,
  sqlStr,
  syncReleases,
  throttle,
  writeRows,
} from "./lib/refresh-kit.mjs";

const RELEASES =
  "https://github.com/sportsdataverse/sportsdataverse-data/releases/download";
const FIRST_SEASON = 1997;
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DATA_DIR = path.resolve(
  process.env.NBA_DATA_DIR ?? path.join(repoRoot, "data/nba"),
);
const TMP_DIR = path.join(DATA_DIR, ".tmp");
const CACHE_DIR = path.join(DATA_DIR, "espn-cache");
const MANIFEST = path.join(DATA_DIR, "manifest.json");

/** Seasons start in October and are named for the year they end. */
function currentSeason(now = new Date()) {
  return now.getUTCMonth() >= 9
    ? now.getUTCFullYear() + 1
    : now.getUTCFullYear();
}

const rel = (tag, file) => (y) => `${RELEASES}/${tag}/${file}_${y}.parquet`;
const SYNERGY = [
  ...["cut", "handoff", "isolation", "misc", "offrebound", "offscreen", "postup", "prballhandler", "prrollman", "spotup", "transition"].map((p) => [p, "offensive"]),
  ...["handoff", "isolation", "offscreen", "postup", "prballhandler", "prrollman", "spotup"].map((p) => [p, "defensive"]),
];
const DATASETS = [
  { name: "player_box", url: rel("nba_stats_player_boxscores", "player_boxscores"), order: ["game_id", "team_tricode"] },
  { name: "team_box", url: rel("nba_stats_team_boxscores", "team_boxscores"), order: ["game_id"] },
  { name: "schedules", url: rel("nba_stats_schedules", "nba_schedule"), order: ["game_date", "game_id"] },
  { name: "player_season", url: rel("nba_stats_player_season_stats", "player_season_stats"), order: ["season_type", "measure_type", "per_mode", "player_id"] },
  { name: "team_season", url: rel("nba_stats_team_season_stats", "team_season_stats"), order: ["season_type", "measure_type", "per_mode", "team_id"] },
  { name: "impact", url: rel("nba_player_impact", "nba_player_impact"), order: ["season_type", "player_id"] },
  { name: "standings", url: rel("nba_stats_standings", "standings"), order: ["team_id"] },
  { name: "rosters", url: rel("nba_stats_rosters", "rosters"), order: ["team_id", "player_id"] },
  // Player tracking (Second Spectrum, 2013-14 on): one file per measure, regular season and playoffs together.
  ...["catchshoot", "pullupshot", "drives", "defense", "passing", "possessions", "painttouch", "posttouch", "elbowtouch", "rebounding", "speeddistance"].map((m) => ({
    name: `tracking_${m}`, url: rel("nba_stats_leaguedash", `player_tracking_${m}`), order: ["season_type", "player_id"], from: 2014,
  })),
  // Hustle stats (contested shots, deflections, screen assists), 2015-16 on.
  ...["regular-season", "playoffs"].map((st) => ({
    name: `hustle_${st}`, url: rel("nba_stats_hustle", `leaguehustlestatsplayer_${st}_totals`), order: ["player_id"], from: 2016,
  })),
  // Synergy play types, 2015-16 on: one file per season type, play type and side.
  ...["regular-season", "playoffs"].flatMap((st) =>
    SYNERGY.map(([pt, side]) => ({
      name: `synergy_${st}_${pt}_${side}`, url: rel("nba_stats_synergy", `${st}_${pt}_${side}_totals`), order: ["player_id"], from: 2016,
    })),
  ),
];

// ESPN abbreviations that differ from the NBA's own tricodes.
const ESPN_TO_NBA = { GS: "GSW", NO: "NOP", NY: "NYK", SA: "SAS", UTAH: "UTA", WSH: "WAS" };
const nbaCode = (espn) => ESPN_TO_NBA[espn] ?? espn;

function parseArgs(argv) {
  const args = { force: false, from: FIRST_SEASON, to: currentSeason() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--force") args.force = true;
    else if (argv[i] === "--seasons") {
      const [a, b] = String(argv[++i]).split("-").map(Number);
      args.from = a;
      args.to = b || a;
    }
  }
  return args;
}

/** "Luka Dončić Jr." -> "luka doncic" so ESPN names match NBA Stats names. */
function normName(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const easternDate = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date(iso),
  );

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

/** NBA person_id by normalized name, from the most recent seasons we have. */
async function nameIndex(conn, season) {
  const files = [];
  for (let y = season - 3; y < season; y++) {
    const f = path.join(DATA_DIR, "player_box", `${y}.parquet`);
    if (fs.existsSync(f)) files.push(f);
  }
  const idx = new Map();
  if (!files.length) return idx;
  const rows = (
    await conn.runAndReadAll(
      `SELECT person_id, first_name || ' ' || family_name AS name, max(season) AS s
       FROM read_parquet([${files.map(sqlStr).join(", ")}], union_by_name = true)
       GROUP BY ALL ORDER BY s`,
    )
  ).getRowObjectsJson();
  for (const r of rows) idx.set(normName(r.name), Number(r.person_id));
  return idx;
}

/**
 * The current season from ESPN, written as player_box/team_box/schedules for
 * that season. Finished games are cached on disk, so a daily run only fetches
 * the newest ones.
 */
async function espnSeason(instance, season, manifest) {
  const espnGet = throttle(4);
  const sbDir = path.join(CACHE_DIR, "scoreboard");
  const gameDir = path.join(CACHE_DIR, "games");
  fs.mkdirSync(sbDir, { recursive: true });
  fs.mkdirSync(gameDir, { recursive: true });

  // Every date from October 1 to today; days older than 3 days are final and cached.
  const events = new Map();
  const today = new Date();
  for (
    let d = new Date(Date.UTC(season - 1, 9, 1));
    d <= today;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    const key = ymd(d);
    const file = path.join(sbDir, `${key}.json`);
    const settled = today.getTime() - d.getTime() > 3 * 86_400_000;
    let sb;
    if (settled && fs.existsSync(file)) {
      sb = JSON.parse(fs.readFileSync(file, "utf8"));
    } else {
      sb = await espnGet(() => fetchJson(`${ESPN}/scoreboard?dates=${key}&limit=50`));
      fs.writeFileSync(file, JSON.stringify(sb));
    }
    for (const e of sb.events ?? []) {
      // 2 regular season, 3 postseason, 5 play-in; skip preseason and All-Star.
      if (![2, 3, 5].includes(e.season?.type) || e.season?.year !== season) continue;
      if (e.status?.type?.completed) events.set(e.id, e);
    }
  }

  const summaries = [];
  let fetched = 0;
  for (const [id] of events) {
    const file = path.join(gameDir, `${id}.json`);
    if (!fs.existsSync(file)) {
      const s = await espnGet(() => fetchJson(`${ESPN}/summary?event=${id}`));
      fs.writeFileSync(file, JSON.stringify(s));
      fetched++;
    }
    summaries.push(JSON.parse(fs.readFileSync(file, "utf8")));
  }
  console.log(`espn ${season}: ${events.size} finished games, ${fetched} new`);
  if (!summaries.length) return 0;

  const conn = await instance.connect();
  const ids = await nameIndex(conn, season);
  const typeId = { 2: "2", 3: "4", 5: "5" };
  const typeName = { 2: "regular-season", 3: "playoffs", 5: "play-in" };
  const players = [];
  const teams = [];
  const games = [];
  let unmatched = 0;
  for (const s of summaries) {
    const comp = s.header.competitions[0];
    const t = s.header.season.type;
    const gameId = `espn${comp.id}`;
    const side = {};
    for (const c of comp.competitors) {
      side[c.homeAway] = { code: nbaCode(c.team.abbreviation), pts: Number(c.score), win: !!c.winner };
    }
    games.push({
      game_id: gameId,
      season,
      season_type: typeName[t],
      game_date: easternDate(comp.date),
      matchup: `${side.home.code} vs. ${side.away.code}`,
      home_team_abbreviation: side.home.code,
      home_pts: side.home.pts,
      home_wl: side.home.win ? "W" : "L",
      away_team_abbreviation: side.away.code,
      away_pts: side.away.pts,
      away_wl: side.away.win ? "W" : "L",
    });
    for (const box of s.boxscore?.players ?? []) {
      const code = nbaCode(box.team.abbreviation);
      const homeAway = side.home.code === code ? "home" : "away";
      const st = box.statistics?.[0];
      if (!st) continue;
      const k = Object.fromEntries(st.keys.map((key, i) => [key, i]));
      const tot = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
      for (const a of st.athletes ?? []) {
        const name = a.athlete.displayName;
        const [first, ...rest] = name.split(" ");
        let pid = ids.get(normName(name));
        if (pid == null) {
          unmatched++;
          pid = -Number(a.athlete.id); // negative: ESPN id, no NBA Stats match yet
        }
        const v = a.stats ?? [];
        const num = (key) => Number(v[k[key]] ?? 0) || 0;
        const pair = (key) => String(v[k[key]] ?? "0-0").split("-").map((x) => Number(x) || 0);
        const [fgm, fga] = pair("fieldGoalsMade-fieldGoalsAttempted");
        const [tpm, tpa] = pair("threePointFieldGoalsMade-threePointFieldGoalsAttempted");
        const [ftm, fta] = pair("freeThrowsMade-freeThrowsAttempted");
        const row = {
          team_tricode: code,
          side: homeAway,
          person_id: pid,
          first_name: first,
          family_name: rest.join(" "),
          position: a.starter ? (a.athlete.position?.abbreviation ?? "S") : "",
          comment: a.didNotPlay ? (a.reason ?? "DNP") : "",
          minutes: a.didNotPlay ? "" : `${num("minutes")}:00`,
          field_goals_made: fgm,
          field_goals_attempted: fga,
          three_pointers_made: tpm,
          three_pointers_attempted: tpa,
          free_throws_made: ftm,
          free_throws_attempted: fta,
          rebounds_offensive: num("offensiveRebounds"),
          rebounds_defensive: num("defensiveRebounds"),
          rebounds_total: num("rebounds"),
          assists: num("assists"),
          steals: num("steals"),
          blocks: num("blocks"),
          turnovers: num("turnovers"),
          fouls_personal: num("fouls"),
          points: num("points"),
          plus_minus_points: Number(String(v[k.plusMinus] ?? "0").replace("+", "")) || 0,
          game_id: gameId,
          season,
          season_type_id: typeId[t],
        };
        players.push(row);
        tot.pts += row.points; tot.fgm += fgm; tot.fga += fga; tot.tpm += tpm; tot.tpa += tpa;
        tot.ftm += ftm; tot.fta += fta; tot.oreb += row.rebounds_offensive; tot.dreb += row.rebounds_defensive;
        tot.reb += row.rebounds_total; tot.ast += row.assists; tot.stl += row.steals; tot.blk += row.blocks;
        tot.tov += row.turnovers; tot.pf += row.fouls_personal;
      }
      const opp = homeAway === "home" ? side.away : side.home;
      teams.push({
        team_tricode: code,
        side: homeAway,
        minutes: "240:00",
        field_goals_made: tot.fgm,
        field_goals_attempted: tot.fga,
        three_pointers_made: tot.tpm,
        three_pointers_attempted: tot.tpa,
        free_throws_made: tot.ftm,
        free_throws_attempted: tot.fta,
        rebounds_offensive: tot.oreb,
        rebounds_defensive: tot.dreb,
        rebounds_total: tot.reb,
        assists: tot.ast,
        steals: tot.stl,
        blocks: tot.blk,
        turnovers: tot.tov,
        fouls_personal: tot.pf,
        points: side[homeAway].pts,
        plus_minus_points: side[homeAway].pts - opp.pts,
        game_id: gameId,
        season,
        season_type_id: typeId[t],
      });
    }
  }

  const write = async (name, rows, order) => {
    const out = path.join(DATA_DIR, name, `${season}.parquet`);
    const n = await writeRows(conn, rows, out, TMP_DIR, order);
    manifest[`${name}/${season}`] = {
      source: "espn",
      storedBytes: fs.statSync(out).size,
      rows: n,
      refreshedAt: new Date().toISOString(),
    };
  };
  await write("player_box", players, "ORDER BY game_id, team_tricode");
  await write("team_box", teams, "ORDER BY game_id");
  await write("schedules", games, "ORDER BY game_date, game_id");
  conn.closeSync();
  console.log(
    `✓ espn ${season}: ${games.length} games, ${players.length} player rows (${unmatched} without an NBA Stats id yet)`,
  );
  return 0;
}

async function refreshTeams(instance, manifest, force) {
  const list = (await espnTeams("basketball/nba")).map((t) => ({
    team_abbr: nbaCode(t.espn),
    team_name: t.name,
    team_color: t.color,
    team_color2: t.color2,
    team_logo_espn: t.logo,
  }));
  const conn = await instance.connect();
  const out = path.join(DATA_DIR, "teams.parquet");
  const rows = await writeRows(conn, list, out, TMP_DIR, "ORDER BY team_abbr");
  conn.closeSync();
  manifest.teams = { source: "espn", storedBytes: fs.statSync(out).size, rows, refreshedAt: new Date().toISOString() };
  return refreshLogos(
    path.join(DATA_DIR, "logos"),
    list.map((t) => ({ abbr: t.team_abbr, logo: t.team_logo_espn })),
    force,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const manifest = loadManifest(MANIFEST);
  const instance = await DuckDBInstance.create(":memory:");
  const seasons = [];
  for (let y = Math.max(args.from, FIRST_SEASON); y <= args.to; y++) seasons.push(y);

  let failures = await syncReleases({
    instance,
    datasets: DATASETS,
    seasons,
    dataDir: DATA_DIR,
    tmpDir: TMP_DIR,
    manifest,
    force: args.force,
  });

  // Upstream publishes a season's box scores some time after it starts; until
  // then (manifest entry missing or still ESPN-built), build it from ESPN.
  const cur = currentSeason();
  const box = manifest[`player_box/${cur}`];
  if (seasons.includes(cur) && (!box || box.source === "espn")) {
    try {
      await espnSeason(instance, cur, manifest);
    } catch (e) {
      failures++;
      console.error(`✗ espn ${cur}: ${e.message}`);
    }
  }

  try {
    await refreshTeams(instance, manifest, args.force);
  } catch (e) {
    // Colors and logos only affect charts.
    console.warn(`! teams: ${e.message}`);
  }

  saveManifest(MANIFEST, manifest);
  printTotals(manifest);
  if (failures) {
    console.error(`${failures} step(s) failed`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
