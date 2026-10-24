import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Connector keys. Each person who connects Magic Stats to ChatGPT or Claude
 * gets their own key (scripts/mcp-key.mjs), so calls can be limited, counted
 * and switched off per person. The file holds only SHA-256 hashes; the key
 * itself is printed once when it's made.
 */

export type Tier = "free" | "pro";

export type KeyEntry = {
  id: string;
  name: string;
  hash: string;
  tier: Tier;
  created: string;
  revoked?: boolean;
};

export const mcpDir = () =>
  path.resolve(
    process.env.MCP_DATA_DIR ?? path.join(process.cwd(), "data/mcp"),
  );

export const hashKey = (key: string) =>
  crypto.createHash("sha256").update(key).digest("hex");

let cache: { mtime: number; byHash: Map<string, KeyEntry> } | null = null;

function loadKeys(): Map<string, KeyEntry> {
  const file = path.join(mcpDir(), "keys.json");
  let mtime: number;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    // No keys file: the connector is switched off.
    return new Map();
  }
  if (cache?.mtime === mtime) return cache.byHash;
  const { keys = [] } = JSON.parse(fs.readFileSync(file, "utf8")) as {
    keys?: KeyEntry[];
  };
  const byHash = new Map(
    keys.filter((k) => !k.revoked).map((k) => [k.hash, k]),
  );
  cache = { mtime, byHash };
  return byHash;
}

/** The key from `Authorization: Bearer` or `?key=`, if it's a live one. */
export function keyFrom(request: Request): KeyEntry | null {
  const auth = request.headers.get("authorization");
  const raw =
    auth?.match(/^Bearer\s+(\S+)$/i)?.[1] ??
    new URL(request.url).searchParams.get("key");
  if (!raw || !/^ms_[A-Za-z0-9]{20,64}$/.test(raw)) return null;
  return loadKeys().get(hashKey(raw)) ?? null;
}

// Generous for a person chatting, low enough that a runaway agent loop stops.
const LIMITS = [
  { windowMs: 60_000, max: 30, label: "30 calls a minute" },
  { windowMs: 86_400_000, max: 600, label: "600 calls a day" },
];
const calls = new Map<string, number[]>();

/** Count one call; returns the limit it broke, or null. */
export function overLimit(id: string, now = Date.now()): string | null {
  const longest = Math.max(...LIMITS.map((l) => l.windowMs));
  const times = (calls.get(id) ?? []).filter((t) => now - t < longest);
  for (const l of LIMITS) {
    if (times.filter((t) => now - t < l.windowMs).length >= l.max) {
      calls.set(id, times);
      return l.label;
    }
  }
  times.push(now);
  calls.set(id, times);
  return null;
}

/**
 * One line per tool call in data/mcp/usage-YYYY-MM.jsonl, so the friends test
 * shows which tools get used and which fail. Arguments are cut to 300 chars.
 */
export function logUsage(entry: {
  key: string;
  tool: string;
  args: unknown;
  ms: number;
  ok: boolean;
  error?: string;
}): void {
  const ts = new Date().toISOString();
  const line = JSON.stringify({
    ts,
    ...entry,
    args: JSON.stringify(entry.args ?? {}).slice(0, 300),
  });
  const file = path.join(mcpDir(), `usage-${ts.slice(0, 7)}.jsonl`);
  fs.promises.appendFile(file, `${line}\n`).catch(() => {
    // Read-only or missing dir (local dev): stdout still has it.
    console.log("mcp", line);
  });
}
