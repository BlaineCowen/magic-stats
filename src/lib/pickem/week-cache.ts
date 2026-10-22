import { fetchWeek, isActive, type PickemWeek } from "./scoreboard";

// One ESPN call per week per window however many people or routes ask: 20
// seconds while games are on, 5 minutes otherwise. On globalThis because Next
// bundles each route separately and they should share it.
const g = globalThis as typeof globalThis & {
  __pickemWeeks?: Map<string, { at: number; data: PickemWeek }>;
};
const cache = (g.__pickemWeeks ??= new Map<
  string,
  { at: number; data: PickemWeek }
>());

export async function getWeek(
  season?: number,
  week?: number,
): Promise<PickemWeek> {
  const key = `${season ?? "now"}-${week ?? "now"}`;
  const hit = cache.get(key);
  const ttl = hit && isActive(hit.data) ? 20e3 : 300e3;
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  try {
    const data = await fetchWeek(season, week);
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    if (hit) return hit.data;
    throw e;
  }
}

/** Games that have kicked off (or are final): picks on them are locked. */
export function startedIds(w: PickemWeek, now = Date.now()): Set<string> {
  return new Set(
    w.games
      .filter((g) => g.state !== "pre" || Date.parse(g.kickoff) <= now)
      .map((g) => g.id),
  );
}
