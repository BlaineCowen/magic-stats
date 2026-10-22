"use client";

import { useCallback, useEffect, useState } from "react";
import type { Entry, Side } from "@/lib/pickem/optimizer";
import type { PickemGame } from "@/lib/pickem/scoreboard";

/**
 * Browser storage for the pool settings and each week's entry. The keys match
 * the original /nfl/pickem page on the same domain, so picks made there show
 * up here.
 */

export type Scoring = "rank1-highest" | "points-equal-rank";
export type Settings = {
  poolSize: number;
  scoring: Scoring;
  hedgeMode: boolean;
};
export type Office = Record<string, { home: number; away: number }>;
export type WeekState = {
  office: Office;
  picks: Record<string, Side>;
  points: Record<string, number>;
  pinned: string[];
};

const SETTINGS_KEY = "nfl-pickem:settings";
const weekKey = (season: number, week: number) =>
  `nfl-pickem:${season}:${week}`;
const DEFAULT_SETTINGS: Settings = {
  poolSize: 12,
  scoring: "rank1-highest",
  hedgeMode: true,
};
const EMPTY_WEEK: WeekState = { office: {}, picks: {}, points: {}, pinned: [] };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode or full: the page still works for this visit
  }
}

export function usePickemState(season: number | null, week: number | null) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<WeekState>(EMPTY_WEEK);

  useEffect(() => setSettings(load(SETTINGS_KEY, DEFAULT_SETTINGS)), []);
  useEffect(() => {
    if (season !== null && week !== null)
      setState(load(weekKey(season, week), EMPTY_WEEK));
  }, [season, week]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      save(SETTINGS_KEY, next);
      return next;
    });
  }, []);

  const update = useCallback(
    (fn: (s: WeekState) => WeekState) => {
      setState((s) => {
        const next = fn(s);
        if (season !== null && week !== null) save(weekKey(season, week), next);
        return next;
      });
    },
    [season, week],
  );

  return { settings, updateSettings, state, update };
}

/**
 * The entry on screen: what's saved, with any game that has no pick or points
 * yet filled in from straight odds (favourite, most points on the surest).
 */
export function currentEntry(games: PickemGame[], s: WeekState): Entry {
  const n = games.length;
  const used = new Set(
    games
      .map((g) => s.points[g.id])
      .filter((v): v is number => v !== undefined && v >= 1 && v <= n),
  );
  const picks: Record<string, Side> = {};
  const points: Record<string, number> = {};
  const free = Array.from({ length: n }, (_, i) => n - i).filter(
    (v) => !used.has(v),
  );
  const seen = new Set<number>();
  const missing: PickemGame[] = [];
  for (const g of games) {
    picks[g.id] = s.picks[g.id] ?? (g.pHome >= 0.5 ? "home" : "away");
    const v = s.points[g.id];
    if (v !== undefined && v >= 1 && v <= n && !seen.has(v)) {
      points[g.id] = v;
      seen.add(v);
    } else missing.push(g);
  }
  missing
    .sort(
      (a, b) => Math.max(b.pHome, 1 - b.pHome) - Math.max(a.pHome, 1 - a.pHome),
    )
    .forEach((g, i) => {
      points[g.id] = free[i] ?? 1;
    });
  return { picks, points };
}
