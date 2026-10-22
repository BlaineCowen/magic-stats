import { winProb } from "./optimizer";

/**
 * One NFL week from ESPN's public scoreboard: odds before kickoff, score,
 * clock and live win probability during the game. Safe to import from client
 * code (types and pure helpers only, apart from fetchWeek).
 */

const ESPN =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

export type TeamSide = {
  id: string;
  abbr: string;
  name: string;
  short: string;
  logo: string | null;
  color: string | null;
  record: string | null;
  score: number | null;
};

export type GameState = "pre" | "in" | "post";

export type PickemGame = {
  id: string;
  kickoff: string;
  state: GameState;
  final: boolean;
  /** "Q3 5:12", "Final", "Sun 1:00 PM" */
  detail: string;
  home: TeamSide;
  away: TeamSide;
  /** Home line: negative = home favoured. */
  spread: number | null;
  overUnder: number | null;
  homeMl: number | null;
  awayMl: number | null;
  /** Pregame home win chance and where it came from. */
  pHome: number;
  probSource: "moneyline" | "spread" | "none";
  /** ESPN's in-game home win chance, when live. */
  liveHome: number | null;
  possession: "home" | "away" | null;
  downDistance: string | null;
  redZone: boolean;
};

export type PickemWeek = {
  season: number;
  week: number;
  seasonType: number;
  games: PickemGame[];
  fetched: string;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" ? (v as Json) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

function parseMl(v: unknown): number | null {
  const s = strOrNull(v)?.trim();
  if (!s) return null;
  if (/^even$/i.test(s)) return 100;
  const n = Number(s.replace(/^\+/, ""));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function moneyline(side: unknown): number | null {
  const o = obj(side);
  return parseMl(obj(o.close).odds) ?? parseMl(obj(o.open).odds);
}

function team(c: Json): TeamSide | null {
  const t = obj(c.team);
  if (typeof t.id !== "string") return null;
  const name = strOrNull(t.displayName) ?? strOrNull(t.name) ?? "Unknown";
  const score = Number(c.score);
  const rec = arr(c.records).map(obj)[0];
  return {
    id: t.id,
    abbr: strOrNull(t.abbreviation) ?? name.slice(0, 3).toUpperCase(),
    name,
    short: strOrNull(t.name) ?? name,
    logo: strOrNull(t.logo),
    color: strOrNull(t.color) ? `#${String(t.color)}` : null,
    record: rec ? strOrNull(rec.summary) : null,
    score: c.score !== undefined && Number.isFinite(score) ? score : null,
  };
}

function game(e: Json): PickemGame | null {
  const comp = obj(arr(e.competitions)[0]);
  const cs = arr(comp.competitors).map(obj);
  const homeC = cs.find((c) => c.homeAway === "home");
  const awayC = cs.find((c) => c.homeAway === "away");
  const home = homeC && team(homeC);
  const away = awayC && team(awayC);
  if (!home || !away || typeof e.id !== "string") return null;
  const st = obj(obj(e.status).type);
  const state =
    (["pre", "in", "post"] as const).find((s) => s === st.state) ?? "pre";
  const odds = obj(arr(comp.odds)[0]);
  const ml = obj(odds.moneyline);
  const spread = typeof odds.spread === "number" ? odds.spread : null;
  const homeMl = moneyline(ml.home);
  const awayMl = moneyline(ml.away);
  const { pHome, source } = winProb(homeMl, awayMl, spread);
  const sit = obj(comp.situation);
  const prob = obj(obj(sit.lastPlay).probability);
  const liveHome =
    state === "in" && typeof prob.homeWinPercentage === "number"
      ? prob.homeWinPercentage
      : null;
  const poss = strOrNull(sit.possession);
  if (state === "pre") {
    home.score = null;
    away.score = null;
  }
  return {
    id: e.id,
    kickoff: String(e.date),
    state,
    final: st.completed === true,
    detail: strOrNull(st.shortDetail) ?? strOrNull(st.detail) ?? "",
    home,
    away,
    spread,
    overUnder: typeof odds.overUnder === "number" ? odds.overUnder : null,
    homeMl,
    awayMl,
    pHome,
    probSource: source,
    liveHome,
    possession: poss === home.id ? "home" : poss === away.id ? "away" : null,
    downDistance: state === "in" ? strOrNull(sit.shortDownDistanceText) : null,
    redZone: state === "in" && sit.isRedZone === true,
  };
}

/** A regular-season week, or the current week when season/week are omitted. */
export async function fetchWeek(
  season?: number,
  week?: number,
): Promise<PickemWeek> {
  const q = new URLSearchParams();
  if (season && week) {
    q.set("seasontype", "2");
    q.set("week", String(week));
    q.set("dates", String(season));
  }
  const res = await fetch(q.size ? `${ESPN}?${q}` : ESPN, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`);
  return parseScoreboard(await res.json(), season, week);
}

/** ESPN scoreboard JSON to a week. Pure, for tests. */
export function parseScoreboard(
  json: unknown,
  season?: number,
  week?: number,
): PickemWeek {
  const d = obj(json);
  const games = arr(d.events)
    .map((e) => game(obj(e)))
    .filter((g): g is PickemGame => g !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const s = obj(d.season);
  return {
    season:
      typeof s.year === "number"
        ? s.year
        : (season ?? new Date().getFullYear()),
    week:
      typeof obj(d.week).number === "number"
        ? (obj(d.week).number as number)
        : (week ?? 1),
    seasonType: typeof s.type === "number" ? s.type : 2,
    games,
    fetched: new Date().toISOString(),
  };
}

/** Live or about to start: poll often. */
export function isActive(w: PickemWeek, now = Date.now()): boolean {
  return w.games.some((g) => {
    const k = Date.parse(g.kickoff);
    return (
      g.state === "in" ||
      (g.state === "pre" && now >= k - 10 * 60e3 && now - k < 5 * 3600e3)
    );
  });
}
