/**
 * Grade every 4th down from FROM_SEASON on, tagged with the offense's head coach.
 *   npx tsx scripts/fourth-down/coach-decisions.mts 2023 > scripts/fourth-down/work/coach-decisions.jsonl
 *   (resume: pass the earlier file as a second argument and append the output to it)
 * One JSON line per graded play: our cost (WP given up vs. the best choice, points) and nfl4th's.
 */
import fs from "node:fs";
import { runSafeSelect } from "../../src/lib/nfl/db";
import { analyzeGame } from "../../src/lib/fourth/games";

const from = Number(process.argv[2] ?? 2023);
// optional: an earlier output file whose games are skipped (to resume)
const skip = new Set<string>(
  process.argv[3]
    ? fs
        .readFileSync(process.argv[3], "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => (JSON.parse(l) as { gameId: string }).gameId)
    : [],
);
const { rows: seasons } = await runSafeSelect(
  `SELECT DISTINCT season FROM pbp WHERE season >= ${from} ORDER BY season`,
);
const games = [];
// runSafeSelect caps results at 500 rows, so list games one season at a time
for (const { season } of seasons) {
  const { rows, truncated } = await runSafeSelect(`
    SELECT game_id, any_value(season) AS season, any_value(week) AS week, any_value(season_type) AS season_type,
      any_value(home_team) AS home, any_value(away_team) AS away,
      any_value(home_coach) AS home_coach, any_value(away_coach) AS away_coach
    FROM pbp WHERE season = ${Number(season)} GROUP BY game_id ORDER BY game_id`);
  if (truncated) throw new Error(`season ${season}: game list truncated`);
  games.push(...rows.filter((g) => !skip.has(String(g.game_id))));
}
console.error(`${games.length} games to grade`);

const keys = ["go", "fg", "punt"] as const;
let done = 0;
for (const g of games) {
  const gameId = String(g.game_id);
  let a;
  try {
    a = await analyzeGame(gameId);
  } catch (e) {
    console.error(gameId, (e as Error).message);
    continue;
  }
  for (const p of a.plays) {
    if (!p.decision) continue;
    const d = p.decision;
    const wp = Object.fromEntries(d.options.map((o) => [o.key, o.wp]));
    const n4 = a.nfl4th[String(p.playId)];
    let n4Cost: number | null = null;
    let n4Best: string | null = null;
    if (n4) {
      const vals = { go: n4.go, fg: n4.fg, punt: n4.punt } as Record<
        string,
        number | null
      >;
      const avail = keys.filter((k) => vals[k] != null);
      if (avail.includes(p.actual) && avail.length > 1) {
        n4Best = avail.reduce((b, k) => (vals[k]! > vals[b]! ? k : b));
        n4Cost = (vals[p.actual]! - vals[n4Best]!) * 100;
      }
    }
    const s = d.situation;
    console.log(
      JSON.stringify({
        gameId,
        season: Number(g.season),
        week: Number(g.week),
        post: g.season_type === "POST",
        team: p.posteam,
        opp: p.defteam,
        coach: p.posteam === g.home ? g.home_coach : g.away_coach,
        playId: p.playId,
        qtr: p.qtr,
        time: p.time,
        ydstogo: s.ydstogo,
        yardline: s.yardline,
        scoreDiff: s.scoreDiff,
        actual: p.actual,
        worked: p.worked,
        best: d.best,
        gap: d.gap,
        cost: p.cost,
        wpBest: Math.max(...Object.values(wp)),
        goWp: wp.go ?? null,
        fgWp: wp.fg ?? null,
        puntWp: wp.punt ?? null,
        conv: d.options.find((o) => o.key === "go")?.successProb ?? null,
        breakeven: d.breakeven,
        n4Best,
        n4Cost,
        desc: p.desc,
      }),
    );
  }
  if (++done % 100 === 0) console.error(`${done}/${games.length} games`);
}
process.exit(0);
