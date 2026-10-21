/**
 * Run our engine on every 4th down nfl4th has precomputed and report how often the two agree.
 *   npx tsx scripts/fourth-down/compare-nfl4th.mts > scripts/fourth-down/work/compare.json
 */
import { analyzeGame } from "../../src/lib/fourth/games";
import { loadJson } from "../../src/lib/fourth/xgb";

const nfl4th =
  loadJson<Record<string, Record<string, (number | null)[]>>>("nfl4th.json");
const keys = ["go", "fg", "punt"] as const;
let n = 0,
  agree = 0;
const bySeason: Record<
  string,
  { n: number; agree: number; goUs: number; goThem: number }
> = {};
const disagreements: unknown[] = [];

for (const gameId of Object.keys(nfl4th).sort()) {
  let g;
  try {
    g = await analyzeGame(gameId);
  } catch {
    continue;
  }
  for (const p of g.plays) {
    const theirs = nfl4th[gameId]![String(p.playId)];
    if (!p.decision || !theirs) continue;
    // compare only the options both models offered
    const ours = Object.fromEntries(
      p.decision.options.map((o) => [o.key, o.wp]),
    );
    const both = keys.filter((k, i) => ours[k] != null && theirs[i] != null);
    if (both.length < 2) continue;
    const bestUs = both.reduce((a, k) => (ours[k]! > ours[a]! ? k : a));
    const bestThem = both.reduce((a, k) =>
      theirs[keys.indexOf(k)]! > theirs[keys.indexOf(a)]! ? k : a,
    );
    const s = (bySeason[g.season] ??= { n: 0, agree: 0, goUs: 0, goThem: 0 });
    n++;
    s.n++;
    if (bestUs === bestThem) {
      agree++;
      s.agree++;
    }
    if (bestUs === "go") s.goUs++;
    if (bestThem === "go") s.goThem++;
    if (bestUs !== bestThem) {
      const gapUs = (ours[bestUs]! - ours[bestThem]!) * 100;
      const gapThem =
        (theirs[keys.indexOf(bestThem)]! - theirs[keys.indexOf(bestUs)]!) * 100;
      disagreements.push({
        gameId,
        playId: p.playId,
        us: bestUs,
        them: bestThem,
        gapUs,
        gapThem,
        sit: p.decision.situation,
      });
    }
  }
}
const big = (disagreements as { gapUs: number; gapThem: number }[]).filter(
  (d) => d.gapUs > 2 && d.gapThem > 2,
);
console.log(
  JSON.stringify(
    {
      n,
      agree,
      rate: agree / n,
      bySeason,
      bothConfident: big.length,
      sample: big.slice(0, 40),
    },
    null,
    1,
  ),
);
process.exit(0);
