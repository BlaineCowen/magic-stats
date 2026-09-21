#!/usr/bin/env node
/**
 * Download nflverse parquet releases and store them re-encoded as zstd parquet
 * (one file per season per dataset) under data/nfl/. Safe to run repeatedly:
 * each upstream file is HEAD-checked and only re-downloaded when its ETag changes.
 *
 *   node scripts/refresh-nfl-data.mjs              # check everything, fetch what changed
 *   node scripts/refresh-nfl-data.mjs --force      # re-download everything
 *   node scripts/refresh-nfl-data.mjs --seasons 2024-2026
 *
 * Env: NFL_DATA_DIR (default <repo>/data/nfl)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DuckDBInstance } from "@duckdb/node-api";

const RELEASES = "https://github.com/nflverse/nflverse-data/releases/download";
const FIRST_SEASON = 1999;
// Upstream files are snappy; zstd 19 is ~42% smaller and decompresses just as fast.
const ZSTD_LEVEL = 19;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DATA_DIR = path.resolve(
  process.env.NFL_DATA_DIR ?? path.join(repoRoot, "data/nfl"),
);
const TMP_DIR = path.join(DATA_DIR, ".tmp");
const MANIFEST = path.join(DATA_DIR, "manifest.json");

/** Seasons run Aug–Feb, so Jan–Jul still belongs to last year's season. */
function currentSeason(now = new Date()) {
  return now.getUTCMonth() >= 7
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

const DATASETS = [
  {
    name: "pbp",
    url: (y) => `${RELEASES}/pbp/play_by_play_${y}.parquet`,
    order: ["game_id", "play_id"],
  },
  {
    name: "player_week",
    url: (y) => `${RELEASES}/stats_player/stats_player_week_${y}.parquet`,
    order: ["player_id", "week"],
  },
  {
    name: "team_week",
    url: (y) => `${RELEASES}/stats_team/stats_team_week_${y}.parquet`,
    order: ["team", "week"],
  },
  {
    name: "rosters",
    url: (y) => `${RELEASES}/rosters/roster_${y}.parquet`,
    order: ["team", "gsis_id"],
  },
  {
    name: "games",
    single: true,
    url: () => `${RELEASES}/schedules/games.parquet`,
    order: ["season", "game_id"],
  },
  {
    name: "players",
    single: true,
    url: () => `${RELEASES}/players/players.parquet`,
    order: ["gsis_id"],
  },
];

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

function targets({ from, to }) {
  const list = [];
  for (const ds of DATASETS) {
    if (ds.single) {
      list.push({
        ds,
        key: ds.name,
        url: ds.url(),
        out: path.join(DATA_DIR, `${ds.name}.parquet`),
      });
      continue;
    }
    for (let y = Math.max(from, FIRST_SEASON); y <= to; y++) {
      list.push({
        ds,
        key: `${ds.name}/${y}`,
        url: ds.url(y),
        out: path.join(DATA_DIR, ds.name, `${y}.parquet`),
      });
    }
  }
  return list;
}

async function head(url) {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  return {
    status: res.status,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    bytes: Number(res.headers.get("content-length") ?? 0),
  };
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const sqlStr = (s) => `'${s.replaceAll("'", "''")}'`;

async function reencode(conn, src, dest, orderCols) {
  const described = await conn.runAndReadAll(
    `DESCRIBE SELECT * FROM read_parquet(${sqlStr(src)})`,
  );
  const have = new Set(described.getRowObjectsJson().map((r) => r.column_name));
  const order = orderCols.filter((c) => have.has(c));
  const orderBy = order.length ? `ORDER BY ${order.join(", ")}` : "";
  await conn.run(
    `COPY (SELECT * FROM read_parquet(${sqlStr(src)}) ${orderBy}) TO ${sqlStr(dest)} ` +
      `(FORMAT parquet, COMPRESSION zstd, COMPRESSION_LEVEL ${ZSTD_LEVEL}, ROW_GROUP_SIZE 122880)`,
  );
  const count = async (f) =>
    Number(
      (
        await conn.runAndReadAll(
          `SELECT count(*) AS n FROM read_parquet(${sqlStr(f)})`,
        )
      ).getRowObjectsJson()[0].n,
    );
  const [a, b] = [await count(src), await count(dest)];
  if (a !== b)
    throw new Error(`row count mismatch after re-encode (${a} vs ${b})`);
  return b;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(TMP_DIR, { recursive: true });
  for (const ds of DATASETS)
    if (!ds.single)
      fs.mkdirSync(path.join(DATA_DIR, ds.name), { recursive: true });
  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
    : {};

  const all = targets(args);
  const heads = await mapLimit(all, 8, async (t) => ({
    t,
    h: await head(t.url).catch((e) => ({ error: e.message })),
  }));

  const todo = [];
  let missingUpstream = 0;
  for (const { t, h } of heads) {
    if (h.error || h.status !== 200) {
      // Rosters/stats for the newest season may not be published yet.
      missingUpstream++;
      if (h.error || h.status !== 404)
        console.warn(`! ${t.key}: HEAD ${h.error ?? h.status}`);
      continue;
    }
    const prev = manifest[t.key];
    if (!args.force && prev && prev.etag === h.etag && fs.existsSync(t.out))
      continue;
    todo.push({ t, h });
  }
  console.log(
    `${all.length} files checked, ${todo.length} to fetch, ${missingUpstream} not published upstream`,
  );

  const instance = await DuckDBInstance.create(":memory:");
  let failures = 0;
  // Encoding is CPU-bound; two at a time keeps the box responsive.
  await mapLimit(todo, 2, async ({ t, h }) => {
    const conn = await instance.connect();
    const raw = path.join(TMP_DIR, `${t.key.replace("/", "_")}.raw.parquet`);
    const tmpOut = `${t.out}.tmp`;
    const started = Date.now();
    try {
      await download(t.url, raw);
      const rows = await reencode(conn, raw, tmpOut, t.ds.order);
      fs.renameSync(tmpOut, t.out); // atomic swap: readers never see a partial file
      const stored = fs.statSync(t.out).size;
      manifest[t.key] = {
        etag: h.etag,
        lastModified: h.lastModified,
        upstreamBytes: h.bytes,
        storedBytes: stored,
        rows,
        refreshedAt: new Date().toISOString(),
      };
      console.log(
        `✓ ${t.key}: ${rows} rows, ${mb(h.bytes)} -> ${mb(stored)} (${Date.now() - started} ms)`,
      );
    } catch (e) {
      failures++;
      console.error(`✗ ${t.key}: ${e.message}`);
      fs.rmSync(tmpOut, { force: true });
    } finally {
      fs.rmSync(raw, { force: true });
      conn.closeSync();
    }
  });

  fs.writeFileSync(`${MANIFEST}.tmp`, JSON.stringify(manifest, null, 2));
  fs.renameSync(`${MANIFEST}.tmp`, MANIFEST);

  const totals = {};
  for (const [key, m] of Object.entries(manifest)) {
    const name = key.split("/")[0];
    totals[name] ??= { files: 0, up: 0, stored: 0 };
    totals[name].files++;
    totals[name].up += m.upstreamBytes;
    totals[name].stored += m.storedBytes;
  }
  let up = 0;
  let stored = 0;
  for (const [name, s] of Object.entries(totals)) {
    console.log(
      `  ${name.padEnd(12)} ${String(s.files).padStart(3)} files  ${mb(s.up).padStart(10)} upstream  ${mb(s.stored).padStart(10)} stored`,
    );
    up += s.up;
    stored += s.stored;
  }
  console.log(
    `  ${"total".padEnd(12)}              ${mb(up).padStart(10)} upstream  ${mb(stored).padStart(10)} stored`,
  );
  if (failures) {
    console.error(`${failures} file(s) failed`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
