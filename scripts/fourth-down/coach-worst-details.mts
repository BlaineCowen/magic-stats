/**
 * Attach the full graded decision (with its margin of error) to each coach's costliest calls in
 * src/lib/fourth/data/coaches.json, so the coach page can show the same card as the game view.
 * Run after coach_report.py, which rewrites that file without them:
 *   npx tsx scripts/fourth-down/coach-worst-details.mts
 */
import fs from "node:fs";
import path from "node:path";
import type { CoachReport } from "../../src/lib/fourth/coaches";
import { analyzeGame, type GameAnalysis } from "../../src/lib/fourth/games";

const file = path.join(process.cwd(), "src/lib/fourth/data/coaches.json");
const report = JSON.parse(fs.readFileSync(file, "utf8")) as CoachReport;

const games = new Map<string, GameAnalysis>();
const ids = [
  ...new Set(report.coaches.flatMap((c) => c.worst.map((w) => w.gameId))),
];
let done = 0;
for (const id of ids) {
  games.set(id, await analyzeGame(id));
  if (++done % 25 === 0) console.error(`${done}/${ids.length} games`);
}

let attached = 0;
for (const c of report.coaches) {
  for (const w of c.worst) {
    const g = games.get(w.gameId)!;
    const p = g.plays.find(
      (x) => x.posteam === w.team && x.qtr === w.qtr && x.time === w.time,
    );
    if (!p?.decision) continue;
    // the yards-gained distribution isn't shown on this page; leave it out to keep the file small
    const { goGains: _unused, ...decision } = p.decision;
    w.decision = decision;
    attached++;
  }
}
fs.writeFileSync(file, JSON.stringify(report));
console.error(
  `attached ${attached} of ${report.coaches.reduce((a, c) => a + c.worst.length, 0)} decisions`,
);
process.exit(0);
