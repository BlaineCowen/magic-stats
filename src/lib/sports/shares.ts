import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ChartSpec } from "@/lib/nfl/chart-spec";
import type { PipelineResult } from "./pipeline";
import type { ProofResult } from "./prove/engine";
import type { Sport } from "./types";

/**
 * Public share pages. A share can only point at an answer this server produced
 * (looked up by the answer_id sent with every answer), so nobody can publish
 * made-up tables under the site's name. Shares are JSON files that survive
 * restarts; the answers they're made from only live in memory for a while.
 */

export type Answer = PipelineResult | ProofResult;

export type Share = {
  id: string;
  created: string;
  sport: Sport;
  question: string;
  /** The answer, minus debugging detail (attempts, model stats). */
  answer: Answer;
  /** The chart as the sharer left it, if one was showing. */
  chart: ChartSpec | null;
};

const SHARES_DIR = path.resolve(
  process.env.SHARES_DIR ?? path.join(process.cwd(), "data/shares"),
);
const ID_RE = /^[A-Za-z0-9]{10}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function newId(): string {
  const bytes = randomBytes(10);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Recent answers, so a share request only needs the id.
const RECENT_MAX = 1000;
const RECENT_TTL = 1000 * 60 * 60 * 12;
type Recent = Map<
  string,
  { sport: Sport; question: string; answer: Answer; at: number }
>;
// On globalThis: Next bundles each route separately, and the query route
// stashes what the share route reads.
const g = globalThis as typeof globalThis & {
  __shareRecent?: Recent;
  __shareLog?: Map<string, number[]>;
};
const recent: Recent = (g.__shareRecent ??= new Map());

/** Remember an answer for sharing and return its id. */
export function stashAnswer(
  sport: Sport,
  question: string,
  answer: Answer,
): string {
  const id = newId();
  recent.set(id, { sport, question, answer, at: Date.now() });
  if (recent.size > RECENT_MAX) recent.delete(recent.keys().next().value!);
  return id;
}

// A few shares per minute is plenty for a person; this stops a script.
const SHARES_PER_HOUR = 60;
const shareLog = (g.__shareLog ??= new Map<string, number[]>());
export function allowShare(key: string): boolean {
  const now = Date.now();
  const times = (shareLog.get(key) ?? []).filter((t) => now - t < 3600_000);
  if (times.length >= SHARES_PER_HOUR) return false;
  times.push(now);
  shareLog.set(key, times);
  return true;
}

function cleanChart(v: unknown, columns: string[]): ChartSpec | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (!["scatter", "line", "bar"].includes(String(c.type))) return null;
  const col = (k: string) => {
    const s = typeof c[k] === "string" ? (c[k] as string) : "";
    return s === "" || columns.includes(s) ? s : null;
  };
  const x = col("x");
  const y = col("y");
  const label = col("label");
  const series = col("series");
  if (x === null || !y || label === null || series === null) return null;
  const title = typeof c.title === "string" ? c.title.slice(0, 120) : "";
  return { type: c.type as ChartSpec["type"], x, y, label, series, title };
}

/** Save a share of a recent answer. */
export async function createShare(
  answerId: string,
  chart: unknown,
): Promise<Share | null> {
  const hit = recent.get(answerId);
  if (!hit || Date.now() - hit.at > RECENT_TTL) return null;
  const answer: Answer =
    "kind" in hit.answer
      ? hit.answer
      : { ...hit.answer, attempts: [], llm_stats: undefined };
  const spec =
    "kind" in answer ? null : cleanChart(chart, answer.columns ?? []);
  const share: Share = {
    id: newId(),
    created: new Date().toISOString(),
    sport: hit.sport,
    question: hit.question,
    answer,
    chart: spec,
  };
  await fs.mkdir(SHARES_DIR, { recursive: true });
  const file = path.join(SHARES_DIR, `${share.id}.json`);
  await fs.writeFile(`${file}.tmp`, JSON.stringify(share));
  await fs.rename(`${file}.tmp`, file);
  return share;
}

export async function loadShare(id: string): Promise<Share | null> {
  if (!ID_RE.test(id)) return null;
  try {
    const raw = await fs.readFile(path.join(SHARES_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as Share;
  } catch {
    return null;
  }
}
