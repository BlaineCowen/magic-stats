import type { DataInfo } from "../db";
import type { Sport } from "../types";
import type { Scope } from "./kit";

/** Questions asking for ammunition rather than a single answer. */
const PROVE =
  /\b(prove[sn]?|proving|proof|case for|make (?:a|the|my) case|argue|argument|convince|evidence|cherry[- ]?pick\w*|hot take|silly stats?|espn stats?|what (?:does|did) .+ lead|(?:is|was|are|were) (?:the |a )?(?:best|greatest|goat|top|elite|#1|number one|better))\b/i;

// "Why are the Texans so good?"
const WHY_GOOD =
  /\bwhy (?:is|are|was|were) .+ (?:so )?(?:good|great|elite|dominant|the best|better|the goat|goated|unbeatable|undefeated)\b/i;

const BAD =
  "worst|worse|bad|trash|garbage|terrible|awful|horrible|overrated|washed|frauds?|sucks?|struggl\\w*";

// "Why is Dak Prescott the worst QB?", "why do the Jets suck"
const WHY_BAD = new RegExp(
  `\\bwhy (?:is|are|was|were|does|do) .+\\b(?:${BAD})\\b`,
  "i",
);
// "Dak is trash", "the Cowboys are the worst"
const IS_BAD =
  /\b(?:is|are|was|were) (?:the |a |an |so |such an? )?(?:worst|trash|garbage|terrible|awful|horrible|overrated|washed|frauds?)\b/i;
const AGAINST = /\b(?:case against|roast\w*|sucks)\b/i;

/** Questions asking for the stats where someone ranks last ("the case against"). */
export function isRoastQuestion(q: string): boolean {
  return (
    WHY_BAD.test(q) ||
    IS_BAD.test(q) ||
    AGAINST.test(q) ||
    (PROVE.test(q) && new RegExp(`\\b(?:${BAD})\\b`, "i").test(q))
  );
}

export function isProofQuestion(q: string): boolean {
  return PROVE.test(q) || WHY_GOOD.test(q) || isRoastQuestion(q);
}

export type Candidate = {
  pid: string;
  name: string;
  /** Total volume across roles, the tiebreak between same-named players. */
  n: number;
  /** A team rather than a player. Players win ties ("Stroud on the Texans"). */
  team: boolean;
  roles: Record<string, number>;
};

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words in prove-style questions that are also somebody's name.
const STOP = new Set(
  "best worst worse trash garbage terrible awful overrated washed fraud sucks roast against prove proof stats stat the that case make greatest goat elite season year career playoffs game games quarterback qb receiver running back league player show give me why top number one ever all time history this last since against better than great king love young hill chase brown white green black gray grey rice will mark james king knight best case early long short deep".split(
    " ",
  ),
);

// Nicknames people actually type, rewritten to a name the data has.
const NICKNAMES: [RegExp, string][] = [
  [/\bwemby\b/g, "wembanyama"],
  [/\bsga\b/g, "gilgeous alexander"],
  [/\b(the )?joker\b/g, "jokic"],
  [/\bkd\b/g, "kevin durant"],
  [/\bad\b/g, "anthony davis"],
  [/\bcp3\b/g, "chris paul"],
  [/\bsteph\b/g, "stephen curry"],
  [/\b(king james|bron)\b/g, "lebron james"],
  [/\bgreek freak\b/g, "giannis"],
  [/\bdame\b/g, "damian lillard"],
  [/\bant(hony)? edwards\b|\bant man\b/g, "anthony edwards"],
  [/\bcmc\b/g, "christian mccaffrey"],
  [/\bjsn\b/g, "smith njigba"],
  [/\barsb\b|\bsun god\b/g, "amon ra st brown"],
  [/\btua\b/g, "tagovailoa"],
  [/\bmvs\b/g, "valdes scantling"],
  [/\bbig dumper\b/g, "cal raleigh"],
  [/\bvlad( jr)?\b/g, "vladimir guerrero"],
  [/\bniners\b/g, "49ers"],
  [/\bpats\b/g, "patriots"],
  [/\bbucs\b/g, "buccaneers"],
  [/\bjags\b/g, "jaguars"],
  [/\bphins\b/g, "dolphins"],
  [/\bcommies\b/g, "commanders"],
  [/\bcavs\b/g, "cavaliers"],
  [/\bmavs\b/g, "mavericks"],
  [/\bsixers\b/g, "76ers"],
  [/\bwolves\b/g, "timberwolves"],
  [/\bdbacks\b|\bsnakes\b/g, "diamondbacks"],
  [/\bstros\b/g, "astros"],
];

/**
 * The player the question names. Full name beats last name beats a lone first
 * name ("Lamar"); among equals the one with the most plays or games wins, so
 * "Josh Allen" means the quarterback.
 */
export function findPlayer(
  question: string,
  cands: Candidate[],
): Candidate | null {
  let norm = normalizeName(question);
  for (const [re, name] of NICKNAMES) norm = norm.replace(re, name);
  // "The case for Puka over JSN": the case is for whoever comes first.
  const head = norm.split(COMPARE)[0]!;
  return (
    (head !== norm ? bestMatch(head, cands) : null) ?? bestMatch(norm, cands)
  );
}

const COMPARE =
  / \b(?:over|vs|versus|than|instead of|compared (?:to|with)|rather than)\b /;

function bestMatch(norm: string, cands: Candidate[]): Candidate | null {
  const q = ` ${norm} `;
  const words = new Set(q.trim().split(" "));
  let best: { c: Candidate; score: number } | null = null;
  for (const c of cands) {
    const name = normalizeName(c.name);
    if (!name) continue;
    const parts = name.split(" ");
    const first = parts[0]!;
    const last = parts.at(-1)!;
    let score = 0;
    if (q.includes(` ${name} `)) score = 3;
    // Two-word nicknames: "red sox", "trail blazers".
    else if (parts.length > 2 && q.includes(` ${parts.slice(-2).join(" ")} `))
      score = 3;
    else if (
      parts.length > 1 &&
      words.has(last) &&
      last.length >= 3 &&
      !STOP.has(last)
    )
      score = words.has(first) ? 3 : 2;
    else if (first.length >= 4 && words.has(first) && !STOP.has(first))
      score = 1;
    if (!score) continue;
    const better =
      !best ||
      score > best.score ||
      (score === best.score &&
        (best.c.team && !c.team
          ? true
          : best.c.team === c.team && c.n > best.c.n));
    if (better) best = { c, score };
  }
  return best?.c ?? null;
}

const NUMBER: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/**
 * Seasons and season type from the question. Defaults to the current season's
 * regular season (`defaulted` tells the caller it may widen the search).
 * NBA seasons are named by the year they end, so "2024-25" is 2025.
 */
export function parseScope(
  sport: Sport,
  question: string,
  info: Pick<DataInfo, "minSeason" | "maxSeason">,
): { scope: Scope; defaulted: boolean } {
  const q = question.toLowerCase();
  const type: Scope["type"] = /\b(playoffs?|postseason)\b/.test(q)
    ? "POST"
    : "REG";
  const clamp = (n: number) =>
    Math.min(Math.max(n, info.minSeason), info.maxSeason);
  const make = (from: number, to: number) => ({
    scope: { from: clamp(from), to: clamp(to), type },
    defaulted: false,
  });

  if (/\b(career|all[- ]time|ever|in history)\b/.test(q))
    return make(info.minSeason, info.maxSeason);

  const lastN =
    /\b(?:last|past) (\d+|two|three|four|five|six|seven|eight|nine|ten) (?:seasons|years)\b/.exec(
      q,
    );
  if (lastN) {
    const n = NUMBER[lastN[1]!] ?? Number(lastN[1]);
    return make(info.maxSeason - n + 1, info.maxSeason);
  }

  const since = /\bsince (?:the )?((?:19|20)\d\d)\b/.exec(q);
  if (since) {
    const y = Number(since[1]);
    return make(sport === "nba" ? y + 1 : y, info.maxSeason);
  }

  const years: number[] = [];
  for (const m of q.matchAll(/\b((?:19|20)\d\d)(?:\s*[-–/]\s*(\d{2,4}))?\b/g)) {
    const a = Number(m[1]);
    if (m[2]) {
      const b = Number(
        m[2].length === 2 ? `${m[1]!.slice(0, 2)}${m[2]}` : m[2],
      );
      // "2024-25" is one NBA season; "2020-2023" or "2020-23" elsewhere is a range.
      if (sport === "nba" && b === a + 1) years.push(b);
      else years.push(a, b);
    } else years.push(a);
  }
  if (years.length) return make(Math.min(...years), Math.max(...years));

  return {
    scope: { from: info.maxSeason, to: info.maxSeason, type },
    defaulted: true,
  };
}
