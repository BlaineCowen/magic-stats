#!/usr/bin/env node
/**
 * MLB data for Magic Stats, stored as zstd parquet under data/mlb/.
 *
 * - MLB Stats API (statsapi.mlb.com), 2000 onward: season batting, pitching
 *   and fielding lines with sabermetrics (WAR, wOBA, wRC+, FIP, xFIP), team
 *   season stats, standings and every game's result.
 * - Baseball Savant leaderboards, 2015 onward: batted-ball quality, expected
 *   stats, pitch arsenals, sprint speed and outs above average.
 * - Player game logs from box scores for the last GAME_LOG_SEASONS seasons.
 * - Team colors and logos from ESPN.
 *
 * Finished seasons are fetched once; the current season is refreshed every run.
 *
 *   node scripts/refresh-mlb-data.mjs                 # fetch what's missing + the current season
 *   node scripts/refresh-mlb-data.mjs --force         # refetch every season
 *   node scripts/refresh-mlb-data.mjs --seasons 2024-2026
 *
 * Env: MLB_DATA_DIR (default <repo>/data/mlb)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DuckDBInstance } from "@duckdb/node-api";
import {
  espnTeams,
  fetchJson,
  fetchRetry,
  loadManifest,
  mapLimit,
  printTotals,
  refreshLogos,
  saveManifest,
  sqlStr,
  throttle,
  writeParquet,
  writeRows,
} from "./lib/refresh-kit.mjs";

const API = "https://statsapi.mlb.com/api/v1";
const SAVANT = "https://baseballsavant.mlb.com/leaderboard";
const FIRST_SEASON = 2000;
const FIRST_STATCAST = 2015;
const GAME_LOG_SEASONS = 3;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DATA_DIR = path.resolve(
  process.env.MLB_DATA_DIR ?? path.join(repoRoot, "data/mlb"),
);
const TMP_DIR = path.join(DATA_DIR, ".tmp");
const BOX_CACHE = path.join(DATA_DIR, "box-cache");
const MANIFEST = path.join(DATA_DIR, "manifest.json");

/** Spring training starts in late February; before March it's still last season. */
function currentSeason(now = new Date()) {
  return now.getUTCMonth() >= 2
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

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

const api = throttle(6);
const get = (p) => api(() => fetchJson(`${API}${p}`));
const num = (v) => {
  if (v == null || v === "" || v === "-.--" || v === ".---") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** "6.1" innings -> outs (19). */
const outsFromIp = (ip) => {
  const [w, f] = String(ip ?? "0").split(".");
  return Number(w) * 3 + Number(f ?? 0);
};

/** Current abbreviation per franchise id; every season uses it, like the NFL data. */
async function teamCodes(season) {
  const d = await get(`/teams?sportId=1&season=${season}`);
  return new Map(
    d.teams.map((t) => [t.id, { abbr: t.abbreviation, name: t.name, nick: t.teamName }]),
  );
}

async function leagueStats(group, kind, season) {
  const d = await get(
    `/stats?stats=${kind}&group=${group}&season=${season}&sportId=1&playerPool=ALL&limit=5000`,
  );
  return d.stats[0]?.splits ?? [];
}

/** player id -> "NYY" or "BOS/NYY" (alphabetical) from per-team queries. */
async function playerTeams(group, season, codes) {
  const out = new Map();
  await mapLimit([...codes.keys()], 4, async (id) => {
    const d = await get(
      `/stats?stats=season&group=${group}&season=${season}&teamId=${id}&playerPool=ALL&limit=500`,
    );
    for (const s of d.stats[0]?.splits ?? []) {
      const list = out.get(s.player.id) ?? [];
      list.push(codes.get(id).abbr);
      out.set(s.player.id, list);
    }
  });
  return new Map([...out].map(([k, v]) => [k, [...new Set(v)].sort().join("/")]));
}

async function seasonTables(conn, season, codes, manifest) {
  const [hit, hitSab, pit, pitSab, fld, hitTeams, pitTeams] = await Promise.all([
    leagueStats("hitting", "season", season),
    leagueStats("hitting", "sabermetrics", season),
    leagueStats("pitching", "season", season),
    leagueStats("pitching", "sabermetrics", season),
    leagueStats("fielding", "season", season),
    playerTeams("hitting", season, codes),
    playerTeams("pitching", season, codes),
  ]);
  const byId = (rows) => new Map(rows.map((r) => [r.player.id, r.stat]));
  const hs = byId(hitSab);
  const ps = byId(pitSab);
  // A traded player's combined row names only his last team; use the full list.
  const team = (s, map) =>
    (s.numTeams ?? 1) > 1 || !s.team?.id
      ? map.get(s.player.id) ?? codes.get(s.team?.id)?.abbr ?? null
      : codes.get(s.team.id)?.abbr ?? null;

  const batting = hit.map((s) => {
    const t = s.stat;
    const x = hs.get(s.player.id) ?? {};
    return {
      season,
      player_id: s.player.id,
      player_name: s.player.fullName,
      team: team(s, hitTeams),
      num_teams: s.numTeams ?? 1,
      position: s.position?.abbreviation ?? null,
      age: num(t.age),
      games: num(t.gamesPlayed),
      pa: num(t.plateAppearances),
      ab: num(t.atBats),
      runs: num(t.runs),
      hits: num(t.hits),
      doubles: num(t.doubles),
      triples: num(t.triples),
      home_runs: num(t.homeRuns),
      rbi: num(t.rbi),
      walks: num(t.baseOnBalls),
      intentional_walks: num(t.intentionalWalks),
      strikeouts: num(t.strikeOuts),
      hit_by_pitch: num(t.hitByPitch),
      sac_flies: num(t.sacFlies),
      stolen_bases: num(t.stolenBases),
      caught_stealing: num(t.caughtStealing),
      gidp: num(t.groundIntoDoublePlay),
      total_bases: num(t.totalBases),
      pitches_seen: num(t.numberOfPitches),
      avg: num(t.avg),
      obp: num(t.obp),
      slg: num(t.slg),
      ops: num(t.ops),
      babip: num(t.babip),
      woba: num(x.woba),
      wrc_plus: num(x.wRcPlus),
      wraa: num(x.wRaa),
      war: num(x.war),
      batting_runs: num(x.batting),
      baserunning_runs: num(x.baseRunning),
      fielding_runs: num(x.fielding),
      positional_runs: num(x.positional),
    };
  });

  const pitching = pit.map((s) => {
    const t = s.stat;
    const x = ps.get(s.player.id) ?? {};
    const bf = num(t.battersFaced);
    const outs = num(t.outs) ?? outsFromIp(t.inningsPitched);
    return {
      season,
      player_id: s.player.id,
      player_name: s.player.fullName,
      team: team(s, pitTeams),
      num_teams: s.numTeams ?? 1,
      age: num(t.age),
      games: num(t.gamesPitched ?? t.gamesPlayed),
      games_started: num(t.gamesStarted),
      wins: num(t.wins),
      losses: num(t.losses),
      saves: num(t.saves),
      save_opportunities: num(t.saveOpportunities),
      holds: num(t.holds),
      blown_saves: num(t.blownSaves),
      complete_games: num(t.completeGames),
      shutouts: num(t.shutouts),
      outs,
      innings: outs == null ? null : Math.round((outs / 3) * 1000) / 1000,
      batters_faced: bf,
      hits: num(t.hits),
      runs: num(t.runs),
      earned_runs: num(t.earnedRuns),
      home_runs: num(t.homeRuns),
      walks: num(t.baseOnBalls),
      strikeouts: num(t.strikeOuts),
      hit_batsmen: num(t.hitBatsmen),
      pitches: num(t.numberOfPitches),
      strikes: num(t.strikes),
      era: num(t.era),
      whip: num(t.whip),
      k_per_9: num(t.strikeoutsPer9Inn),
      bb_per_9: num(t.walksPer9Inn),
      hr_per_9: num(t.homeRunsPer9),
      k_pct: bf ? num(t.strikeOuts) / bf : null,
      bb_pct: bf ? num(t.baseOnBalls) / bf : null,
      avg_against: num(t.avg),
      fip: num(x.fip),
      xfip: num(x.xfip),
      era_minus: num(x.eraMinus),
      fip_minus: num(x.fipMinus),
      war: num(x.war),
    };
  });

  const fielding = fld.map((s) => {
    const t = s.stat;
    return {
      season,
      player_id: s.player.id,
      player_name: s.player.fullName,
      team: s.team?.id ? codes.get(s.team.id)?.abbr ?? null : null,
      position: s.position?.abbreviation ?? null,
      games: num(t.gamesPlayed ?? t.games),
      games_started: num(t.gamesStarted),
      innings: num(t.innings),
      putouts: num(t.putOuts),
      assists: num(t.assists),
      errors: num(t.errors),
      chances: num(t.chances),
      fielding_pct: num(t.fielding),
      double_plays: num(t.doublePlays),
      range_factor_per_9: num(t.rangeFactorPer9Inn),
    };
  });

  // Team season totals and records.
  const [tHit, tPit, standings] = await Promise.all([
    get(`/teams/stats?season=${season}&group=hitting&stats=season&sportIds=1`),
    get(`/teams/stats?season=${season}&group=pitching&stats=season&sportIds=1`),
    get(`/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=division`),
  ]);
  const tp = new Map(tPit.stats[0].splits.map((s) => [s.team.id, s.stat]));
  const rec = new Map();
  for (const r of standings.records ?? []) {
    for (const t of r.teamRecords) {
      rec.set(t.team.id, { t, division: r.division?.nameShort ?? r.division?.name ?? null });
    }
  }
  const teams = tHit.stats[0].splits.map((s) => {
    const h = s.stat;
    const p = tp.get(s.team.id) ?? {};
    const r = rec.get(s.team.id);
    const w = r?.t.wins ?? r?.t.leagueRecord?.wins;
    const l = r?.t.losses ?? r?.t.leagueRecord?.losses;
    return {
      season,
      team: codes.get(s.team.id)?.abbr ?? s.team.name,
      team_name: s.team.name,
      division: r?.division ?? null,
      wins: num(w),
      losses: num(l),
      win_pct: w != null && l != null && w + l ? w / (w + l) : null,
      division_rank: num(r?.t.divisionRank),
      games_back: r?.t.gamesBack === "-" ? 0 : num(r?.t.gamesBack),
      runs_scored: num(r?.t.runsScored ?? h.runs),
      runs_allowed: num(r?.t.runsAllowed ?? p.runs),
      run_diff: num(r?.t.runDifferential),
      home_runs: num(h.homeRuns),
      avg: num(h.avg),
      obp: num(h.obp),
      slg: num(h.slg),
      ops: num(h.ops),
      stolen_bases: num(h.stolenBases),
      batter_strikeouts: num(h.strikeOuts),
      batter_walks: num(h.baseOnBalls),
      era: num(p.era),
      whip: num(p.whip),
      pitcher_strikeouts: num(p.strikeOuts),
      pitcher_walks: num(p.baseOnBalls),
      home_runs_allowed: num(p.homeRuns),
      saves: num(p.saves),
    };
  });

  const write = async (name, rows, order) => {
    const out = path.join(DATA_DIR, name, `${season}.parquet`);
    const n = await writeRows(conn, rows, out, TMP_DIR, order);
    manifest[`${name}/${season}`] = { storedBytes: fs.statSync(out).size, rows: n, refreshedAt: new Date().toISOString() };
  };
  await write("batting", batting, "ORDER BY player_id");
  await write("pitching", pitching, "ORDER BY player_id");
  await write("fielding", fielding, "ORDER BY player_id, position");
  await write("team_seasons", teams, "ORDER BY team");
  return { batting: batting.length, pitching: pitching.length };
}

const GAME_TYPES = { R: "REG", F: "POST", D: "POST", L: "POST", W: "POST" };

async function schedule(conn, season, codes, manifest) {
  const d = await get(`/schedule?sportId=1&season=${season}&gameType=R,F,D,L,W`);
  // Keyed by gamePk: a suspended game is listed on both dates; the later one wins.
  const byPk = new Map();
  for (const day of d.dates ?? []) {
    for (const g of day.games) {
      if (g.status?.abstractGameState !== "Final" || g.status?.detailedState === "Postponed") continue;
      if (!GAME_TYPES[g.gameType]) continue;
      const h = g.teams.home;
      const a = g.teams.away;
      byPk.set(g.gamePk, {
        game_pk: g.gamePk,
        season,
        game_type: g.gameType,
        season_type: GAME_TYPES[g.gameType],
        game_date: g.officialDate,
        home_team: codes.get(h.team.id)?.abbr ?? h.team.name,
        away_team: codes.get(a.team.id)?.abbr ?? a.team.name,
        home_score: num(h.score),
        away_score: num(a.score),
        innings: num(g.scheduledInnings),
        double_header: g.doubleHeader ?? null,
        day_night: g.dayNight ?? null,
        venue: g.venue?.name ?? null,
        series_description: g.seriesDescription ?? null,
      });
    }
  }
  const rows = [...byPk.values()];
  const out = path.join(DATA_DIR, "games", `${season}.parquet`);
  const n = await writeRows(conn, rows, out, TMP_DIR, "ORDER BY game_date, game_pk");
  manifest[`games/${season}`] = { storedBytes: fs.statSync(out).size, rows: n, refreshedAt: new Date().toISOString() };
  return rows;
}

/** One finished game's box score, reduced to batting and pitching rows and cached. */
async function boxRows(game, codes) {
  const file = path.join(BOX_CACHE, String(game.season), `${game.game_pk}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const b = await get(`/game/${game.game_pk}/boxscore`);
  const batting = [];
  const pitching = [];
  for (const side of ["home", "away"]) {
    const t = b.teams[side];
    const team = codes.get(t.team.id)?.abbr ?? t.team.name;
    const opponent = side === "home" ? game.away_team : game.home_team;
    const base = { game_pk: game.game_pk, season: game.season, game_type: game.game_type, season_type: game.season_type, game_date: game.game_date, team, opponent, is_home: side === "home" };
    for (const p of Object.values(t.players ?? {})) {
      const bt = p.stats?.batting;
      if (bt && Object.keys(bt).length && num(bt.plateAppearances) > 0) {
        batting.push({
          ...base,
          player_id: p.person.id,
          player_name: p.person.fullName,
          position: p.position?.abbreviation ?? null,
          batting_order: p.battingOrder ? Math.floor(Number(p.battingOrder) / 100) : null,
          pa: num(bt.plateAppearances),
          ab: num(bt.atBats),
          runs: num(bt.runs),
          hits: num(bt.hits),
          doubles: num(bt.doubles),
          triples: num(bt.triples),
          home_runs: num(bt.homeRuns),
          rbi: num(bt.rbi),
          walks: num(bt.baseOnBalls),
          strikeouts: num(bt.strikeOuts),
          hit_by_pitch: num(bt.hitByPitch),
          stolen_bases: num(bt.stolenBases),
          caught_stealing: num(bt.caughtStealing),
          total_bases: num(bt.totalBases),
          left_on_base: num(bt.leftOnBase),
        });
      }
      const pt = p.stats?.pitching;
      if (pt && Object.keys(pt).length && (num(pt.battersFaced) ?? 0) > 0) {
        const note = String(pt.note ?? "");
        pitching.push({
          ...base,
          player_id: p.person.id,
          player_name: p.person.fullName,
          started: num(pt.gamesStarted) === 1,
          decision: /\(W/.test(note) ? "W" : /\(L/.test(note) ? "L" : /\(S/.test(note) ? "S" : /\(H/.test(note) ? "H" : /\(BS/.test(note) ? "BS" : null,
          outs: outsFromIp(pt.inningsPitched),
          innings: Math.round((outsFromIp(pt.inningsPitched) / 3) * 1000) / 1000,
          batters_faced: num(pt.battersFaced),
          hits: num(pt.hits),
          runs: num(pt.runs),
          earned_runs: num(pt.earnedRuns),
          walks: num(pt.baseOnBalls),
          strikeouts: num(pt.strikeOuts),
          home_runs: num(pt.homeRuns),
          pitches: num(pt.numberOfPitches ?? pt.pitchesThrown),
          strikes: num(pt.strikes),
        });
      }
    }
  }
  const rows = { batting, pitching };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows));
  return rows;
}

async function gameLogs(conn, season, games, codes, manifest) {
  const cached = (g) => fs.existsSync(path.join(BOX_CACHE, String(season), `${g.game_pk}.json`));
  const fresh = games.filter((g) => !cached(g)).length;
  const batting = [];
  const pitching = [];
  let done = 0;
  await mapLimit(games, 6, async (g) => {
    const r = await boxRows(g, codes);
    batting.push(...r.batting);
    pitching.push(...r.pitching);
    if (++done % 500 === 0) console.log(`  box scores ${season}: ${done}/${games.length}`);
  });
  for (const [name, rows] of [["batting_games", batting], ["pitching_games", pitching]]) {
    const out = path.join(DATA_DIR, name, `${season}.parquet`);
    const n = await writeRows(conn, rows, out, TMP_DIR, "ORDER BY game_date, game_pk, player_id");
    manifest[`${name}/${season}`] = { storedBytes: fs.statSync(out).size, rows: n, refreshedAt: new Date().toISOString() };
  }
  console.log(`✓ game logs ${season}: ${games.length} games (${fresh} new), ${batting.length} batting rows`);
}

const SAVANT_BOARDS = {
  statcast_batting: (y) => `statcast?type=batter&year=${y}&position=&team=&min=1&csv=true`,
  statcast_pitching: (y) => `statcast?type=pitcher&year=${y}&position=&team=&min=1&csv=true`,
  expected_batting: (y) => `expected_statistics?type=batter&year=${y}&position=&team=&filterType=bip&min=1&csv=true`,
  expected_pitching: (y) => `expected_statistics?type=pitcher&year=${y}&position=&team=&filterType=bip&min=1&csv=true`,
  pitch_arsenal: (y) => `pitch-arsenal-stats?type=pitcher&pitchType=&year=${y}&team=&min=1&csv=true`,
  sprint_speed: (y) => `sprint_speed?year=${y}&position=&team=&min=1&csv=true`,
  oaa: (y) => `outs_above_average?type=Fielder&startYear=${y}&endYear=${y}&split=no&team=&range=year&min=1&pos=&roles=&viz=hide&csv=true`,
};
const savant = throttle(1);

/** One Savant leaderboard CSV -> parquet with player_name ("First Last") and season. */
async function savantBoard(conn, name, season, manifest) {
  const res = await savant(() => fetchRetry(`${SAVANT}/${SAVANT_BOARDS[name](season)}`));
  if (!res.ok) throw new Error(`${name} ${season}: HTTP ${res.status}`);
  const text = (await res.text()).replace(/^﻿/, "");
  if (text.split("\n").length < 3) return; // nothing published for that season
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const csv = path.join(TMP_DIR, `${name}_${season}.csv`);
  fs.writeFileSync(csv, text);
  try {
    const src = `read_csv(${sqlStr(csv)}, header = true, sample_size = -1)`;
    const cols = (await conn.runAndReadAll(`DESCRIBE SELECT * FROM ${src}`)).getRowObjectsJson().map((r) => r.column_name);
    const nameCol = cols.find((c) => c.includes("last_name"));
    const drop = [nameCol, "year"].filter((c) => c && cols.includes(c)).map((c) => `"${c}"`);
    const out = path.join(DATA_DIR, "savant", name, `${season}.parquet`);
    const n = await writeParquet(
      conn,
      `SELECT ${season} AS season, player_id,
         trim(split_part("${nameCol}", ',', 2)) || ' ' || trim(split_part("${nameCol}", ',', 1)) AS player_name,
         * EXCLUDE (player_id${drop.length ? ", " + drop.join(", ") : ""})
       FROM ${src} ORDER BY player_id`,
      out,
    );
    manifest[`savant_${name}/${season}`] = { storedBytes: fs.statSync(out).size, rows: n, refreshedAt: new Date().toISOString() };
  } finally {
    fs.rmSync(csv, { force: true });
  }
}

async function refreshTeams(conn, codes, manifest, force) {
  const espn = await espnTeams("baseball/mlb");
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");
  const list = [...codes.values()].map((c) => {
    const e = espn.find((x) => norm(x.name).endsWith(norm(c.nick)));
    return {
      team_abbr: c.abbr,
      team_name: c.name,
      team_color: e?.color ?? null,
      team_color2: e?.color2 ?? null,
      team_logo_espn: e?.logo ?? null,
    };
  });
  const out = path.join(DATA_DIR, "teams.parquet");
  const rows = await writeRows(conn, list, out, TMP_DIR, "ORDER BY team_abbr");
  manifest.teams = { storedBytes: fs.statSync(out).size, rows, refreshedAt: new Date().toISOString() };
  await refreshLogos(
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
  const conn = await instance.connect();
  const cur = currentSeason();
  const codes = await teamCodes(cur);
  let failures = 0;
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      failures++;
      console.error(`✗ ${label}: ${e.message}`);
    }
  };
  // Finished seasons don't change, so they're fetched once unless --force.
  const need = (key, season) => args.force || season === cur || !manifest[key];

  for (let y = Math.max(args.from, FIRST_SEASON); y <= args.to; y++) {
    if (need(`batting/${y}`, y)) {
      await step(`season ${y}`, async () => {
        const n = await seasonTables(conn, y, codes, manifest);
        console.log(`✓ season ${y}: ${n.batting} batters, ${n.pitching} pitchers`);
      });
    }
    let games = null;
    if (need(`games/${y}`, y) || y > cur - GAME_LOG_SEASONS) {
      await step(`games ${y}`, async () => {
        games = await schedule(conn, y, codes, manifest);
      });
    }
    if (games && y > cur - GAME_LOG_SEASONS && (need(`batting_games/${y}`, y) || y === cur)) {
      await step(`game logs ${y}`, () => gameLogs(conn, y, games, codes, manifest));
    }
    if (y >= FIRST_STATCAST) {
      for (const name of Object.keys(SAVANT_BOARDS)) {
        if (need(`savant_${name}/${y}`, y)) await step(`savant ${name} ${y}`, () => savantBoard(conn, name, y, manifest));
      }
    }
    saveManifest(MANIFEST, manifest); // keep progress if a later season fails
  }

  await step("teams", () => refreshTeams(conn, codes, manifest, args.force));
  saveManifest(MANIFEST, manifest);
  conn.closeSync();
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
