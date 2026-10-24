import {
  getPlayerPage,
  getProjections,
  searchablePlayers,
  type Projection,
} from "@/lib/nfl/fantasy";
import { dataVersion, getDataInfo, runSafeSelect } from "@/lib/sports/db";
import { describeData } from "@/lib/sports/prompt";
import { proveClaim, type ProofResult } from "@/lib/sports/prove/engine";
import { ordinal } from "@/lib/sports/prove/kit";
import { findPlayer, type Candidate } from "@/lib/sports/prove/parse";
import type { Tier } from "./keys";

/**
 * What the connector's tools return. `text` is the whole answer for hosts that
 * only show text (and for the model to read); `data` is the same answer as
 * structured content for the result card (widget.ts).
 */
export type ToolOut = { text: string; data: CardData };

export type CardColumn = { key: string; label: string };
export type CardData =
  | {
      view: "table";
      title: string;
      note?: string;
      columns: CardColumn[];
      rows: Record<string, string | number | boolean | null>[];
    }
  | { view: "case"; proof: ProofResult }
  | { view: "text"; title: string };

export const PRO_NOTE =
  "Projections, start/sit and trade checks are part of Magic Stats Pro.";

/** Short, readable numbers: 0.2345 -> 0.235, 3.618 -> 3.62, 12.345 -> 12.3, 1234.5 -> 1235. */
export function fmt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v !== "number") return JSON.stringify(v);
  if (Number.isInteger(v)) return String(v);
  const a = Math.abs(v);
  const digits = a < 1 ? 3 : a < 10 ? 2 : a < 100 ? 1 : 0;
  return String(Number(v.toFixed(digits)));
}

const cell = (v: unknown) => fmt(v).replaceAll("|", "\\|").replace(/\n/g, " ");

/** Markdown table of the first `max` rows. */
export function mdTable(
  columns: CardColumn[],
  rows: Record<string, unknown>[],
  max = 50,
): string {
  if (!rows.length) return "(no rows)";
  columns = columns.filter((c) => rows.some((r) => r[c.key] != null));
  const head = `| ${columns.map((c) => cell(c.label)).join(" | ")} |`;
  const rule = `|${columns.map(() => " --- ").join("|")}|`;
  const body = rows
    .slice(0, max)
    .map((r) => `| ${columns.map((c) => cell(r[c.key])).join(" | ")} |`);
  const more =
    rows.length > max ? `\n(${rows.length - max} more rows not shown)` : "";
  return [head, rule, ...body].join("\n") + more;
}

const pct = (v: number | null) =>
  v == null ? null : Math.round(v * 1000) / 10;
const round1 = (v: number | null) =>
  v == null ? null : Math.round(v * 10) / 10;
const game = (p: Pick<Projection, "home" | "opp">) =>
  `${p.home ? "vs" : "@"} ${p.opp}`;

export async function dataGuide(): Promise<ToolOut> {
  const text = await describeData("nfl");
  return { text, data: { view: "text", title: "Magic Stats NFL data" } };
}

/** One SELECT against the licensed database. Errors propagate with DuckDB's message. */
export async function runSql(sql: string): Promise<ToolOut> {
  const r = await runSafeSelect("nfl", sql, { maxRows: 200, licensed: true });
  const columns = r.columns.map((c) => ({ key: c, label: c }));
  const note = r.truncated ? "Stopped at 200 rows." : undefined;
  return {
    text: `${mdTable(columns, r.rows)}${note ? `\n${note}` : ""}`,
    data: { view: "table", title: "Query result", note, columns, rows: r.rows },
  };
}

let roster: { version: string; cands: Candidate[] } | null = null;

/** Match a name ("Puka", "JSN", "Josh Allen") to a skill player from the last two seasons. */
export async function resolvePlayer(name: string): Promise<Candidate | null> {
  const version = dataVersion("nfl");
  if (roster?.version !== version) {
    const list = await searchablePlayers();
    // Listed best season first, so among same-named players the bigger name wins.
    const cands = list.map((p, i) => ({
      pid: p.id,
      name: p.name,
      n: list.length - i,
      team: false,
      roles: {},
    }));
    roster = { version, cands };
  }
  return findPlayer(name, roster.cands);
}

const notFound = (name: string): ToolOut => ({
  text: `No QB, RB, WR or TE from the last two seasons matches "${name}". Try the full name, or use run_sql on the players table for anyone else.`,
  data: { view: "text", title: "Player not found" },
});

const projectionsById = async () =>
  new Map((await getProjections()).map((p) => [p.player_id, p]));

export async function player(
  name: string,
  tier: Tier,
  season?: number,
): Promise<ToolOut> {
  const hit = await resolvePlayer(name);
  if (!hit) return notFound(name);
  const page = await getPlayerPage(hit.pid, season);
  if (!page) return notFound(name);
  const w = page.weeks;
  const sum = (f: (x: (typeof w)[number]) => number | null) =>
    w.reduce((a, x) => a + (f(x) ?? 0), 0);
  const routes = sum((x) => x.routes);
  const recYards = sum((x) => x.rec_yards);
  const snaps = w.filter((x) => x.snap_pct != null);
  const total = {
    games: w.length,
    ppr: round1(sum((x) => x.ppr)),
    ppr_pg: w.length ? round1(sum((x) => x.ppr) / w.length) : null,
    targets: sum((x) => x.targets),
    receptions: sum((x) => x.receptions),
    rec_yards: recYards,
    carries: sum((x) => x.carries),
    rush_yards: sum((x) => x.rush_yards),
    pass_yards: sum((x) => x.pass_yards),
    tds: sum((x) => x.tds),
    snap_pct: snaps.length
      ? pct(snaps.reduce((a, x) => a + x.snap_pct!, 0) / snaps.length)
      : null,
    routes: Math.round(routes) || null,
    // Same 40-route floor as the site, so a handful of snaps can't top the list.
    yprr: routes >= 40 ? Math.round((recYards / routes) * 100) / 100 : null,
    tprr:
      routes >= 40
        ? Math.round((sum((x) => x.targets) / routes) * 1000) / 1000
        : null,
  };
  const estimated = w.some((x) => x.routes_est);

  const lines = [
    `${page.name}, ${page.position}${page.team ? `, ${page.team_name ?? page.team}` : ""}${page.age ? `, age ${Math.floor(page.age)}` : ""}`,
    `${page.season} regular season: ${total.games} games, ${total.ppr} PPR points (${total.ppr_pg} a game)` +
      (page.rank?.ppr
        ? `, ${ordinal(page.rank.ppr)} of ${page.rank.of} ${page.position}s in PPR per game`
        : "") +
      ".",
  ];
  if (page.position !== "QB" && total.yprr != null) {
    lines.push(
      `${total.yprr} yards and ${total.tprr} targets per route run over ${total.routes} routes${estimated ? " (routes estimated from snaps until the real counts are published)" : ""}.`,
    );
  }
  const columns: CardColumn[] = [
    { key: "week", label: "Week" },
    { key: "opponent", label: "Opp" },
    { key: "ppr", label: "PPR" },
    { key: "snap_pct", label: "Snap %" },
    ...(page.position === "QB"
      ? [
          { key: "pass_yards", label: "Pass yds" },
          { key: "rush_yards", label: "Rush yds" },
        ]
      : [
          { key: "routes", label: "Routes" },
          { key: "targets", label: "Tgts" },
          { key: "receptions", label: "Rec" },
          { key: "rec_yards", label: "Rec yds" },
          { key: "carries", label: "Car" },
          { key: "rush_yards", label: "Rush yds" },
        ]),
    { key: "tds", label: "TD" },
  ];
  const rows = w.map((x) => ({
    ...x,
    snap_pct: pct(x.snap_pct),
    routes: x.routes == null ? null : Math.round(x.routes),
  }));
  lines.push("", "Game log:", mdTable(columns, rows));

  const proj = page.projection;
  const current = page.season === (await getDataInfo("nfl")).maxSeason;
  if (tier === "pro" && proj && current) {
    lines.push("", ...projectionLines(proj));
  } else if (tier !== "pro" && proj && current) {
    lines.push("", PRO_NOTE);
  }
  return {
    text: lines.join("\n"),
    data: {
      view: "table",
      title: `${page.name} ${page.season} game log`,
      note: lines.slice(0, 3).join(" "),
      columns,
      rows,
    },
  };
}

function projectionLines(p: Projection): string[] {
  const out = [
    p.out_next
      ? `Week ${p.week} ${game(p)}: listed out or doubtful, no projection.`
      : `Week ${p.week} ${game(p)} projection: ${fmt(p.proj)} PPR (floor ${fmt(p.floor)}, ceiling ${fmt(p.ceiling)}).`,
  ];
  if (p.breakout_prob != null)
    out.push(
      `Breakout chance (averages ${BREAKOUT_BAR[p.position] ?? "starter"} PPR over his next 4 games): ${Math.round(p.breakout_prob * 100)}%.`,
    );
  if (p.why.length)
    out.push(
      `Biggest reasons: ${p.why
        .slice(0, 4)
        .map(([label, pts]) => `${label} (${pts > 0 ? "+" : ""}${fmt(pts)})`)
        .join("; ")}.`,
    );
  if (p.ros_proj != null)
    out.push(
      `Rest of season: ${fmt(p.ros_proj)} PPR over ${p.ros_games} games (${fmt(p.ros_ppg)} a game).`,
    );
  return out;
}

/** Starter-level PPR per game, the breakout bar in scripts/projections/train.py. */
const BREAKOUT_BAR: Record<string, number> = { QB: 20, RB: 15, WR: 15, TE: 11 };
const BREAKOUT_NOTE =
  "Breakout % = chance a player not yet at starter level averages it (QB 20, RB and WR 15, TE 11 PPR) over his next 4 games.";

export const LEADER_STATS = {
  ppr_pg: "PPR points per game",
  xfp_pg: "Expected PPR points per game (from his usage)",
  luck_pg: "PPR points over expected per game",
  tgt_share: "Target share",
  car_share: "Carry share",
  snap_pct: "Snap share",
  routes_pg: "Routes run per game",
  yprr: "Yards per route run",
  tprr: "Targets per route run",
  separation: "Average separation at the catch point (yards)",
  yac_oe: "Yards after catch over expected",
  ryoe_att: "Rushing yards over expected per carry",
} as const;
export type LeaderStat = keyof typeof LEADER_STATS;
const SHARES = new Set<LeaderStat>(["tgt_share", "car_share", "snap_pct"]);

/** This season's usage leaders among skill players, from the fantasy model's inputs. */
export async function leaderboard({
  stat,
  position,
  min_games = 3,
  limit = 20,
  lowest = false,
}: {
  stat: LeaderStat;
  position?: "QB" | "RB" | "WR" | "TE";
  min_games?: number;
  limit?: number;
  lowest?: boolean;
}): Promise<ToolOut> {
  const info = await getDataInfo("nfl");
  const all = await getProjections();
  const rows = all
    .filter(
      (p) =>
        p[stat] != null &&
        p.games >= min_games &&
        (!position || p.position === position),
    )
    .sort((a, b) => (lowest ? 1 : -1) * (a[stat]! - b[stat]!))
    .slice(0, Math.min(limit, 50))
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      position: p.position,
      team: p.team,
      games: p.games,
      value: SHARES.has(stat) ? pct(p[stat]) : p[stat]!,
    }));
  const label = LEADER_STATS[stat];
  const title = `${lowest ? "Lowest" : "Highest"} ${label.toLowerCase()}${SHARES.has(stat) ? " (%)" : ""}, ${info.maxSeason}${position ? ` ${position}s` : ""}`;
  const columns: CardColumn[] = [
    { key: "rank", label: "#" },
    { key: "name", label: "Player" },
    { key: "position", label: "Pos" },
    { key: "team", label: "Team" },
    { key: "games", label: "G" },
    { key: "value", label },
  ];
  const note = `Regular season through week ${info.maxWeek}, minimum ${min_games} games.`;
  return {
    text: `${title}\n${note}\n\n${mdTable(columns, rows)}`,
    data: { view: "table", title, note, columns, rows },
  };
}

/** The proof engine behind "make the case for X" on the Ask page. */
export async function makeTheCase({
  subject,
  season,
  against = false,
}: {
  subject: string;
  season?: number;
  against?: boolean;
}): Promise<ToolOut> {
  const q = `${against ? `case against ${subject}` : `make the case for ${subject}`}${season ? ` in ${season}` : ""}`;
  const proof = await proveClaim("nfl", q);
  if (!proof) {
    return {
      text: `Couldn't find a player or team called "${subject}" in the play-by-play data.`,
      data: { view: "text", title: "Not found" },
    };
  }
  const head = `The case ${proof.worst ? "against" : "for"} ${proof.player}${proof.team && !proof.isTeam ? ` (${proof.team})` : ""}, ${proof.scope}.${proof.note ? ` ${proof.note}` : ""}`;
  const body = proof.findings.map((f) => {
    const place = proof.worst
      ? `${f.rank === 1 ? "last" : `${ordinal(f.rank)} from the bottom`}`
      : ordinal(f.rank);
    const me = f.rows.find((r) => r.target);
    const others = f.rows
      .filter((r) => !r.target)
      .slice(0, 3)
      .map((r) => `${r.player} ${r.value}`)
      .join(", ");
    return `- ${f.title}: ${place}${f.tied ? " (tied)" : ""} of ${f.pool} ${f.noun}${me ? `, ${me.value} on ${me.sample} ${f.sampleLabel}` : ""}. Next: ${others}.`;
  });
  return {
    text: [
      head,
      "",
      ...(body.length ? body : ["Nothing where he ranks near the top."]),
    ].join("\n"),
    data: { view: "case", proof },
  };
}

const SORTS = {
  proj: "Projection",
  ceiling: "Ceiling",
  floor: "Floor",
  breakout_prob: "Breakout chance",
  ros_proj: "Rest of season",
} as const;
export type ProjectionSort = keyof typeof SORTS;

const projColumns: CardColumn[] = [
  { key: "name", label: "Player" },
  { key: "position", label: "Pos" },
  { key: "game", label: "Game" },
  { key: "proj", label: "Proj" },
  { key: "floor", label: "Floor" },
  { key: "ceiling", label: "Ceiling" },
  { key: "breakout", label: "Breakout %" },
  { key: "ros_proj", label: "Rest of season" },
];
const projRow = (p: Projection) => ({
  name: p.name,
  position: p.position,
  team: p.team,
  game: game(p),
  proj: round1(p.proj),
  floor: round1(p.floor),
  ceiling: round1(p.ceiling),
  breakout: p.breakout_prob == null ? null : Math.round(p.breakout_prob * 100),
  ros_proj: round1(p.ros_proj),
});

/** Pro: next-game projections, best first. */
export async function projections({
  position,
  sort = "proj",
  limit = 25,
}: {
  position?: "QB" | "RB" | "WR" | "TE";
  sort?: ProjectionSort;
  limit?: number;
}): Promise<ToolOut> {
  const all = (await getProjections()).filter(
    (p) => !p.out_next && (!position || p.position === position),
  );
  const rows = all
    .filter((p) => p[sort] != null)
    .sort((a, b) => b[sort]! - a[sort]!)
    .slice(0, Math.min(limit, 100))
    .map(projRow);
  const week = all[0]?.week;
  const title = `Week ${week ?? "?"} PPR projections${position ? `, ${position}s` : ""}, by ${SORTS[sort].toLowerCase()}`;
  const note = `Floor and ceiling are the 10th and 90th percentile outcomes. ${BREAKOUT_NOTE}`;
  return {
    text: `${title}\n${note}\n\n${mdTable(projColumns, rows)}`,
    data: { view: "table", title, note, columns: projColumns, rows },
  };
}

async function resolveMany(names: string[]) {
  const byId = await projectionsById();
  const found: Projection[] = [];
  const missing: string[] = [];
  for (const n of names) {
    const hit = await resolvePlayer(n);
    const p = hit ? byId.get(hit.pid) : undefined;
    if (p) found.push(p);
    else missing.push(n);
  }
  return { found, missing };
}

const missingLine = (missing: string[]) =>
  missing.length
    ? `No projection for: ${missing.join(", ")} (not matched, or not a QB/RB/WR/TE with a game this week).`
    : "";

/** Pro: who to start among a few players, by next-game projection. */
export async function startSit(names: string[]): Promise<ToolOut> {
  const { found, missing } = await resolveMany(names);
  const ranked = found
    .filter((p) => !p.out_next)
    .sort((a, b) => b.proj - a.proj);
  const out = found.filter((p) => p.out_next);
  const lines: string[] = [];
  const best = ranked[0];
  if (best) {
    lines.push(
      `Start ${best.name} (${fmt(best.proj)} projected, ${game(best)}).`,
    );
    const ceil = [...ranked].sort((a, b) => b.ceiling - a.ceiling)[0]!;
    const floor = [...ranked].sort((a, b) => b.floor - a.floor)[0]!;
    if (ceil !== best)
      lines.push(
        `Chasing a big week? ${ceil.name} has the highest ceiling (${fmt(ceil.ceiling)}).`,
      );
    if (floor !== best)
      lines.push(
        `Need a safe week? ${floor.name} has the highest floor (${fmt(floor.floor)}).`,
      );
  }
  for (const p of out) lines.push(`${p.name} is listed out or doubtful.`);
  const miss = missingLine(missing);
  if (miss) lines.push(miss);
  const rows = ranked.map(projRow);
  return {
    text: `${lines.join("\n")}\n\n${mdTable(projColumns, rows)}`,
    data: {
      view: "table",
      title: "Start or sit",
      note: lines.join(" "),
      columns: projColumns,
      rows,
    },
  };
}

/** Pro: rest-of-season PPR on each side of a trade. */
export async function tradeCheck(
  give: string[],
  get: string[],
): Promise<ToolOut> {
  const [g, r] = await Promise.all([resolveMany(give), resolveMany(get)]);
  const side = (ps: Projection[]) =>
    ps.reduce((a, p) => a + (p.ros_proj ?? 0), 0);
  const out = side(g.found);
  const inn = side(r.found);
  const diff = inn - out;
  const verdict =
    Math.abs(diff) < 5
      ? `Close to even: ${fmt(inn)} rest-of-season PPR coming in, ${fmt(out)} going out.`
      : `You ${diff > 0 ? "gain" : "lose"} about ${fmt(Math.abs(diff))} rest-of-season PPR points (${fmt(inn)} in, ${fmt(out)} out).`;
  const columns: CardColumn[] = [
    { key: "side", label: "" },
    { key: "name", label: "Player" },
    { key: "position", label: "Pos" },
    { key: "ros_proj", label: "Rest of season" },
    { key: "ros_games", label: "Games" },
    { key: "ros_ppg", label: "Per game" },
  ];
  const rows = [
    ...g.found.map((p) => ({ side: "Give", p })),
    ...r.found.map((p) => ({ side: "Get", p })),
  ].map(({ side, p }) => ({
    side,
    name: p.name,
    position: p.position,
    ros_proj: round1(p.ros_proj),
    ros_games: p.ros_games,
    ros_ppg: round1(p.ros_ppg),
  }));
  const nIn = r.found.length;
  const nOut = g.found.length;
  // Totals always favor the side with more players; flag it.
  const caveat =
    (nIn !== nOut
      ? `You ${nIn > nOut ? "get" : "give"} ${Math.max(nIn, nOut)} players for ${Math.min(nIn, nOut)}, so the bigger side's total only counts if those players would all start for you. `
      : "") +
    "Points only: this doesn't know your roster, your league's scoring or who you'd start.";
  const miss = missingLine([...g.missing, ...r.missing]);
  return {
    text: [verdict, caveat, miss, "", mdTable(columns, rows)]
      .filter((l, i) => l || i === 3)
      .join("\n"),
    data: {
      view: "table",
      title: "Trade check",
      note: `${verdict} ${caveat}`,
      columns,
      rows,
    },
  };
}
