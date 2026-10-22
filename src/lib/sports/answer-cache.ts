import type { PipelineResult, QueryMode } from "./pipeline";
import type { ProofResult } from "./prove/engine";
import type { Sport } from "./types";

// Bounded LRU keyed by sport + mode + question + that sport's data version, so
// a data refresh naturally invalidates old answers.
const CACHE_MAX = 200;
const CACHE_TTL = 1000 * 60 * 60 * 24;
type Answer = PipelineResult | ProofResult;
const queryCache = new Map<string, { data: Answer; at: number }>();

export function cacheKey(
  sport: Sport,
  mode: QueryMode | "prove",
  version: string,
  query: string,
) {
  return `${sport}|${mode}|${version}|${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function getCached(key: string) {
  const hit = queryCache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL) return null;
  queryCache.delete(key);
  queryCache.set(key, hit); // refresh LRU position
  return hit.data;
}

export function setCache(key: string, data: Answer) {
  queryCache.set(key, { data, at: Date.now() });
  if (queryCache.size > CACHE_MAX) {
    queryCache.delete(queryCache.keys().next().value!);
  }
}
