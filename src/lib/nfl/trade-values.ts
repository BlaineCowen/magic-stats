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
