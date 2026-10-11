/**
 * Detect a column that counts plays, attempts, games, or sample size for UI filtering.
 * Prefer the canonical name from the LLM prompt: `n_plays`.
 */
export function detectPlayCountColumn(
  rows: Record<string, string | number | boolean | null>[],
): string | null {
  if (rows.length === 0) return null;
  const keys = Object.keys(rows[0]!);
  const lowerToKey = new Map(keys.map((k) => [k.toLowerCase(), k] as const));
  const preferred = [
    "n_plays",
    "plays",
    "n",
    "attempts",
    "total_attempts",
    "games_played",
    "games",
    "gp",
    "rush_attempts",
    "targets",
    "sample_size",
  ];
  for (const p of preferred) {
    const k = lowerToKey.get(p);
    if (k) return k;
  }
  return null;
}

export function getPlayCountRange(
  rows: Record<string, string | number | boolean | null>[],
  col: string,
): { min: number; max: number } | null {
  const vals = rows
    .map((r) => Number(r[col]))
    .filter((v) => Number.isFinite(v));
  if (vals.length === 0) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}
