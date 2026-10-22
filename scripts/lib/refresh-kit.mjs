/**
 * Shared pieces of the NBA and MLB refresh scripts: polite HTTP, zstd parquet
 * writing through DuckDB, the ETag manifest and logo downloads. (The NFL
 * script predates this and keeps its own copies.)
 */
import fs from "node:fs";
import path from "node:path";

// Upstream files are snappy; zstd 19 is ~40% smaller and decompresses just as fast.
export const ZSTD_LEVEL = 19;
const UA = "magic-stats-refresh (projects.blainecowen.com)";

export const sqlStr = (s) => `'${String(s).replaceAll("'", "''")}'`;
export const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export async function mapLimit(items, limit, fn) {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with retries on 429/5xx and network errors. */
export async function fetchRetry(url, init = {}, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        ...init,
        headers: { "User-Agent": UA, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(60_000),
      });
      if ((res.status === 429 || res.status >= 500) && i < tries - 1) {
        await sleep(1000 * 2 ** i);
        continue;
      }
      return res;
    } catch (e) {
      if (i >= tries - 1) throw e;
      await sleep(1000 * 2 ** i);
    }
  }
}

export async function fetchJson(url) {
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

export async function head(url) {
  const res = await fetchRetry(url, { method: "HEAD" });
  return {
    status: res.status,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    bytes: Number(res.headers.get("content-length") ?? 0),
  };
}

export async function download(url, dest) {
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** Simple spacing between requests to one host, so a backfill stays polite. */
export function throttle(perSecond) {
  let last = 0;
  const gap = 1000 / perSecond;
  let chain = Promise.resolve();
  return (fn) => {
    const run = chain.then(async () => {
      const wait = last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
    });
    chain = run;
    return run.then(fn);
  };
}

const count = async (conn, f) =>
  Number(
    (
      await conn.runAndReadAll(
        `SELECT count(*) AS n FROM read_parquet(${sqlStr(f)})`,
      )
    ).getRowObjectsJson()[0].n,
  );

/** COPY a SELECT to zstd parquet at dest, written to dest.tmp and renamed into place. */
export async function writeParquet(conn, selectSql, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  try {
    await conn.run(
      `COPY (${selectSql}) TO ${sqlStr(tmp)} ` +
        `(FORMAT parquet, COMPRESSION zstd, COMPRESSION_LEVEL ${ZSTD_LEVEL}, ROW_GROUP_SIZE 122880)`,
    );
    const rows = await count(conn, tmp);
    fs.renameSync(tmp, dest); // atomic swap: readers never see a partial file
    return rows;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Re-encode a downloaded parquet file as sorted zstd, checking no rows were lost. */
export async function reencode(conn, src, dest, orderCols) {
  const described = await conn.runAndReadAll(
    `DESCRIBE SELECT * FROM read_parquet(${sqlStr(src)})`,
  );
  const have = new Set(described.getRowObjectsJson().map((r) => r.column_name));
  const order = orderCols.filter((c) => have.has(c));
  const orderBy = order.length ? `ORDER BY ${order.join(", ")}` : "";
  const rows = await writeParquet(
    conn,
    `SELECT * FROM read_parquet(${sqlStr(src)}) ${orderBy}`,
    dest,
  );
  const before = await count(conn, src);
  if (before !== rows)
    throw new Error(`row count mismatch after re-encode (${before} vs ${rows})`);
  return rows;
}

/** Rows (plain objects) -> zstd parquet via a temporary NDJSON file. */
export async function writeRows(conn, rows, dest, tmpDir, orderBy = "") {
  fs.mkdirSync(tmpDir, { recursive: true });
  const nd = path.join(tmpDir, `${path.basename(dest)}.${process.pid}.ndjson`);
  fs.writeFileSync(nd, rows.map((r) => JSON.stringify(r)).join("\n"));
  try {
    return await writeParquet(
      conn,
      `SELECT * FROM read_json(${sqlStr(nd)}, format = 'newline_delimited', sample_size = -1) ${orderBy}`,
      dest,
    );
  } finally {
    fs.rmSync(nd, { force: true });
  }
}

export function loadManifest(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

/** Rewrite the manifest atomically; its mtime is the app's data version. */
export function saveManifest(file, manifest) {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(manifest, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

/**
 * Mirror per-season parquet release files: HEAD each one, download only what
 * changed (by ETag), re-encode as zstd. Returns the number of failures.
 */
export async function syncReleases({
  instance,
  datasets,
  seasons,
  dataDir,
  tmpDir,
  manifest,
  force,
}) {
  const all = [];
  for (const ds of datasets) {
    for (const y of seasons) {
      if (ds.from && y < ds.from) continue;
      all.push({
        ds,
        key: `${ds.name}/${y}`,
        url: ds.url(y),
        out: path.join(dataDir, ds.name, `${y}.parquet`),
      });
    }
  }
  const heads = await mapLimit(all, 8, async (t) => ({
    t,
    h: await head(t.url).catch((e) => ({ error: e.message })),
  }));
  const todo = [];
  let missing = 0;
  for (const { t, h } of heads) {
    if (h.error || h.status !== 200) {
      missing++;
      if (h.error || h.status !== 404)
        console.warn(`! ${t.key}: HEAD ${h.error ?? h.status}`);
      continue;
    }
    const prev = manifest[t.key];
    if (!force && prev && prev.etag === h.etag && fs.existsSync(t.out))
      continue;
    todo.push({ t, h });
  }
  console.log(
    `${all.length} files checked, ${todo.length} to fetch, ${missing} not published upstream`,
  );
  fs.mkdirSync(tmpDir, { recursive: true });
  let failures = 0;
  await mapLimit(todo, 2, async ({ t, h }) => {
    const conn = await instance.connect();
    const raw = path.join(tmpDir, `${t.key.replace("/", "_")}.raw.parquet`);
    const started = Date.now();
    try {
      await download(t.url, raw);
      const rows = await reencode(conn, raw, t.out, t.ds.order ?? []);
      manifest[t.key] = {
        etag: h.etag,
        upstreamBytes: h.bytes,
        storedBytes: fs.statSync(t.out).size,
        rows,
        refreshedAt: new Date().toISOString(),
      };
      console.log(
        `✓ ${t.key}: ${rows} rows, ${mb(h.bytes)} -> ${mb(manifest[t.key].storedBytes)} (${Date.now() - started} ms)`,
      );
    } catch (e) {
      failures++;
      console.error(`✗ ${t.key}: ${e.message}`);
    } finally {
      fs.rmSync(raw, { force: true });
      conn.closeSync();
    }
  });
  return failures;
}

/** Small PNG logos via ESPN's resizer, for teams whose file is missing. */
export async function refreshLogos(logoDir, teams, force, px = 160) {
  fs.mkdirSync(logoDir, { recursive: true });
  const todo = teams.filter(
    (t) => t.logo && (force || !fs.existsSync(path.join(logoDir, `${t.abbr}.png`))),
  );
  let failed = 0;
  await mapLimit(todo, 6, async (t) => {
    const img = new URL(t.logo).pathname;
    const url = `https://a.espncdn.com/combiner/i?img=${img}&h=${px}&w=${px}`;
    const out = path.join(logoDir, `${t.abbr}.png`);
    try {
      await download(url, `${out}.tmp`);
      fs.renameSync(`${out}.tmp`, out);
    } catch (e) {
      failed++;
      console.warn(`! logo ${t.abbr}: ${e.message}`);
      fs.rmSync(`${out}.tmp`, { force: true });
    }
  });
  if (todo.length) console.log(`logos: ${todo.length - failed}/${todo.length} fetched`);
  return failed;
}

/** ESPN's team list for a league: abbreviation, name, colors, logo. */
export async function espnTeams(sportPath) {
  const d = await fetchJson(
    `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams`,
  );
  return d.sports[0].leagues[0].teams.map(({ team }) => ({
    espn: team.abbreviation,
    name: team.displayName,
    color: team.color ? `#${team.color}` : null,
    color2: team.alternateColor ? `#${team.alternateColor}` : null,
    logo: team.logos?.[0]?.href ?? null,
  }));
}

export function printTotals(manifest) {
  const totals = {};
  for (const [key, m] of Object.entries(manifest)) {
    const name = key.split("/")[0];
    totals[name] ??= { files: 0, stored: 0, rows: 0 };
    totals[name].files++;
    totals[name].stored += m.storedBytes ?? 0;
    totals[name].rows += m.rows ?? 0;
  }
  let stored = 0;
  for (const [name, s] of Object.entries(totals)) {
    console.log(
      `  ${name.padEnd(16)} ${String(s.files).padStart(3)} files ${String(s.rows).padStart(10)} rows ${mb(s.stored).padStart(10)}`,
    );
    stored += s.stored;
  }
  console.log(`  ${"total".padEnd(16)} ${mb(stored).padStart(37)}`);
}
