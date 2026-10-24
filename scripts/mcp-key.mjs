#!/usr/bin/env node
/**
 * Manage Magic Stats connector keys (src/lib/mcp/keys.ts).
 *
 *   node scripts/mcp-key.mjs add "Will B" [--free]   # prints the key and connector URL once
 *   node scripts/mcp-key.mjs list
 *   node scripts/mcp-key.mjs revoke <id>
 *   node scripts/mcp-key.mjs tier <id> free|pro
 *   node scripts/mcp-key.mjs usage [YYYY-MM]          # calls per person and tool
 *
 * Keys live in $MCP_DATA_DIR/keys.json (default: the prod folder
 * /DATA/AppData/magic-stats-prod/mcp). Only hashes are stored. The server
 * rereads the file when it changes, so there's nothing to restart.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.MCP_DATA_DIR ?? "/DATA/AppData/magic-stats-prod/mcp";
const FILE = path.join(DIR, "keys.json");
const BASE =
  process.env.MCP_PUBLIC_URL ?? "https://projects.blainecowen.com/api/mcp";

const load = () =>
  fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE, "utf8"))
    : { keys: [] };
function save(db) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(db, null, 2)}\n`, { mode: 0o644 });
  fs.renameSync(tmp, FILE);
}
const find = (db, id) => {
  const k = db.keys.find((k) => k.id === id);
  if (!k)
    throw new Error(`No key with id ${id}. Run: node scripts/mcp-key.mjs list`);
  return k;
};

const [cmd, ...args] = process.argv.slice(2);
const db = load();

if (cmd === "add") {
  const name = args.find((a) => !a.startsWith("--"));
  if (!name) throw new Error('Usage: add "Name" [--free]');
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const key =
    "ms_" +
    Array.from(crypto.randomBytes(32), (b) => alphabet[b % 62]).join("");
  const id = crypto.randomBytes(4).toString("hex");
  db.keys.push({
    id,
    name,
    hash: crypto.createHash("sha256").update(key).digest("hex"),
    // Friends test: everyone gets Pro unless told otherwise.
    tier: args.includes("--free") ? "free" : "pro",
    created: new Date().toISOString(),
  });
  save(db);
  console.log(`Key ${id} for ${name}. It is shown only now.\n`);
  console.log(
    `Connector URL (ChatGPT developer mode or a Claude custom connector, no auth):`,
  );
  console.log(`  ${BASE}?key=${key}`);
} else if (cmd === "list") {
  for (const k of db.keys) {
    console.log(
      `${k.id}  ${k.tier.padEnd(4)}  ${k.revoked ? "revoked" : "active "}  ${k.created.slice(0, 10)}  ${k.name}`,
    );
  }
  if (!db.keys.length) console.log(`No keys in ${FILE}.`);
} else if (cmd === "revoke") {
  find(db, args[0]).revoked = true;
  save(db);
  console.log(`Revoked ${args[0]}.`);
} else if (cmd === "tier") {
  if (!["free", "pro"].includes(args[1]))
    throw new Error("Tier is free or pro");
  find(db, args[0]).tier = args[1];
  save(db);
  console.log(`${args[0]} is now ${args[1]}.`);
} else if (cmd === "usage") {
  const month = args[0] ?? new Date().toISOString().slice(0, 7);
  const file = path.join(DIR, `usage-${month}.jsonl`);
  if (!fs.existsSync(file)) {
    console.log(`No usage logged for ${month}.`);
    process.exit(0);
  }
  const names = new Map(db.keys.map((k) => [k.id, k.name]));
  const counts = new Map();
  for (const line of fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)) {
    const e = JSON.parse(line);
    const k = `${names.get(e.key) ?? e.key}\t${e.tool}`;
    const c = counts.get(k) ?? { calls: 0, failed: 0, ms: 0 };
    c.calls++;
    if (!e.ok) c.failed++;
    c.ms += e.ms;
    counts.set(k, c);
  }
  console.log("person\ttool\tcalls\tfailed\tavg ms");
  for (const [k, c] of [...counts].sort((a, b) => b[1].calls - a[1].calls)) {
    console.log(`${k}\t${c.calls}\t${c.failed}\t${Math.round(c.ms / c.calls)}`);
  }
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
}
