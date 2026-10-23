import { runSafeSelect } from "@/lib/nfl/db";
import {
  decide,
  fgMakeProb,
  goGains,
  type Decision,
  type OptionKey,
  type Roof,
  type Situation,
} from "./engine";
import { actualOf, outcomeOf, type Outcome } from "./outcome";
import { fourthDownInputs } from "./overtime";

/**
 * Live 4th down calls from ESPN's public game feed (the same one the Pick'em page uses).
 * Play states come from ESPN; the betting line and roof come from the nflverse schedule,
 * matched on ESPN's event id, so live calls use the same inputs the model was trained on.
 */

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const TTL_MS = 12_000;

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/** Fetch JSON through a short shared cache, so many viewers make one request to ESPN. */
function cachedJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>;
  const value = fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).then((r) => {
    if (!r.ok) throw new Error(`ESPN ${r.status}`);
    return r.json() as Promise<T>;
  });
  value.catch(() => cache.delete(url));
  cache.set(url, { at: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return value;
}

type EspnTeam = {
  id: string;
  abbreviation: string;
  displayName?: string;
  shortDisplayName?: string;
};
type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team: EspnTeam;
};
type EspnSituation = {
  down?: number;
  distance?: number;
  yardLine?: number;
  possession?: string;
  homeTimeouts?: number;
  awayTimeouts?: number;
  downDistanceText?: string;
  isRedZone?: boolean;
};
type EspnStatus = {
  period?: number;
  displayClock?: string;
  type: { state: "pre" | "in" | "post"; detail: string; shortDetail?: string };
};
type EspnEvent = {
  id: string;
  date: string;
  shortName: string;
  name: string;
  competitions: {
    competitors: EspnCompetitor[];
    status: EspnStatus;
    situation?: EspnSituation;
  }[];
};
type EspnPlay = {
  id: string;
  type?: { text?: string };
  text: string;
  statYardage?: number;
  scoringPlay?: boolean;
  isTurnover?: boolean;
  awayScore: number;
  homeScore: number;
  period: { number: number };
  clock: { displayValue: string };
  start?: {
    down?: number;
    distance?: number;
    yardsToEndzone?: number;
    downDistanceText?: string;
    team?: { id: string };
  };
  end?: {
    down?: number;
    distance?: number;
    yardsToEndzone?: number;
    team?: { id: string };
  };
};
type EspnDrive = {
  team?: { id: string; abbreviation?: string };
  plays: EspnPlay[];
};
type EspnSummary = {
  header: {
    season?: { year: number };
    competitions: {
      competitors: EspnCompetitor[];
      status: EspnStatus;
      situation?: EspnSituation;
    }[];
  };
  drives?: { previous?: EspnDrive[]; current?: EspnDrive };
  pickcenter?: { spread?: number; overUnder?: number }[];
  gameInfo?: {
    venue?: { indoor?: boolean };
    weather?: { temperature?: number };
  };
};

// ESPN codes that differ from nflverse's, plus the league's own codes that ESPN's play text uses ("Timeout #1 by HST")
const TEAM_FIX: Record<string, string> = {
  LAR: "LA",
  WSH: "WAS",
  HST: "HOU",
  BLT: "BAL",
  CLV: "CLE",
  ARZ: "ARI",
  SL: "LA",
};
const team = (abbr: string) => TEAM_FIX[abbr] ?? abbr;

export type LiveGameSummary = {
  eventId: string;
  name: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  start: string;
  /** e.g. "4th & 3 at KC 15", while the game is on */
  downDistance: string | null;
  possession: string | null;
};

export async function liveScoreboard(): Promise<LiveGameSummary[]> {
  const d = await cachedJson<{ events: EspnEvent[] }>(`${ESPN}/scoreboard`);
  return d.events.map((e) => {
    const c = e.competitions[0]!;
    const home = c.competitors.find((x) => x.homeAway === "home")!;
    const away = c.competitors.find((x) => x.homeAway === "away")!;
    const pos = c.situation?.possession;
    return {
      eventId: e.id,
      name: e.name,
      state: c.status.type.state,
      detail: c.status.type.shortDetail ?? c.status.type.detail,
      home: team(home.team.abbreviation),
      away: team(away.team.abbreviation),
      homeScore: Number(home.score ?? 0),
      awayScore: Number(away.score ?? 0),
      start: e.date,
      downDistance: c.situation?.downDistanceText ?? null,
      possession: pos
        ? team(
            c.competitors.find((x) => x.team.id === pos)?.team.abbreviation ??
              "",
          )
        : null,
    };
  });
}

type Schedule = {
  spread: number;
  total: number;
  roof: Roof;
  temp: number | null;
  wind: number | null;
  season: number;
};

async function scheduleFor(eventId: string): Promise<Schedule | null> {
  if (!/^\d+$/.test(eventId)) return null;
  const { rows } = await runSafeSelect(
    `SELECT season, spread_line, total_line, roof, temp, wind FROM games WHERE espn = '${eventId}' LIMIT 1`,
  );
  const r = rows[0];
  if (!r) return null;
  const roof = String(r.roof ?? "");
  return {
    season: Number(r.season),
    spread: Number(r.spread_line ?? 0),
    total: Number(r.total_line ?? 45),
    roof:
      roof === "dome" || roof === "closed"
        ? "dome"
        : roof === "retractable"
          ? "retractable"
          : "outdoors",
    temp: r.temp == null ? null : Number(r.temp),
    wind: r.wind == null ? null : Number(r.wind),
  };
}

const clockSec = (s: string) => {
  const [m, sec] = s.split(":").map(Number);
  return (m ?? 0) * 60 + (sec ?? 0);
};

/**
 * Yards to the end zone from ESPN's own text ("4th & 6 at HOU 42"). ESPN's numeric yardsToEndzone is
 * flipped for the home team in some feeds, but the text is always right.
 */
function yardsToGo(text: string | undefined, posAbbr: string): number | null {
  if (!text) return null;
  if (/ at 50\b/.test(text)) return 50;
  const m = / at ([A-Z]{2,3}) (\d{1,2})\b/.exec(text);
  if (!m) return null;
  const n = Number(m[2]);
  return team(m[1]!) === posAbbr ? 100 - n : n;
}

export type LiveCall = {
  playId: string;
  qtr: number;
  time: string;
  posteam: string;
  defteam: string;
  desc: string;
  actual: OptionKey;
  /** What happened on the play. Missing on calls cached before it existed. */
  outcome?: Outcome;
  cost: number;
  decision: Decision | null;
  ot?: {
    conv: number;
    tdOnPlay: number;
    fgMake: number;
    ydstogo: number;
    yardline: number;
    scoreDiff: number;
  };
};

export type LiveGame = {
  eventId: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  /** the decision the offense faces right now, when the next snap is a 4th down */
  now: {
    posteam: string;
    defteam: string;
    text: string;
    decision: Decision;
  } | null;
  calls: LiveCall[];
  updated: string;
};

type Ctx = {
  sched: Schedule;
  homeId: string;
  abbr: Record<string, string>;
  receive2hTeamId: string | null;
};

function situationFor(
  ctx: Ctx,
  posId: string,
  qtr: number,
  clock: number,
  diff: number,
  down: { distance: number; yardsToEndzone: number },
  timeouts: Record<string, number>,
): Situation {
  const home = posId === ctx.homeId ? 1 : 0;
  const defId = Object.keys(ctx.abbr).find((id) => id !== posId)!;
  return {
    season: ctx.sched.season,
    qtr: Math.min(4, qtr) as Situation["qtr"],
    clock,
    scoreDiff: diff,
    ydstogo: Math.max(1, Math.min(down.distance, down.yardsToEndzone)),
    yardline: Math.max(1, Math.min(99, down.yardsToEndzone)),
    offTimeouts: timeouts[posId] ?? 3,
    defTimeouts: timeouts[defId] ?? 3,
    home: home,
    spread: home ? ctx.sched.spread : -ctx.sched.spread,
    total: ctx.sched.total,
    roof: ctx.sched.roof,
    temp: ctx.sched.temp,
    wind: ctx.sched.wind,
    receive2h: ctx.receive2hTeamId === posId,
  };
}

export async function liveGame(eventId: string): Promise<LiveGame> {
  if (!/^\d+$/.test(eventId)) throw new Error("Bad event id");
  const [s, sched] = await Promise.all([
    cachedJson<EspnSummary>(`${ESPN}/summary?event=${eventId}`),
    scheduleFor(eventId),
  ]);
  const comp = s.header.competitions[0]!;
  const home = comp.competitors.find((c) => c.homeAway === "home")!;
  const away = comp.competitors.find((c) => c.homeAway === "away")!;
  const abbr: Record<string, string> = {
    [home.team.id]: team(home.team.abbreviation),
    [away.team.id]: team(away.team.abbreviation),
  };
  const ctxSched: Schedule = sched ?? {
    season: s.header.season?.year ?? new Date().getFullYear(),
    // ESPN's spread is from the home team's side with favorites negative; nflverse's is the home margin
    spread: -(s.pickcenter?.[0]?.spread ?? 0),
    total: s.pickcenter?.[0]?.overUnder ?? 45,
    roof: s.gameInfo?.venue?.indoor ? "dome" : "outdoors",
    temp: s.gameInfo?.weather?.temperature ?? null,
    wind: null,
  };

  const drives = [
    ...(s.drives?.previous ?? []),
    ...(s.drives?.current ? [s.drives.current] : []),
  ];
  // the team with the first drive received the opening kickoff, so the other team gets the second-half kick
  const firstTeam = drives.find((d) => d.team?.id)?.team?.id ?? null;
  const ctx: Ctx = {
    sched: ctxSched,
    homeId: home.team.id,
    abbr,
    receive2hTeamId: firstTeam
      ? (Object.keys(abbr).find((id) => id !== firstTeam) ?? null)
      : null,
  };

  const timeouts: Record<string, number> = {
    [home.team.id]: 3,
    [away.team.id]: 3,
  };
  let homeScore = 0;
  let awayScore = 0;
  let half = 1;
  const calls: LiveCall[] = [];
  const seen = new Set<string>();

  // the previous entry in the feed, to borrow its clock when it's a stoppage at the same spot
  let prev: EspnPlay | null = null;
  for (const d of drives) {
    for (const p of d.plays) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const before = prev;
      prev = p;
      const qtr = p.period.number;
      const h = qtr <= 2 ? 1 : qtr <= 4 ? 2 : 3;
      if (h !== half) {
        half = h;
        const n = h === 3 ? 2 : 3;
        for (const id of Object.keys(timeouts)) timeouts[id] = n;
      }
      const t = (p.type?.text ?? "").toLowerCase();
      const to = /timeout #\d by (\w+)/i.exec(p.text);
      if (t.includes("timeout") && to) {
        const id = Object.keys(abbr).find(
          (k) => abbr[k] === team(to[1]!.toUpperCase()),
        );
        if (id) timeouts[id] = Math.max(0, (timeouts[id] ?? 3) - 1);
      }
      const st = p.start;
      const actual = actualOf(p);
      const yte = st?.team?.id
        ? (yardsToGo(st.downDistanceText, abbr[st.team.id] ?? "") ??
          st.yardsToEndzone)
        : null;
      if (
        st?.down === 4 &&
        st.team?.id &&
        st.distance != null &&
        yte != null &&
        actual
      ) {
        const posId = st.team.id;
        // ESPN sometimes stamps a play a few seconds after the snap; a stoppage just before it
        // (two-minute warning, timeout) at the same spot has the snap clock
        const sameSpot =
          before?.period.number === qtr &&
          before.start?.downDistanceText === st.downDistanceText &&
          !actualOf(before);
        const clock = Math.max(
          clockSec(p.clock.displayValue),
          sameSpot ? clockSec(before.clock.displayValue) : 0,
        );
        const posScore = posId === home.team.id ? homeScore : awayScore;
        const defScore = posId === home.team.id ? awayScore : homeScore;
        const sit = situationFor(
          ctx,
          posId,
          qtr,
          clock,
          posScore - defScore,
          { distance: st.distance, yardsToEndzone: yte },
          timeouts,
        );
        const base = {
          playId: p.id,
          qtr,
          time: `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`,
          posteam: abbr[posId] ?? "",
          defteam: abbr[Object.keys(abbr).find((id) => id !== posId)!] ?? "",
          desc: p.text,
          actual,
          outcome: outcomeOf(p, actual),
        };
        if (qtr > 4) {
          calls.push({
            ...base,
            cost: 0,
            decision: null,
            ot: {
              ...fourthDownInputs(goGains(sit), sit.ydstogo, sit.yardline),
              fgMake: fgMakeProb(sit),
              ydstogo: sit.ydstogo,
              yardline: sit.yardline,
              scoreDiff: sit.scoreDiff,
            },
          });
        } else {
          const decision = decide(sit);
          const chosen = decision.options.find((o) => o.key === actual);
          const bestWp = Math.max(...decision.options.map((o) => o.wp));
          calls.push({
            ...base,
            decision,
            cost: chosen ? (chosen.wp - bestWp) * 100 : 0,
          });
        }
      }
      homeScore = p.homeScore ?? homeScore;
      awayScore = p.awayScore ?? awayScore;
    }
  }

  // what the offense faces right now, from the live situation
  let now: LiveGame["now"] = null;
  const sitNow = comp.situation;
  const status = comp.status;
  if (
    status.type.state === "in" &&
    sitNow?.down === 4 &&
    sitNow.possession &&
    sitNow.distance != null &&
    sitNow.yardLine != null
  ) {
    const posId = sitNow.possession;
    const qtr = status.period ?? 1;
    // prefer the "4th & 3 at KC 15" text; ESPN's yardLine is measured from the home team's goal
    const yte =
      yardsToGo(sitNow.downDistanceText, abbr[posId] ?? "") ??
      (posId === home.team.id ? 100 - sitNow.yardLine : sitNow.yardLine);
    const posScore =
      posId === home.team.id
        ? Number(home.score ?? 0)
        : Number(away.score ?? 0);
    const defScore =
      posId === home.team.id
        ? Number(away.score ?? 0)
        : Number(home.score ?? 0);
    const liveTimeouts = {
      [home.team.id]: sitNow.homeTimeouts ?? timeouts[home.team.id] ?? 3,
      [away.team.id]: sitNow.awayTimeouts ?? timeouts[away.team.id] ?? 3,
    };
    if (qtr <= 4) {
      const sit = situationFor(
        ctx,
        posId,
        qtr,
        clockSec(status.displayClock ?? "0:00"),
        posScore - defScore,
        { distance: sitNow.distance, yardsToEndzone: yte },
        liveTimeouts,
      );
      now = {
        posteam: abbr[posId] ?? "",
        defteam: abbr[Object.keys(abbr).find((id) => id !== posId)!] ?? "",
        text: sitNow.downDistanceText ?? `4th & ${sitNow.distance}`,
        decision: decide(sit),
      };
    }
  }

  return {
    eventId,
    state: status.type.state,
    detail: status.type.shortDetail ?? status.type.detail,
    home: abbr[home.team.id]!,
    away: abbr[away.team.id]!,
    homeScore: Number(home.score ?? homeScore),
    awayScore: Number(away.score ?? awayScore),
    now,
    calls,
    updated: new Date().toISOString(),
  };
}
