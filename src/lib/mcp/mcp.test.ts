import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { hashKey, keyFrom, overLimit } from "./keys";
import { fmt, mdTable } from "./tools";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
process.env.MCP_DATA_DIR = dir;
const PRO = `ms_${"a".repeat(40)}`;
const FREE = `ms_${"b".repeat(40)}`;
const GONE = `ms_${"c".repeat(40)}`;
fs.writeFileSync(
  path.join(dir, "keys.json"),
  JSON.stringify({
    keys: [
      { id: "p1", name: "Pro", hash: hashKey(PRO), tier: "pro", created: "" },
      {
        id: "f1",
        name: "Free",
        hash: hashKey(FREE),
        tier: "free",
        created: "",
      },
      {
        id: "r1",
        name: "Old",
        hash: hashKey(GONE),
        tier: "pro",
        created: "",
        revoked: true,
      },
    ],
  }),
);

const req = (q: string, headers: Record<string, string> = {}) =>
  new Request(`https://x.test/api/mcp${q}`, { headers });

test("keys come from ?key= or a Bearer header; unknown and revoked ones don't work", () => {
  assert.equal(keyFrom(req(`?key=${PRO}`))?.id, "p1");
  assert.equal(
    keyFrom(req("", { authorization: `Bearer ${FREE}` }))?.tier,
    "free",
  );
  assert.equal(keyFrom(req(`?key=${GONE}`)), null);
  assert.equal(keyFrom(req(`?key=ms_${"z".repeat(40)}`)), null);
  assert.equal(keyFrom(req("?key=not-a-key")), null);
  assert.equal(keyFrom(req("")), null);
});

test("rate limit: 30 a minute, then it frees up", () => {
  const t = 1_000_000;
  for (let i = 0; i < 30; i++) assert.equal(overLimit("rl", t + i), null);
  assert.match(overLimit("rl", t + 31) ?? "", /minute/);
  assert.equal(overLimit("rl", t + 61_000), null);
});

test("fmt and mdTable", () => {
  assert.equal(fmt(0.23456), "0.235");
  assert.equal(fmt(12.345), "12.3");
  assert.equal(fmt(3.618), "3.62");
  assert.equal(fmt(8.4), "8.4");
  assert.equal(fmt(1234.5), "1235");
  assert.equal(fmt(7), "7");
  assert.equal(fmt(null), "");
  const t = mdTable(
    [
      { key: "a", label: "A" },
      { key: "b", label: "B|C" },
    ],
    [
      { a: "x|y", b: 1.5 },
      { a: "z", b: null },
    ],
    1,
  );
  assert.equal(
    t,
    "| A | B\\|C |\n| --- | --- |\n| x\\|y | 1.5 |\n(1 more rows not shown)",
  );
});

// End to end through the route, against the real data in data/nfl.
const hasData = fs.existsSync(path.join(process.cwd(), "data/nfl/pbp"));

/** The parts of a JSON-RPC reply these tests read. */
type Rpc = {
  result: {
    tools: {
      name: string;
      _meta: { ui: { resourceUri: string }; "openai/outputTemplate": string };
    }[];
    contents: { text: string }[];
    content: { text: string }[];
    isError?: boolean;
    structuredContent: {
      rows: Record<string, number>[];
      proof: { player: string; findings: unknown[] };
    };
  };
};

async function rpc(key: string, method: string, params: unknown = {}) {
  const { POST } = await import("@/app/api/mcp/route");
  const res = await POST(
    new Request(`https://x.test/api/mcp?key=${key}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  return {
    status: res.status,
    body: (await res.json()) as Rpc,
  };
}

test("route: no key is refused", { skip: !hasData }, async () => {
  const { POST } = await import("@/app/api/mcp/route");
  const res = await POST(
    new Request("https://x.test/api/mcp", { method: "POST" }),
  );
  assert.equal(res.status, 401);
});

test(
  "route: lists the tools with the result card",
  { skip: !hasData },
  async () => {
    const { body } = await rpc(PRO, "tools/list");
    const names = body.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "describe_data",
      "leaderboard",
      "make_the_case",
      "player",
      "projections",
      "run_sql",
      "start_sit",
      "trade_check",
    ]);
    const sql = body.result.tools.find((t) => t.name === "run_sql");
    assert.ok(sql);
    assert.equal(sql._meta["openai/outputTemplate"], sql._meta.ui.resourceUri);
    const res = await rpc(PRO, "resources/read", {
      uri: sql._meta.ui.resourceUri,
    });
    assert.match(res.body.result.contents[0]?.text ?? "", /ui\/initialize/);
  },
);

test(
  "route: run_sql uses the licensed tables only",
  { skip: !hasData },
  async () => {
    const ok = await rpc(PRO, "tools/call", {
      name: "run_sql",
      arguments: { sql: "SELECT count(*) AS n FROM pbp WHERE season = 2024" },
    });
    assert.ok((ok.body.result.structuredContent.rows[0]?.n ?? 0) > 40000);
    for (const view of ["contracts", "pfr_rec", "qbr_season", "projections"]) {
      const no = await rpc(PRO, "tools/call", {
        name: "run_sql",
        arguments: { sql: `SELECT * FROM ${view} LIMIT 1` },
      });
      assert.equal(no.body.result.isError, true, view);
      assert.match(
        no.body.result.content[0]?.text ?? "",
        /does not exist/,
        view,
      );
    }
    const write = await rpc(PRO, "tools/call", {
      name: "run_sql",
      arguments: { sql: "COPY (SELECT 1) TO '/tmp/x.csv'" },
    });
    assert.equal(write.body.result.isError, true);
  },
);

test(
  "route: describe_data leaves out the restricted tables",
  { skip: !hasData },
  async () => {
    const { body } = await rpc(PRO, "tools/call", {
      name: "describe_data",
      arguments: {},
    });
    const text = body.result.content[0]?.text ?? "";
    assert.match(text, /^pbp -- /m);
    assert.match(text, /^routes -- /m);
    for (const v of [
      "pfr_rec",
      "qbr_season",
      "contract_years",
      "projections",
    ]) {
      assert.ok(!new RegExp(`\\b${v}\\b`).test(text), v);
    }
  },
);

test("route: Pro tools need a Pro key", { skip: !hasData }, async () => {
  const free = await rpc(FREE, "tools/call", {
    name: "projections",
    arguments: {},
  });
  assert.equal(free.body.result.isError, true);
  assert.match(free.body.result.content[0]?.text ?? "", /Pro/);
  const pro = await rpc(PRO, "tools/call", {
    name: "projections",
    arguments: { position: "WR", limit: 5 },
  });
  assert.equal(pro.body.result.isError, undefined);
  assert.equal(pro.body.result.structuredContent.rows.length, 5);
});

test(
  "route: player and make_the_case resolve nicknames",
  { skip: !hasData },
  async () => {
    const p = await rpc(FREE, "tools/call", {
      name: "player",
      arguments: { name: "JSN" },
    });
    assert.match(
      p.body.result.content[0]?.text ?? "",
      /^Jaxon Smith-Njigba, WR/,
    );
    assert.match(
      p.body.result.content[0]?.text ?? "",
      /part of Magic Stats Pro/,
    );
    const c = await rpc(FREE, "tools/call", {
      name: "make_the_case",
      arguments: { subject: "Puka" },
    });
    assert.equal(c.body.result.structuredContent.proof.player, "Puka Nacua");
    assert.ok(c.body.result.structuredContent.proof.findings.length >= 5);
  },
);
