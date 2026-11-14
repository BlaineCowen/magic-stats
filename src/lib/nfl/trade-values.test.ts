import { test } from "node:test";
import assert from "node:assert/strict";
import { matchKtc, nameKey, parseKtc, type SleeperPlayer } from "./trade-values";

const row = (playerName: string, position: string, team: string, sf: number, oneQb = sf) =>
  ({ playerName, playerID: Math.round(sf), position, team, age: 25, superflexValues: { value: sf }, oneQBValues: { value: oneQb } });
const sp = (id: string, name: string, pos: string[], team: string | null): SleeperPlayer => ({ id, name, pos, team, age: null });

test("name key drops suffixes, accents and punctuation", () => {
  assert.equal(nameKey("Luther Burden III"), nameKey("Luther Burden"));
  assert.equal(nameKey("Michael Penix Jr."), "michael penix");
  assert.equal(nameKey("Ja'Marr Chase"), "jamarr chase");
});

test("KTC rows get Sleeper IDs by name, position, team and nickname", () => {
  const known = [
    sp("4984", "Josh Allen", ["QB"], "BUF"), sp("9999", "Josh Allen", ["DL"], "JAX"),
    sp("8210", "Chig Okonkwo", ["TE"], "WAS"), sp("12530", "Travis Hunter", ["DB", "WR"], "JAX"),
    sp("KC", "Kansas City Chiefs", ["DEF"], "KC"), sp("1", "Mike Williams", ["WR"], "NYJ"), sp("2", "Mike Williams", ["WR"], "PIT"),
  ];
  const out = matchKtc([
    row("Josh Allen", "QB", "BUF", 9990, 9000), row("Chigoziem Okonkwo", "TE", "WAS", 2000),
    row("Travis Hunter", "WR", "JAC", 3000), row("Kansas City Chiefs", "DST", "KCC", 800),
    row("Mike Williams", "WR", "PIT", 700), row("Nobody Here", "RB", "DAL", 600), row("Zero", "RB", "DAL", 0),
  ], known, 2);
  const ids = Object.fromEntries(out.map((p) => [p.name, p.id]));
  assert.equal(ids["Josh Allen"], "4984");
  assert.equal(ids["Chig Okonkwo"], "8210");
  assert.equal(ids["Travis Hunter"], "12530");
  assert.equal(ids["Kansas City Chiefs"], "KC");
  assert.equal(ids["Mike Williams"], "2");
  assert.ok(ids["Nobody Here"]!.startsWith("ktc"));
  assert.equal(out.length, 6, "zero values dropped");
  assert.equal(matchKtc([row("Josh Allen", "QB", "BUF", 9990, 9000)], known, 1)[0]!.value, 9000, "1-QB values");
});

test("parses the player list out of the page", () => {
  const html = `<html><script id="ktc-players" type="application/json">${JSON.stringify([row("A B", "WR", "DAL", 5)])}</script></html>`;
  assert.equal(parseKtc(html)[0]!.playerName, "A B");
  assert.throws(() => parseKtc("<html></html>"));
});
