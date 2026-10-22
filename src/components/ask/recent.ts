import { isSport, type Sport } from "@/lib/sports/types";

// The last few questions this browser asked, with the sport each was asked
// about. Storage can be missing or blocked (private windows, previews), so
// every access is guarded.
const KEY = "nfl_recent_questions";
export const RECENT_MAX = 8;

export type RecentQuestion = { q: string; sport: Sport };

export function loadRecent(): RecentQuestion[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: unknown): RecentQuestion | null => {
        // Saved before the sport switch existed: plain strings, all NFL.
        if (typeof item === "string") return { q: item, sport: "nfl" };
        const r = item as Partial<RecentQuestion> | null;
        return r && typeof r.q === "string" && isSport(r.sport)
          ? { q: r.q, sport: r.sport }
          : null;
      })
      .filter((r): r is RecentQuestion => r !== null)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function saveRecent(list: RecentQuestion[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; recents just won't persist
  }
}

/** Put `entry` first, dropping an earlier copy of it (same sport, case-insensitive). */
export function pushRecent(
  list: RecentQuestion[],
  entry: RecentQuestion,
): RecentQuestion[] {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return [
    entry,
    ...list.filter(
      (r) => r.sport !== entry.sport || norm(r.q) !== norm(entry.q),
    ),
  ].slice(0, RECENT_MAX);
}

const SPORT_KEY = "ask_sport";

export function loadSport(): Sport | null {
  try {
    const s = localStorage.getItem(SPORT_KEY);
    return isSport(s) ? s : null;
  } catch {
    return null;
  }
}

export function saveSport(sport: Sport) {
  try {
    localStorage.setItem(SPORT_KEY, sport);
  } catch {
    // not fatal
  }
}
