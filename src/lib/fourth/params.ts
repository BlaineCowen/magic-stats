import type { Roof, Situation } from "./engine";

/** Shared between the calculator's URL and the API: short keys so links stay readable. */
export const DEFAULT_SITUATION: Situation = {
  season: 2025,
  qtr: 4,
  clock: 300,
  scoreDiff: -3,
  ydstogo: 2,
  yardline: 38,
  offTimeouts: 3,
  defTimeouts: 3,
  home: 1,
  spread: 0,
  total: 45,
  roof: "outdoors",
  temp: null,
  wind: null,
  receive2h: false,
};

const KEYS: Record<keyof Situation, string> = {
  season: "season",
  qtr: "q",
  clock: "clock",
  scoreDiff: "score",
  ydstogo: "togo",
  yardline: "yl",
  offTimeouts: "to",
  defTimeouts: "dto",
  home: "home",
  spread: "spread",
  total: "total",
  roof: "roof",
  temp: "temp",
  wind: "wind",
  receive2h: "r2h",
};

function int(
  v: string | null,
  lo: number,
  hi: number,
  name: string,
): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi)
    throw new Error(`${name} must be between ${lo} and ${hi}`);
  return n;
}

export function parseSituation(p: URLSearchParams): Situation {
  const d = DEFAULT_SITUATION;
  const g = (k: keyof Situation) => p.get(KEYS[k]);
  const yardline = int(g("yardline"), 1, 99, "yardline") ?? d.yardline;
  const roof = (g("roof") ?? d.roof) as Roof;
  if (!["outdoors", "dome", "retractable"].includes(roof))
    throw new Error("bad roof");
  return {
    season: int(g("season"), 1999, 2100, "season") ?? d.season,
    qtr: (int(g("qtr"), 1, 4, "quarter") ?? d.qtr) as Situation["qtr"],
    clock: int(g("clock"), 0, 900, "clock") ?? d.clock,
    scoreDiff: int(g("scoreDiff"), -60, 60, "score") ?? d.scoreDiff,
    ydstogo: Math.min(
      yardline,
      int(g("ydstogo"), 1, 99, "yards to go") ?? d.ydstogo,
    ),
    yardline,
    offTimeouts: int(g("offTimeouts"), 0, 3, "timeouts") ?? d.offTimeouts,
    defTimeouts: int(g("defTimeouts"), 0, 3, "timeouts") ?? d.defTimeouts,
    home: (int(g("home"), 0, 1, "home") ?? d.home) as 0 | 1,
    spread: int(g("spread"), -30, 30, "spread") ?? d.spread,
    total: int(g("total"), 25, 70, "total") ?? d.total,
    roof,
    temp: int(g("temp"), -20, 120, "temperature") ?? null,
    wind: int(g("wind"), 0, 50, "wind") ?? null,
    receive2h: g("receive2h") === "1",
  };
}

export function situationQuery(s: Situation): string {
  const p = new URLSearchParams();
  for (const [k, short] of Object.entries(KEYS) as [
    keyof Situation,
    string,
  ][]) {
    const v = s[k];
    if (v == null) continue;
    p.set(short, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return p.toString();
}
