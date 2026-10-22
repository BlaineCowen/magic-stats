import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Side } from "./optimizer";

/**
 * Server-side pick'em storage for signed-in users: one JSON file per user per
 * week, and one file listing the pools. Small, so plain files with atomic
 * writes; a per-file queue keeps two saves from interleaving.
 */

const DIR = path.resolve(
  process.env.PICKEM_DIR ?? path.join(process.cwd(), "data/pickem"),
);

export type SavedEntry = {
  picks: Record<string, Side>;
  points: Record<string, number>;
  office: Record<string, { home: number; away: number }>;
  pinned: string[];
  updated: string;
};

export type Pool = {
  id: string;
  name: string;
  /** Six characters friends type to join. */
  code: string;
  owner: string;
  members: string[];
  /** Hide other members' picks until each game kicks off. */
  hidePicks: boolean;
  created: string;
};

const queues = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value));
  await fs.rename(tmp, file);
}

/** Usernames become file names: keep safe ones readable, hash anything else. */
function userFile(user: string) {
  return /^[A-Za-z0-9._@-]{1,64}$/.test(user)
    ? user
    : createHash("sha256").update(user).digest("hex").slice(0, 32);
}

const entryPath = (user: string, season: number, week: number) =>
  path.join(DIR, "entries", `${season}-${week}`, `${userFile(user)}.json`);

export function getEntry(user: string, season: number, week: number) {
  return readJson<SavedEntry | null>(entryPath(user, season, week), null);
}

export function putEntry(
  user: string,
  season: number,
  week: number,
  e: SavedEntry,
) {
  const file = entryPath(user, season, week);
  return serialize(file, () => writeJson(file, e));
}

/**
 * Apply a save on top of what's stored, keeping picks and points for games
 * that have kicked off exactly as they were: no switching sides or moving
 * points after kickoff. Returns an error when the save would reuse a point
 * value a locked game holds.
 */
export function mergeEntry(
  old: SavedEntry | null,
  incoming: Omit<SavedEntry, "updated">,
  gameIds: string[],
  started: Set<string>,
): { entry: SavedEntry } | { error: string } {
  const picks: Record<string, Side> = {};
  const points: Record<string, number> = {};
  for (const id of gameIds) {
    const locked = started.has(id);
    const pick = locked ? old?.picks[id] : incoming.picks[id];
    const pts = locked ? old?.points[id] : incoming.points[id];
    if (pick === "home" || pick === "away") picks[id] = pick;
    if (typeof pts === "number" && Number.isInteger(pts)) points[id] = pts;
  }
  const n = gameIds.length;
  const values = Object.values(points);
  if (
    values.some((v) => v < 1 || v > n) ||
    new Set(values).size !== values.length
  ) {
    return {
      error:
        "Those confidence points clash with a game that has already kicked off. Reload and try again.",
    };
  }
  return {
    entry: {
      picks,
      points,
      office: incoming.office ?? {},
      pinned: (incoming.pinned ?? []).filter((id) => gameIds.includes(id)),
      updated: new Date().toISOString(),
    },
  };
}

const POOLS = path.join(DIR, "pools.json");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function listPools(): Promise<Pool[]> {
  return readJson<Pool[]>(POOLS, []);
}

export async function poolsFor(user: string): Promise<Pool[]> {
  return (await listPools()).filter((p) => p.members.includes(user));
}

function updatePools<T>(
  fn: (pools: Pool[]) => { pools: Pool[]; result: T },
): Promise<T> {
  return serialize(POOLS, async () => {
    const { pools, result } = fn(await listPools());
    await writeJson(POOLS, pools);
    return result;
  });
}

export function createPool(
  owner: string,
  name: string,
  hidePicks: boolean,
): Promise<Pool> {
  return updatePools((pools) => {
    let code = "";
    do {
      code = Array.from(
        randomBytes(6),
        (b) => CODE_CHARS[b % CODE_CHARS.length],
      ).join("");
    } while (pools.some((p) => p.code === code));
    const pool: Pool = {
      id: randomBytes(8).toString("hex"),
      name: name.trim().slice(0, 60) || "My pool",
      code,
      owner,
      members: [owner],
      hidePicks,
      created: new Date().toISOString(),
    };
    return { pools: [...pools, pool], result: pool };
  });
}

export function joinPool(user: string, code: string): Promise<Pool | null> {
  const want = code.trim().toUpperCase();
  return updatePools((pools) => {
    const pool = pools.find((p) => p.code === want);
    if (!pool) return { pools, result: null };
    if (!pool.members.includes(user)) pool.members.push(user);
    return { pools, result: pool };
  });
}

export function leavePool(user: string, id: string): Promise<boolean> {
  return updatePools((pools) => {
    const pool = pools.find((p) => p.id === id);
    if (!pool?.members.includes(user)) return { pools, result: false };
    pool.members = pool.members.filter((m) => m !== user);
    // The last one out deletes it; otherwise the next member inherits it.
    const kept = pool.members.length ? pools : pools.filter((p) => p.id !== id);
    if (pool.owner === user && pool.members.length)
      pool.owner = pool.members[0]!;
    return { pools: kept, result: true };
  });
}
