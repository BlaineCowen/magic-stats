"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry, Side } from "@/lib/pickem/optimizer";
import type { PickemGame } from "@/lib/pickem/scoreboard";
import type { Pool } from "@/lib/pickem/store";

/**
 * Pool settings and each week's entry. Signed in, the entry lives on the
 * server (so phone and laptop agree, and pools can see it); signed out, in
 * this browser under the same keys the original /nfl/pickem page used. The
 * first time a signed-in user opens a week the server has nothing for, the
 * browser's copy is uploaded.
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
export const EMPTY_WEEK: WeekState = {
  office: {},
  picks: {},
  points: {},
  pinned: [],
};

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

export type Me = { user: string | null; pools: Pool[] };

/** Who's signed in (null while loading). */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/pickem/me");
      setMe(r.ok ? ((await r.json()) as Me) : { user: null, pools: [] });
    } catch {
      setMe({ user: null, pools: [] });
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);
  return { me, refresh };
}

const hasPicks = (s: WeekState) =>
  Object.keys(s.picks).length > 0 || Object.keys(s.points).length > 0;

export function usePickemState(
  season: number | null,
  week: number | null,
  user: string | null | undefined,
) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<WeekState>(EMPTY_WEEK);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setSettings(load(SETTINGS_KEY, DEFAULT_SETTINGS)), []);

  useEffect(() => {
    if (season === null || week === null || user === undefined) return;
    const local = load(weekKey(season, week), EMPTY_WEEK);
    if (!user) {
      setState(local);
      return;
    }
    let stop = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/pickem/entry?season=${season}&week=${week}`,
        );
        const body = (await r.json()) as { entry: WeekState | null };
        if (stop) return;
        if (body.entry) setState({ ...EMPTY_WEEK, ...body.entry });
        else {
          setState(local);
          if (hasPicks(local)) void push(season, week, local);
        }
      } catch {
        if (!stop) setState(local);
      }
    })();
    return () => {
      stop = true;
    };
    // push is stable for the week; listing it would refetch on every save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, week, user]);

  const push = useCallback(async (s: number, w: number, value: WeekState) => {
    setSaving(true);
    try {
      const r = await fetch("/api/pickem/entry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: s, week: w, ...value }),
      });
      const body = (await r.json()) as { entry?: WeekState; error?: string };
      if (!r.ok) {
        setSaveError(body.error ?? "Couldn't save your picks.");
        if (body.entry) setState({ ...EMPTY_WEEK, ...body.entry });
      } else {
        setSaveError("");
        // The server keeps games that have kicked off as they were.
        if (body.entry) {
          const server = body.entry;
          setState((cur) => ({
            ...cur,
            picks: server.picks,
            points: server.points,
          }));
        }
      }
    } catch {
      setSaveError(
        "Couldn't reach the server; your picks are saved in this browser.",
      );
    } finally {
      setSaving(false);
    }
  }, []);

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
        if (season !== null && week !== null) {
          save(weekKey(season, week), next);
          if (user) {
            clearTimeout(pending.current);
            pending.current = setTimeout(
              () => void push(season, week, next),
              600,
            );
          }
        }
        return next;
      });
    },
    [season, week, user, push],
  );

  return { settings, updateSettings, state, update, saveError, saving };
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
