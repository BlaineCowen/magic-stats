// The last few questions this browser asked. Storage can be missing or
// blocked (private windows, previews), so every access is guarded.
const KEY = "nfl_recent_questions";
export const RECENT_MAX = 8;

export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((q): q is string => typeof q === "string")
          .slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable; recents just won't persist
  }
}

/** Put `question` first, dropping an earlier copy of it (case-insensitive). */
export function pushRecent(list: string[], question: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return [question, ...list.filter((q) => norm(q) !== norm(question))].slice(
    0,
    RECENT_MAX,
  );
}
