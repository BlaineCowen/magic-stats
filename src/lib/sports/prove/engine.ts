import { dataVersion, getDataInfo, runSafeSelect, type Row } from "../db";
import type { Sport } from "../types";
import {
  FRAC,
  formatValue,
  named,
  ordinal,
  type Role,
  type Scope,
  type SportProof,
} from "./kit";
import { mlbProof } from "./mlb";
import { nbaProof } from "./nba";
import { nflProof } from "./nfl";
import {
  findPlayer,
  isRoastQuestion,
  parseScope,
  type Candidate,
} from "./parse";

const PROOF: Record<Sport, SportProof> = {
  nfl: nflProof,
  nba: nbaProof,
  mlb: mlbProof,
};

export type ProofRow = {
  rank: number;
  player: string;
  team: string;
  value: string;
  sample: number;
  target: boolean;
};

export type Finding = {
  /** "Player" or "Team", the table's name column. */
  entity: "Player" | "Team";
  title: string;
  rank: number;
  tied: boolean;
  pool: number;
  noun: string;
  column: string;
  sampleLabel: string;
  minSample: number;
  rows: ProofRow[];
};

export type ProofResult = {
  kind: "proof";
  sport: Sport;
  /** The player or team the case is for. */
  player: string;
  isTeam: boolean;
  /** The case against: rank 1 means last. Missing on answers cached before it existed. */
  worst?: boolean;
  team: string;
  scope: string;
  note: string | null;
  findings: Finding[];
  timings: { db_ms: number; total_ms: number };
  data_version: string;
};

/** Candidates (the role's plays/games grouped by player) for name matching. */
async function candidates(
  sport: Sport,
  proof: SportProof,
  scope: Scope,
): Promise<Candidate[]> {
  const where = proof.scopeSql(scope);
  const sql = proof.roles
    .map(
      (
        r,
      ) => `SELECT '${r.key}' AS role, ${r.team ? "true" : "false"} AS is_team, pid::VARCHAR AS pid, any_value(pname) AS pname,
        (${r.sample.sql})::DOUBLE AS n FROM (${named(r, r.ids(where))}) GROUP BY pid`,
    )
    .join(" UNION ALL ");
  // Every player with any volume; only names are matched, so a big list is fine.
  const { rows } = await runSafeSelect(
    sport,
    `SELECT pid, any_value(pname) AS pname, bool_or(is_team) AS is_team,
       string_agg(role || ':' || n, ',') AS roles,
       sum(n) AS n
     FROM (${sql}) WHERE pname IS NOT NULL GROUP BY pid`,
    { maxRows: 20_000 },
  );
  return rows.map((r) => ({
    pid: String(r.pid),
    name: String(r.pname),
    n: Number(r.n),
    team: r.is_team === true,
    roles: Object.fromEntries(
      String(r.roles)
        .split(",")
        .map((x) => x.split(":"))
        .map(([k, v]) => [k!, Number(v)]),
    ),
  }));
}

function pairs(keys: string[], skip: [string, string][] = []): string[][] {
  const bad = new Set(skip.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const out: string[][] = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++)
      if (!bad.has(`${keys[i]}|${keys[j]}`)) out.push([keys[i]!, keys[j]!]);
  return out;
}

const sqlStr = (s: string) => `'${s.replaceAll("'", "''")}'`;

/**
 * One query per role: aggregate every player over every split and pair of
 * splits, rank each stat within each split among qualified players, and return
 * the leaderboards of the splits where the target ranks in the top 3.
 */
function splitSql(
  role: Role,
  where: string,
  pid: string,
  withPairs: boolean,
): string {
  const dims = role.dims.map((d) => `d_${d.key}`);
  const sets = [
    "(pid)",
    ...dims.map((d) => `(pid, ${d})`),
    ...(withPairs
      ? pairs(
          dims,
          role.skipPairs?.map(
            ([a, b]) => [`d_${a}`, `d_${b}`] as [string, string],
          ),
        ).map(([a, b]) => `(pid, ${a}, ${b})`)
      : []),
  ];
  const metrics = role.metrics.map((m) => `m_${m.key}`);
  const part = `PARTITION BY ${dims.join(", ")}, metric`;
  const low = role.metrics
    .filter((m) => m.low)
    .map((m) => sqlStr(`m_${m.key}`));
  const totals = role.metrics
    .filter((m) => !m.rate)
    .map((m) => sqlStr(`m_${m.key}`));
  const nd = dims.map((d) => `(${d} IS NOT NULL)::INT`).join(" + ");
  return `
WITH base AS (${named(role, role.from(where))}),
agg AS (
  SELECT pid::VARCHAR AS pid, any_value(pname) AS pname, string_agg(DISTINCT team, '/') AS team,
    ${dims.join(", ")}, (${role.sample.sql})::DOUBLE AS sample,
    ${role.metrics.map((m) => `(${m.sql})::DOUBLE AS m_${m.key}`).join(",\n    ")}
  FROM base
  GROUP BY GROUPING SETS (${sets.join(", ")})
  HAVING ${dims.map((d) => `(GROUPING(${d}) = 1 OR ${d} IS NOT NULL)`).join(" AND ")}
),
long AS (
  SELECT *, ${nd} AS nd,
    max(sample) OVER (${part}) AS mx
  FROM agg UNPIVOT (val FOR metric IN (${metrics.join(", ")}))
),
qual AS (
  SELECT *, ${low.length ? `CASE WHEN metric IN (${low.join(", ")}) THEN -val ELSE val END` : "val"} AS sval
  FROM long
  WHERE sample >= greatest(CASE nd WHEN 0 THEN ${role.min[0]} WHEN 1 THEN ${role.min[1]} ELSE ${role.min[2]} END, ${FRAC} * mx)
    AND ${totals.length ? `(metric NOT IN (${totals.join(", ")}) OR val > 0)` : "TRUE"}
),
ranked AS (
  SELECT *, rank() OVER (${part} ORDER BY sval DESC) AS rk,
    row_number() OVER (${part} ORDER BY sval DESC, sample DESC) AS rn,
    count(*) OVER (${part}) AS pool
  FROM qual
),
scored AS (
  SELECT *, count(*) FILTER (WHERE rk = 1) OVER (${part}) AS ties,
    max(CASE WHEN rk > 1 THEN sval END) OVER (${part}) AS next_sval
  FROM ranked
),
wins AS (
  SELECT ${dims.join(", ")}, metric FROM scored
  WHERE pid = ${sqlStr(pid)} AND rk <= 3 AND pool >= ${role.minPool}
  ORDER BY rk, nd, pool DESC LIMIT 70
)
SELECT s.pid, s.pname, s.team, ${dims.map((d) => `s.${d}`).join(", ")}, s.metric, s.val, s.sval, s.next_sval,
  s.sample, s.rk, s.rn, s.pool, s.ties, s.nd
FROM scored s JOIN wins w ON s.metric = w.metric
  AND ${dims.map((d) => `s.${d} IS NOT DISTINCT FROM w.${d}`).join(" AND ")}
WHERE s.rn <= 5 OR s.pid = ${sqlStr(pid)}`;
}

type Candidate2 = {
  finding: Finding;
  score: number;
  rank: number;
  tied: boolean;
  metric: string;
  split: string;
};

function toFindings(role: Role, rows: Row[], pid: string): Candidate2[] {
  const groups = new Map<string, Row[]>();
  const dimKeys = role.dims.map((d) => `d_${d.key}`);
  for (const r of rows) {
    const key = [...dimKeys.map((d) => r[d] ?? ""), r.metric].join("|");
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  const out: Candidate2[] = [];
  for (const g of groups.values()) {
    const me = g.find((r) => String(r.pid) === pid);
    if (!me) continue;
    const metric = role.metrics.find((m) => `m_${m.key}` === me.metric)!;
    const used = role.dims.filter((d) => me[`d_${d.key}`]);
    const split = used.map((d) => me[`d_${d.key}`]).join(" ");
    const dimWeight = used.reduce((w, d) => w * (d.weight ?? 1), 1);
    const rank = Number(me.rk);
    const pool = Number(me.pool);
    const tied = Number(me.ties) > 1 && rank === 1;
    const nd = Number(me.nd);
    const next = me.next_sval == null ? null : Number(me.next_sval);
    const sval = Number(me.sval);
    const margin =
      rank === 1 && next != null && next !== 0
        ? Math.min((sval - next) / Math.abs(next), 0.5)
        : 0;
    const score =
      ((rank === 1 ? 1 : rank === 2 ? 0.3 : 0.12) *
        (tied ? 0.5 : 1) *
        Math.log2(pool) *
        (1 + margin) *
        (metric.weight ?? 1) *
        dimWeight) /
      (1 + 0.45 * nd);
    const minSample = Math.max(
      role.min[Math.min(nd, 2)]!,
      Math.ceil(FRAC * Math.max(...g.map((r) => Number(r.sample)))),
    );
    out.push({
      metric: `${role.key}:${metric.key}`,
      split: `${role.key}:${split}`,
      score,
      rank,
      tied,
      finding: {
        entity: role.team ? "Team" : "Player",
        title: `${metric.lead}${split ? ` ${split}` : ""}`,
        rank,
        tied,
        pool,
        noun: role.noun,
        column: metric.column,
        sampleLabel: role.sample.label,
        minSample,
        rows: g
          .sort((a, b) => Number(a.rn) - Number(b.rn))
          .map((r) => ({
            rank: Number(r.rk),
            player: String(r.pname),
            team: String(r.team ?? ""),
            value: formatValue(Number(r.val), metric.fmt),
            sample: Number(r.sample),
            target: String(r.pid) === pid,
          })),
      },
    });
  }
  return out;
}

/** Best findings, spread across stats and splits so the list isn't ten
 * versions of the same number. */
function pick(all: Candidate2[], n: number): Finding[] {
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const outright = sorted.filter((f) => f.rank === 1 && !f.tied);
  const leads = sorted.filter((f) => f.rank === 1);
  // Splits the player leads outright first; ties, then 2nd and 3rd, only if
  // there aren't enough of those.
  const pool =
    outright.length >= 6 ? outright : leads.length >= 4 ? leads : sorted;
  const perMetric = new Map<string, number>();
  const perSplit = new Map<string, number>();
  const out: Finding[] = [];
  for (const f of pool) {
    if (out.length >= n) break;
    if ((perMetric.get(f.metric) ?? 0) >= 2) continue;
    if ((perSplit.get(f.split) ?? 0) >= 2) continue;
    perMetric.set(f.metric, (perMetric.get(f.metric) ?? 0) + 1);
    perSplit.set(f.split, (perSplit.get(f.split) ?? 0) + 1);
    out.push(f.finding);
  }
  // The variety limits can leave a short list when the leads are all one
  // stat; top it up with his other top-3 splits, still spread out.
  for (const f of sorted) {
    if (out.length >= Math.min(n, 8)) break;
    if (out.includes(f.finding)) continue;
    if ((perSplit.get(f.split) ?? 0) >= 2) continue;
    if ((perMetric.get(f.metric) ?? 0) >= 3) continue;
    perMetric.set(f.metric, (perMetric.get(f.metric) ?? 0) + 1);
    perSplit.set(f.split, (perSplit.get(f.split) ?? 0) + 1);
    out.push(f.finding);
  }
  return out;
}

function scopeLabel(proof: SportProof, s: Scope): string {
  const seasons =
    s.from === s.to
      ? proof.seasonLabel(s.from)
      : `${proof.seasonLabel(s.from)} to ${proof.seasonLabel(s.to)}`;
  return `${seasons} ${s.type === "POST" ? "playoffs" : "regular season"}`;
}

const OPPOSITE: Record<string, string> = {
  Most: "Fewest",
  Fewest: "Most",
  Best: "Worst",
  Highest: "Lowest",
  Lowest: "Highest",
};

/**
 * The role turned upside down for "the case against": every stat ranks worst
 * first. Plain totals (most passing yards) are dropped, since the fewest just
 * finds whoever barely qualified; rates and bad-is-high totals stay.
 */
export function flipRole(role: Role): Role {
  return {
    ...role,
    metrics: role.metrics
      .filter((m) => m.rate || m.low)
      .map((m) => ({
        ...m,
        low: !m.low,
        lead: m.lead.replace(/^\w+/, (w) => OPPOSITE[w] ?? w),
      })),
  };
}

/** Fewest of the role's own sample a player needs before we search that role. */
const ROLE_FLOOR = 0.5;

/**
 * "Prove X is the best": find the stat splits where X ranks first ("why is X
 * the worst": where X ranks last). Returns
 * null when no player in the question can be found, so the caller can fall
 * back to the normal question pipeline.
 */
export async function proveClaim(
  sport: Sport,
  question: string,
): Promise<ProofResult | null> {
  const started = Date.now();
  const proof = PROOF[sport];
  const info = await getDataInfo(sport);
  const parsed = parseScope(sport, question, info);
  let scope = parsed.scope;
  let note: string | null = null;

  let player = findPlayer(question, await candidates(sport, proof, scope));
  if (!player && parsed.defaulted) {
    // Not in this season's data (a season that has barely started, an injury,
    // retirement): try last season, then every season.
    const prev: Scope = { ...scope, from: scope.from - 1, to: scope.to - 1 };
    player = findPlayer(question, await candidates(sport, proof, prev));
    if (player) {
      note = `No ${proof.seasonLabel(scope.to)} numbers for ${player.name} yet, so these are from ${proof.seasonLabel(prev.to)}.`;
      scope = prev;
    } else {
      const career: Scope = { ...scope, from: info.minSeason };
      player = findPlayer(question, await candidates(sport, proof, career));
      scope = career;
    }
  }
  if (!player) return null;

  let roles = proof.roles.filter(
    (r) =>
      (player!.roles[r.key] ?? 0) >=
      r.min[0] * ROLE_FLOOR * (scope.to - scope.from + 1),
  );
  // Early in a season the player may not have enough volume yet: use last season.
  if (!roles.length && parsed.defaulted && scope.from === scope.to) {
    const prev: Scope = { ...scope, from: scope.from - 1, to: scope.to - 1 };
    const prevCands = await candidates(sport, proof, prev);
    const again = prevCands.find((c) => c.pid === player!.pid);
    if (again) {
      player = again;
      roles = proof.roles.filter(
        (r) => (again.roles[r.key] ?? 0) >= r.min[0] * ROLE_FLOOR,
      );
      note = `${proof.seasonLabel(scope.to)} has barely started, so these are from ${proof.seasonLabel(prev.to)}.`;
      scope = prev;
    }
  }
  if (!roles.length) {
    // Fall back to whatever role they have the most of.
    const best = Object.entries(player.roles).sort((a, b) => b[1] - a[1])[0];
    const role = proof.roles.find((r) => r.key === best?.[0]);
    if (role) roles = [role];
  }

  const worst = isRoastQuestion(question);
  if (worst) roles = roles.map(flipRole).filter((r) => r.metrics.length);

  const where = proof.scopeSql(scope);
  const pid = player.pid;
  const t0 = Date.now();
  // One role at a time: each query holds every split in memory.
  const results: Candidate2[] = [];
  for (const role of roles) {
    const { rows } = await runSafeSelect(
      sport,
      // Pairs of splits over many seasons is too much data; single splits only.
      splitSql(role, where, pid, scope.to - scope.from < 3),
      { maxRows: 1000 },
    );
    results.push(...toFindings(role, rows, pid));
  }
  const findings = pick(results, 12);
  const me = findings[0]?.rows.find((r) => r.target);

  return {
    kind: "proof",
    sport,
    player: me?.player ?? player.name,
    isTeam: player.team,
    worst,
    team: me?.team ?? "",
    scope: scopeLabel(proof, scope),
    note,
    findings,
    timings: { db_ms: Date.now() - t0, total_ms: Date.now() - started },
    data_version: dataVersion(sport),
  };
}

export { ordinal };
