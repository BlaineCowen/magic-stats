import fs from "node:fs/promises";
import path from "node:path";
import { NFL_DATA_DIR } from "./db";
import { withTePremium, type Settings, type ValuedPlayer } from "./trade-grade";

/**
 * Market values for the trade calculator, from FantasyCalc (built from real trades in
 * leagues with the same settings). One fetch per settings combination every few hours.
 */

const TTL = 3 * 3600_000;
const cache = new Map<string, { at: number; players: ValuedPlayer[] }>();

type FcRow = {
  player: { id: number; name: string; sleeperId: string | null; position: string; maybeTeam: string | null; maybeAge: number | null };
  value: number;
};

export function settingsFrom(q: URLSearchParams): Settings {
  const n = (k: string, d: number) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.get(k) !== null ? v : d; };
  const teams = Math.min(16, Math.max(8, Math.round(n("teams", 12))));
  const ppr = [0, 0.5, 1].includes(n("ppr", 1)) ? (n("ppr", 1) as Settings["ppr"]) : 1;
  const tep = [0, 0.5, 1].includes(n("tep", 0)) ? (n("tep", 0) as Settings["tep"]) : 0;
  return { dynasty: q.get("dynasty") === "1", teams, qbs: n("qbs", 1) === 2 ? 2 : 1, ppr, tep };
}

export async function marketValues(s: Settings): Promise<ValuedPlayer[]> {
  const key = `${s.dynasty}|${s.teams}|${s.qbs}|${s.ppr}`;
  const hit = cache.get(key);
  let players = hit && Date.now() - hit.at < TTL ? hit.players : null;
  if (!players) {
    const url = `https://api.fantasycalc.com/values/current?isDynasty=${s.dynasty}&numQbs=${s.qbs}&numTeams=${s.teams}&ppr=${s.ppr}&includeAdp=false`;
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`FantasyCalc ${res.status}`);
      const rows = (await res.json()) as FcRow[];
      players = rows
        .filter((r) => r.value > 0)
        .map((r) => ({
          id: r.player.sleeperId ?? `fc${r.player.id}`,
          name: r.player.name,
          pos: r.player.position,
          team: r.player.maybeTeam ?? null,
          age: r.player.maybeAge ?? null,
          value: r.value,
        }))
        .sort((a, b) => b.value - a.value);
      cache.set(key, { at: Date.now(), players });
    } catch (e) {
      if (hit) players = hit.players; // stale beats nothing
      else throw e;
    }
  }
  return withTePremium(players, s.tep);
}

/**
 * Blaine's own values (ETR rest-of-season, half-PPR superflex, adjusted by the trade desk),
 * copied here each morning by the trade desk cron. Owner only: never send these to anyone else.
 * Scaled x10 so they read like market values.
 */
export async function etrValues(): Promise<{ players: ValuedPlayer[]; updated: string | null }> {
  const file = JSON.parse(await fs.readFile(path.join(NFL_DATA_DIR, "etr-values.json"), "utf8")) as {
    generated?: string;
    etrFileDate?: string | null;
    players: { sid: string; name: string; pos: string; team: string | null; ours: number | null }[];
  };
  const players = file.players
    .filter((p) => (p.ours ?? 0) > 0)
    .map((p) => ({ id: p.sid, name: p.name, pos: p.pos, team: p.team ?? null, age: null, value: Math.round(p.ours! * 10) }))
    .sort((a, b) => b.value - a.value);
  return { players, updated: file.etrFileDate ?? file.generated ?? null };
}

/**
 * KeepTradeCut crowd values: fans' keep/trade/cut votes, so roughly how a typical league mate
 * rates each player. Read from the rankings page (redraft or dynasty), superflex or 1-QB to match
 * the settings. KTC has no Sleeper IDs, so players are matched to Sleeper's player list by name,
 * position and team. Owner only, like the ETR values.
 */
type KtcRow = {
  playerName: string; playerID: number; position: string; team: string | null; age: number | null;
  oneQBValues?: { value?: number }; superflexValues?: { value?: number };
};
const ktcCache = new Map<string, { at: number; rows: KtcRow[] }>();
const KTC_TTL = 6 * 3600_000;

export const nameKey = (n: string) =>
  n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[.'’]/g, "").replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z]+/g, " ").trim();

// KTC's positions and team codes, in Sleeper's terms.
const KTC_POS: Record<string, string> = { RDP: "PICK", PK: "K", DST: "DEF" };
const KTC_TEAM: Record<string, string> = { GBP: "GB", KCC: "KC", SFO: "SF", NEP: "NE", NOS: "NO", TBB: "TB", LVR: "LV", JAC: "JAX", WSH: "WAS" };

export function parseKtc(html: string): KtcRow[] {
  const m = /<script[^>]*id="ktc-players"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("KTC page changed: no player list");
  return JSON.parse(m[1]!) as KtcRow[];
}

/** `pos` is every fantasy position he's listed at (Travis Hunter: DB and WR). */
export type SleeperPlayer = { id: string; name: string; pos: string[]; team: string | null; age: number | null };

/**
 * Gives KTC rows Sleeper IDs: same name and position (the same team when the name is shared),
 * else the same last name, position and team, which catches nicknames like Chig / Chigoziem.
 */
export function matchKtc(rows: KtcRow[], known: SleeperPlayer[], qbs: 1 | 2): ValuedPlayer[] {
  const byNamePos = new Map<string, SleeperPlayer[]>(), byLastPosTeam = new Map<string, SleeperPlayer[]>();
  const add = (m: Map<string, SleeperPlayer[]>, k: string, p: SleeperPlayer) => m.set(k, [...(m.get(k) ?? []), p]);
  const last = (n: string) => nameKey(n).split(" ").pop() ?? "";
  for (const p of known)
    for (const pos of p.pos) {
      add(byNamePos, `${nameKey(p.name)}|${pos}`, p);
      if (p.team) add(byLastPosTeam, `${last(p.name)}|${pos}|${p.team}`, p);
    }
  const seen = new Set<string>();
  const out: ValuedPlayer[] = [];
  for (const r of rows) {
    const value = (qbs === 2 ? r.superflexValues?.value : r.oneQBValues?.value) ?? 0;
    if (value <= 0) continue;
    const pos = KTC_POS[r.position] ?? r.position;
    const team = r.team ? KTC_TEAM[r.team] ?? r.team : null;
    // Defenses: KTC says "Kansas City Chiefs DST", Sleeper's ID is the team code.
    const cands = pos === "DEF" ? known.filter((p) => p.pos.includes("DEF") && p.id === team)
      : byNamePos.get(`${nameKey(r.playerName)}|${pos}`) ?? [];
    const loose = byLastPosTeam.get(`${last(r.playerName)}|${pos}|${team}`) ?? [];
    const hit = (cands.length === 1 ? cands[0] : cands.find((p) => p.team === team)) ?? (loose.length === 1 ? loose[0] : undefined);
    const id = hit && !seen.has(hit.id) ? hit.id : `ktc${r.playerID}`;
    seen.add(id);
    out.push({ id, name: hit?.name ?? r.playerName, pos, team: team ?? hit?.team ?? null, age: r.age ?? hit?.age ?? null, value });
  }
  return out.sort((a, b) => b.value - a.value);
}

// Sleeper asks for its full player list at most once a day.
let sleeperCache: { at: number; players: SleeperPlayer[] } | null = null;
async function sleeperPlayers(): Promise<SleeperPlayer[]> {
  if (sleeperCache && Date.now() - sleeperCache.at < 24 * 3600_000) return sleeperCache.players;
  try {
    const res = await fetch("https://api.sleeper.app/v1/players/nfl", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Sleeper ${res.status}`);
    const all = (await res.json()) as Record<string, {
      full_name?: string; first_name?: string; last_name?: string; position?: string; fantasy_positions?: string[] | null;
      team?: string | null; age?: number | null;
    }>;
    const keep = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);
    const players = Object.entries(all)
      .map(([id, p]) => [id, p, [...new Set([p.position ?? "", ...(p.fantasy_positions ?? [])])].filter((x) => keep.has(x))] as const)
      .filter(([, , pos]) => pos.length)
      .map(([id, p, pos]) => ({
        id, pos, team: p.team ?? null, age: p.age ?? null,
        name: p.full_name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      }));
    sleeperCache = { at: Date.now(), players };
    return players;
  } catch (e) {
    if (sleeperCache) return sleeperCache.players;
    throw e;
  }
}

/**
 * Puts players on another source's scale by rank: the nth best gets `scale`'s nth best value.
 * KTC's numbers are nearly flat (its 168th player is still worth a third of its first), which
 * breaks the star curve and the open roster spot credit, both tuned to FantasyCalc's curve.
 * So KTC keeps its order, and FantasyCalc, built from real trades, sets how far apart they are.
 */
export function onScale(players: ValuedPlayer[], scale: number[]): ValuedPlayer[] {
  const sorted = [...scale].sort((a, b) => b - a);
  const floor = sorted.at(-1) ?? 1;
  return [...players].sort((a, b) => b.value - a.value).map((p, i) => ({ ...p, value: Math.max(1, sorted[i] ?? floor) }));
}

/** The average of two value sets on the same scale. A player one leaves out counts 0 there. */
export function blend(a: ValuedPlayer[], b: ValuedPlayer[]): ValuedPlayer[] {
  const byId = new Map<string, { p: ValuedPlayer; sum: number }>();
  for (const p of [...a, ...b]) {
    const hit = byId.get(p.id);
    if (hit) hit.sum += p.value;
    else byId.set(p.id, { p, sum: p.value });
  }
  return [...byId.values()]
    .map(({ p, sum }) => ({ ...p, value: Math.round(sum / 2) }))
    .filter((p) => p.value > 0)
    .sort((x, y) => y.value - x.value);
}

/**
 * The crowd: KTC and FantasyCalc averaged, for checking whether league mates would accept a
 * trade. KTC alone is thin in redraft (a few hundred votes a player) and light on the superflex
 * QB premium; FantasyCalc alone is real trades but not all of them are leagues like this one.
 */
export async function crowdValues(s: Settings): Promise<{ players: ValuedPlayer[]; updated: string }> {
  const [k, fc] = await Promise.all([ktcValues(s), marketValues(s)]);
  return { players: blend(k.players, fc), updated: k.updated };
}

export async function ktcValues(s: Settings): Promise<{ players: ValuedPlayer[]; updated: string }> {
  const key = s.dynasty ? "dynasty" : "redraft";
  const hit = ktcCache.get(key);
  let rows = hit && Date.now() - hit.at < KTC_TTL ? hit.rows : null;
  if (!rows) {
    const url = `https://keeptradecut.com/${s.dynasty ? "dynasty-rankings" : "fantasy-rankings"}`;
    try {
      const res = await fetch(url, {
        cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" },
      });
      if (!res.ok) throw new Error(`KTC ${res.status}`);
      rows = parseKtc(await res.text());
      if (rows.length < 100) throw new Error(`KTC returned only ${rows.length} players`);
      ktcCache.set(key, { at: Date.now(), rows });
    } catch (e) {
      if (hit) rows = hit.rows; // stale beats nothing
      else throw e;
    }
  }
  const at = ktcCache.get(key)?.at ?? Date.now();
  const [known, fc] = await Promise.all([sleeperPlayers(), marketValues({ ...s, tep: 0 })]);
  const players = onScale(matchKtc(rows, known, s.qbs), fc.map((p) => p.value));
  return { players: withTePremium(players, s.tep), updated: new Date(at).toISOString() };
}
