import { dataVersion, runSafeSelect } from "@/lib/nfl/db";
import { loadJson } from "./xgb";
import { fourthDownInputs } from "./overtime";
import {
  decide,
  fgMakeProb,
  goGains,
  type Decision,
  type OptionKey,
  type Roof,
  type Situation,
} from "./engine";

export type FourthDownPlay = {
  playId: number;
  /** score before the snap */
  posteamScore: number;
  defteamScore: number;
  /** seconds since kickoff, continuing through overtime */
  elapsed: number;
  qtr: number;
  time: string;
  posteam: string;
  defteam: string;
  desc: string;
  actual: OptionKey;
  /** did the actual choice work? (converted / FG good / null for punts) */
  worked: boolean | null;
  /** WP the actual choice was worth minus the best choice, in points (0 when they matched) */
  cost: number;
  decision: Decision | null;
  /** why there is no decision (overtime, kneel, ...) */
  skipped?: string;
  /** overtime 4th downs: inputs for the possession model in overtime.ts */
  ot?: {
    conv: number;
    tdOnPlay: number;
    tdAfter: number;
    fgMake: number;
    ydstogo: number;
    yardline: number;
    scoreDiff: number;
  };
};

export type GameTimelinePoint = { elapsed: number; homeWp: number };

export type TeamInfo = {
  abbr: string;
  name: string;
  nick: string;
  color: string;
  color2: string;
};

export type GameAnalysis = {
  gameId: string;
  /** e.g. "2024-11-10" */
  date: string | null;
  teams: Record<"home" | "away", TeamInfo>;
  season: number;
  week: number;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  plays: FourthDownPlay[];
  timeline: GameTimelinePoint[];
  /** nfl4th's own WPs for go / FG / punt by play id (2014+), for comparison */
  nfl4th: Record<
    string,
    { go: number; fg: number | null; punt: number | null }
  >;
};

const GAME_ID = /^\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}$/;

const roofOf = (r: string | null): Roof =>
  r === "dome" || r === "closed"
    ? "dome"
    : r === "retractable"
      ? "retractable"
      : "outdoors";

const num = (v: unknown) => (v == null ? null : Number(v));

function actualOf(playType: string): OptionKey | null {
  if (playType === "run" || playType === "pass") return "go";
  if (playType === "field_goal") return "fg";
  if (playType === "punt") return "punt";
  return null;
}

// keyed by the dataset version, so a refresh that adds plays to a live game is picked up
const analysisCache = new Map<string, Promise<GameAnalysis>>();
const CACHE_MAX = 64;

export function analyzeGame(gameId: string): Promise<GameAnalysis> {
  if (!GAME_ID.test(gameId)) return Promise.reject(new Error("Bad game id"));
  const key = `${dataVersion()}:${gameId}`;
  let hit = analysisCache.get(key);
  if (!hit) {
    hit = buildAnalysis(gameId);
    hit.catch(() => analysisCache.delete(key));
    analysisCache.set(key, hit);
    if (analysisCache.size > CACHE_MAX)
      analysisCache.delete(analysisCache.keys().next().value!);
  }
  return hit;
}

async function buildAnalysis(gameId: string): Promise<GameAnalysis> {
  const { rows } = await runSafeSelect(`
    SELECT play_id, season, week, qtr, time, quarter_seconds_remaining, game_seconds_remaining,
      posteam, defteam, home_team, away_team, home_score, away_score, down, ydstogo, yardline_100,
      score_differential, posteam_timeouts_remaining, defteam_timeouts_remaining, spread_line,
      total_line, roof, temp, wind, home_opening_kickoff, play_type, "desc",
      fourth_down_converted, field_goal_result, touchdown, td_team, vegas_home_wp, season_type,
      posteam_score, defteam_score, game_date
    FROM pbp WHERE season = ${Number(gameId.slice(0, 4))} AND game_id = '${gameId}' ORDER BY play_id`);
  if (!rows.length) throw new Error(`No plays for ${gameId}`);
  const first = rows[0]!;
  const plays: FourthDownPlay[] = [];
  const timeline: GameTimelinePoint[] = [];

  // playoff overtime periods are 15 minutes; regular season 10 since 2017
  const otLen =
    first.season_type === "POST" || Number(first.season) < 2017 ? 900 : 600;
  const elapsedOf = (r: (typeof rows)[number]) => {
    const q = Number(r.qtr);
    const left = Number(r.quarter_seconds_remaining ?? 0);
    return q <= 4
      ? (q - 1) * 900 + (900 - left)
      : 3600 + (q - 5) * otLen + (otLen - left);
  };
  for (const r of rows) {
    const hwp = num(r.vegas_home_wp);
    if (
      r.qtr != null &&
      r.quarter_seconds_remaining != null &&
      hwp != null &&
      r.posteam
    ) {
      timeline.push({ elapsed: elapsedOf(r), homeWp: hwp });
    }
    if (Number(r.down) !== 4) continue;
    const actual = actualOf(String(r.play_type));
    if (!actual) continue;

    const posteam = String(r.posteam);
    const home = posteam === r.home_team ? 1 : 0;
    const qtr = Number(r.qtr);
    const worked =
      actual === "go"
        ? Number(r.fourth_down_converted) === 1 ||
          (Number(r.touchdown) === 1 && r.td_team === posteam)
        : actual === "fg"
          ? r.field_goal_result === "made"
          : null;
    const base = {
      playId: Number(r.play_id),
      posteamScore: Number(r.posteam_score ?? 0),
      defteamScore: Number(r.defteam_score ?? 0),
      elapsed: elapsedOf(r),
      qtr,
      time: String(r.time ?? ""),
      posteam,
      defteam: String(r.defteam),
      desc: String(r.desc ?? ""),
      actual,
      worked,
    };
    const spreadLine = Number(r.spread_line ?? 0);
    const hok = Number(r.home_opening_kickoff);
    const situation: Situation = {
      season: Number(r.season),
      qtr: Math.min(4, qtr) as Situation["qtr"],
      clock: Number(r.quarter_seconds_remaining),
      scoreDiff: Number(r.score_differential),
      ydstogo: Number(r.ydstogo),
      yardline: Number(r.yardline_100),
      offTimeouts: Number(r.posteam_timeouts_remaining ?? 3),
      defTimeouts: Number(r.defteam_timeouts_remaining ?? 3),
      home,
      spread: home ? spreadLine : -spreadLine,
      total: Number(r.total_line ?? 45),
      roof: roofOf(r.roof as string | null),
      temp: num(r.temp),
      wind: num(r.wind),
      // home_opening_kickoff = 1: home received the opening kick, so the away team gets the 2H kick
      receive2h: home ? hok === 0 : hok === 1,
    };
    if (qtr > 4) {
      const ot = {
        ...fourthDownInputs(
          goGains(situation),
          situation.ydstogo,
          situation.yardline,
        ),
        fgMake: fgMakeProb(situation),
        ydstogo: situation.ydstogo,
        yardline: situation.yardline,
        scoreDiff: situation.scoreDiff,
      };
      plays.push({ ...base, cost: 0, decision: null, skipped: "overtime", ot });
      continue;
    }
    const decision = decide(situation);
    const chosen = decision.options.find((o) => o.key === actual);
    const bestWp = Math.max(...decision.options.map((o) => o.wp));
    plays.push({
      ...base,
      decision,
      cost: chosen ? (chosen.wp - bestWp) * 100 : 0,
    });
  }

  const home = String(first.home_team);
  const away = String(first.away_team);
  const { rows: teamRows } = await runSafeSelect(
    `SELECT team_abbr, team_name, team_nick, team_color, team_color2 FROM teams WHERE team_abbr IN ('${home}', '${away}')`,
  );
  const teamInfo = (abbr: string): TeamInfo => {
    const t = teamRows.find((r) => r.team_abbr === abbr);
    return {
      abbr,
      name: String(t?.team_name ?? abbr),
      nick: String(t?.team_nick ?? abbr),
      color: String(t?.team_color ?? "#334155"),
      color2: String(t?.team_color2 ?? "#94a3b8"),
    };
  };

  return {
    gameId,
    date: first.game_date ? String(first.game_date).slice(0, 10) : null,
    teams: { home: teamInfo(home), away: teamInfo(away) },
    season: Number(first.season),
    week: Number(first.week),
    home: String(first.home_team),
    away: String(first.away_team),
    homeScore: Number(first.home_score),
    awayScore: Number(first.away_score),
    plays,
    timeline,
    nfl4th: Object.fromEntries(
      Object.entries(
        loadJson<Record<string, Record<string, (number | null)[]>>>(
          "nfl4th.json",
        )[gameId] ?? {},
      ).map(([id, [go, fg, punt]]) => [
        id,
        { go: go ?? 0, fg: fg ?? null, punt: punt ?? null },
      ]),
    ),
  };
}

export type GameListItem = {
  gameId: string;
  week: number;
  home: string;
  away: string;
  label: string;
};

export async function listGames(season: number): Promise<GameListItem[]> {
  if (!Number.isInteger(season) || season < 1999 || season > 2100)
    throw new Error("Bad season");
  const { rows } = await runSafeSelect(`
    SELECT game_id, any_value(week) AS week, any_value(home_team) AS home, any_value(away_team) AS away,
      any_value(home_score) AS hs, any_value(away_score) AS as_
    FROM pbp WHERE season = ${season} GROUP BY game_id ORDER BY week, game_id`);
  return rows.map((r) => ({
    gameId: String(r.game_id),
    week: Number(r.week),
    home: String(r.home),
    away: String(r.away),
    label: `${r.away} ${r.as_ ?? ""} @ ${r.home} ${r.hs ?? ""}`,
  }));
}
