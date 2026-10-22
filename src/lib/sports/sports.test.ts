import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { viewerFrom } from "../query-limits";
import { cacheKey } from "./answer-cache";
import { isSport, logoUrl } from "./types";

describe("sports", () => {
  test("isSport accepts only known sports", () => {
    assert.ok(isSport("nfl") && isSport("nba") && isSport("mlb"));
    assert.ok(!isSport("NFL") && !isSport("nhl") && !isSport(undefined));
  });

  test("logoUrl keeps NFL URLs unchanged and tags the others", () => {
    assert.equal(logoUrl("nfl", "KC"), "/api/charts/logo/KC");
    assert.equal(logoUrl("nba", "LAL"), "/api/charts/logo/LAL?sport=nba");
  });

  test("cache keys differ by sport, mode and data version", () => {
    const k = cacheKey("nfl", "fast", "1", "Most points in 2024?");
    assert.notEqual(k, cacheKey("nba", "fast", "1", "Most points in 2024?"));
    assert.notEqual(k, cacheKey("nfl", "deep", "1", "Most points in 2024?"));
    assert.notEqual(k, cacheKey("nfl", "fast", "2", "Most points in 2024?"));
    assert.equal(k, cacheKey("nfl", "fast", "1", "  most POINTS   in 2024? "));
  });
});

describe("viewerFrom", () => {
  const h = (extra: Record<string, string>) =>
    new Headers({ "cf-connecting-ip": "1.2.3.4", ...extra });
  const claim = { "x-authentik-username": "x", "x-blaine-tier": "owner" };

  test("ignores identity headers without the proxy secret", () => {
    process.env.AUTH_PROXY_SECRET = "s3cret";
    for (const extra of [claim, { ...claim, "x-blaine-auth": "wrong!" }]) {
      const v = viewerFrom(h(extra));
      assert.equal(v.tier, "homie");
      assert.deepEqual(v.keys, ["ip:1.2.3.4"]);
    }
  });

  test("trusts them with the secret", () => {
    process.env.AUTH_PROXY_SECRET = "s3cret";
    const v = viewerFrom(h({ ...claim, "x-blaine-auth": "s3cret" }));
    assert.equal(v.tier, "owner");
    assert.deepEqual(v.keys, ["user:x"]);
  });

  test("never trusts them when no secret is configured", () => {
    delete process.env.AUTH_PROXY_SECRET;
    const v = viewerFrom(h({ ...claim, "x-blaine-auth": "" }));
    assert.equal(v.tier, "homie");
  });
});
