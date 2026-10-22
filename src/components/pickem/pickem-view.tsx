"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  CloudCheck,
  RotateCcw,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  optimize,
  rankByOdds,
  type GameResult,
  type OptGame,
  type OptimizeResult,
  type Side,
} from "@/lib/pickem/optimizer";
import { isActive, type PickemWeek } from "@/lib/pickem/scoreboard";
import { cn } from "@/lib/utils";
import { GameCard } from "./game-card";
import { Leaderboard, PoolForms, type PoolBoard } from "./pool-panel";
import { currentEntry, useMe, usePickemState, type Scoring } from "./state";
import { tally } from "@/lib/pickem/tally";

const focusCls =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-700";
const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const pct2 = (p: number) => `${(p * 100).toFixed(1)}%`;

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-slate-500 sm:text-xs">
        {label}
      </div>
      <div
        className={cn(
          "font-display text-2xl leading-tight font-bold tabular-nums",
          tone ?? "text-slate-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function PickemView() {
  const [target, setTarget] = useState<{ season: number; week: number } | null>(
    null,
  );
  const [data, setData] = useState<PickemWeek | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { me, refresh: refreshMe } = useMe();
  const user = me === null ? undefined : me.user;
  const { settings, updateSettings, state, update, saveError, saving } =
    usePickemState(target?.season ?? null, target?.week ?? null, user);
  const [poolId, setPoolId] = useState<string | null>(null);
  const [board, setBoard] = useState<PoolBoard | null>(null);
  const [showPoolForms, setShowPoolForms] = useState(false);

  // Remember the pool you last looked at.
  useEffect(() => {
    if (!me?.pools.length) return;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("nfl-pickem:pool");
    } catch {
      // ignore
    }
    setPoolId((cur) =>
      cur && me.pools.some((p) => p.id === cur)
        ? cur
        : (me.pools.find((p) => p.id === saved)?.id ?? me.pools[0]!.id),
    );
  }, [me]);
  const choosePool = (id: string | null) => {
    setPoolId(id);
    try {
      if (id) window.localStorage.setItem("nfl-pickem:pool", id);
    } catch {
      // ignore
    }
  };

  // Load the week, and keep scores fresh: every 30 seconds while games are on.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const q = target ? `?season=${target.season}&week=${target.week}` : "";
        const res = await fetch(`/api/pickem${q}`);
        const body = (await res.json()) as PickemWeek & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Couldn't load the week");
        if (stop) return;
        if (!target) {
          setTarget({
            season: body.season,
            week: body.seasonType === 2 ? body.week : 1,
          });
        }
        setData(body);
        setError("");
        timer = setTimeout(() => void load(), isActive(body) ? 30e3 : 300e3);
      } catch (e) {
        if (!stop) {
          setError(e instanceof Error ? e.message : "Couldn't load the week");
          timer = setTimeout(() => void load(), 60e3);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [target]);

  useEffect(() => setResult(null), [target?.season, target?.week]);

  // The pool's board refreshes whenever the scores do.
  useEffect(() => {
    if (!user || !poolId || !target) {
      setBoard(null);
      return;
    }
    let stop = false;
    void fetch(
      `/api/pickem/pools/${poolId}?season=${target.season}&week=${target.week}`,
    )
      .then(async (r) => (r.ok ? ((await r.json()) as PoolBoard) : null))
      .then((b) => {
        if (!stop) setBoard(b);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [user, poolId, target, data?.fetched, saving]);

  const games = useMemo(
    () => (data && target && data.week === target.week ? data.games : []),
    [data, target],
  );
  const n = games.length;
  const entry = useMemo(() => currentEntry(games, state), [games, state]);
  const t = useMemo(() => tally(games, entry), [games, entry]);
  const perGame = useMemo(() => {
    const m: Record<string, GameResult> = {};
    for (const r of result?.perGame ?? []) m[r.gameId] = r;
    return m;
  }, [result]);
  const ordered = useMemo(
    () =>
      [...games].sort(
        (a, b) => (entry.points[b.id] ?? 0) - (entry.points[a.id] ?? 0),
      ),
    [games, entry],
  );
  const shownRank = (pts: number) =>
    settings.scoring === "rank1-highest" ? n + 1 - pts : pts;

  // In a pool, the other members' actual picks are the office.
  const poolCounts =
    board && board.pool.members.length > 1 ? board.counts : null;
  const poolSize = poolCounts
    ? Math.max(2, board!.pool.members.length)
    : settings.poolSize;
  const optGames: OptGame[] = useMemo(
    () =>
      games.map((g) => {
        const o = poolCounts?.[g.id] ?? state.office[g.id];
        const total = (o?.home ?? 0) + (o?.away ?? 0);
        return {
          id: g.id,
          pHome: g.pHome,
          officeHomeShare: total > 0 ? o!.home / total : g.pHome,
        };
      }),
    [games, state.office, poolCounts],
  );

  const runOptimizer = useCallback(() => {
    if (!optGames.length) return;
    setBusy(true);
    // Let the button repaint before the simulation blocks the thread.
    setTimeout(() => {
      try {
        if (!settings.hedgeMode) {
          const e = rankByOdds(optGames);
          for (const id of state.pinned)
            if (state.picks[id]) e.picks[id] = state.picks[id];
          setResult(null);
          update((s) => ({ ...s, picks: e.picks, points: e.points }));
          return;
        }
        const r = optimize(optGames, poolSize, {
          pinned: new Set(state.pinned),
          current: entry,
        });
        setResult(r);
        update((s) => ({ ...s, picks: r.entry.picks, points: r.entry.points }));
      } finally {
        setBusy(false);
      }
    }, 30);
  }, [optGames, settings, poolSize, state.pinned, state.picks, entry, update]);

  // Games that have kicked off can't be changed (the server holds them too).
  const now = Date.now();
  const locked = useMemo(
    () =>
      new Set(
        games
          .filter((g) => g.state !== "pre" || Date.parse(g.kickoff) <= now)
          .map((g) => g.id),
      ),
    // re-evaluated with each scoreboard refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [games],
  );
  const unsaved =
    !!user &&
    games.some(
      (g) => !locked.has(g.id) && !(state.picks[g.id] && state.points[g.id]),
    );

  const setPick = (id: string, side: Side) =>
    !locked.has(id) &&
    update((s) => ({
      ...s,
      picks: { ...entry.picks, ...s.picks, [id]: side },
      points: { ...entry.points, ...s.points },
      pinned: s.pinned.includes(id) ? s.pinned : [...s.pinned, id],
    }));

  // Swap points with the game one step more (or less) confident; both get pinned.
  const move = (id: string, dir: 1 | -1) => {
    const mine = entry.points[id];
    if (mine === undefined) return;
    const other = games.find((g) => entry.points[g.id] === mine + dir);
    if (!other || locked.has(id) || locked.has(other.id)) return;
    update((s) => ({
      ...s,
      picks: { ...entry.picks, ...s.picks },
      points: { ...entry.points, [id]: mine + dir, [other.id]: mine },
      pinned: [...new Set([...s.pinned, id, other.id])],
    }));
  };

  const go = (week: number) =>
    target && week >= 1 && week <= 18 && setTarget({ ...target, week });
  const noLine = games.filter(
    (g) => g.state === "pre" && g.probSource === "none",
  ).length;
  const faded = result?.perGame.filter((r) => r.faded).length ?? 0;
  const anyLive = games.some((g) => g.state === "in");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => target && go(target.week - 1)}
            disabled={!target || target.week <= 1}
            aria-label="Previous week"
            className={cn(
              "p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30",
              focusCls,
            )}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <select
            aria-label="Week"
            value={target?.week ?? ""}
            onChange={(e) => go(Number(e.target.value))}
            className={cn(
              "font-display bg-transparent px-1 py-1.5 text-lg font-semibold",
              focusCls,
            )}
          >
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => target && go(target.week + 1)}
            disabled={!target || target.week >= 18}
            aria-label="Next week"
            className={cn(
              "p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30",
              focusCls,
            )}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={runOptimizer}
          disabled={busy || n === 0}
          className={cn(
            "bg-turf-800 hover:bg-turf-900 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-50",
            focusCls,
          )}
        >
          <Sparkles className="size-4" aria-hidden />
          {busy
            ? "Simulating…"
            : settings.hedgeMode
              ? "Optimize picks"
              : "Rank by odds"}
        </button>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50",
            focusCls,
          )}
        >
          <Settings2 className="size-4" aria-hidden />
          {poolCounts
            ? `${board!.pool.name}: ${poolSize} people`
            : `Pool: ${settings.poolSize} people`}
        </button>
        <button
          type="button"
          onClick={() => {
            update(() => ({ office: {}, picks: {}, points: {}, pinned: [] }));
            setResult(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-slate-500 hover:text-slate-800",
            focusCls,
          )}
        >
          <RotateCcw className="size-4" aria-hidden />
          Reset week
        </button>
      </div>

      {showSettings && (
        <div className="mt-3 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">
              People in your pool
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              value={settings.poolSize}
              onChange={(e) =>
                updateSettings({
                  poolSize: Math.max(2, Number(e.target.value) || 2),
                })
              }
              className="w-24 rounded-md border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">
              How your pool numbers picks
            </span>
            <select
              value={settings.scoring}
              onChange={(e) =>
                updateSettings({ scoring: e.target.value as Scoring })
              }
              className="rounded-md border border-slate-300 px-2 py-1.5"
            >
              <option value="rank1-highest">1 = most confident</option>
              <option value="points-equal-rank">
                Highest number = most confident
              </option>
            </select>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={settings.hedgeMode}
              onChange={(e) => updateSettings({ hedgeMode: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-slate-700">
                Play to win the pool
              </span>
              <span className="text-slate-500">
                Fades popular picks when that raises your chance of finishing
                first. Off: straight favourites by odds.
              </span>
            </span>
          </label>
        </div>
      )}

      {me && !me.user && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Your picks are saved in this browser only.{" "}
          <a
            href="/outpost.goauthentik.io/start?rd=/magic-stats/pickem"
            className="text-turf-800 font-semibold underline underline-offset-2"
          >
            Sign in
          </a>{" "}
          to keep them on every device and play in a pool with friends.
        </p>
      )}

      {me?.user && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <CloudCheck className="size-4" aria-hidden />
            {saving ? "Saving…" : `Saved to ${me.user}`}
          </span>
          {me.pools.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={poolId === p.id}
              onClick={() => choosePool(p.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium",
                focusCls,
                poolId === p.id
                  ? "border-turf-950 bg-turf-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
              )}
            >
              <Users className="size-3.5" aria-hidden />
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowPoolForms((v) => !v)}
            aria-expanded={showPoolForms}
            className={cn(
              "text-turf-800 font-medium hover:underline",
              focusCls,
            )}
          >
            {me.pools.length ? "New or join a pool" : "Start or join a pool"}
          </button>
        </div>
      )}
      {showPoolForms && me?.user && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <PoolForms
            onDone={(p) => {
              setShowPoolForms(false);
              choosePool(p.id);
              void refreshMe();
            }}
          />
        </div>
      )}

      {unsaved && n > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Some of these picks are only suggestions and aren&apos;t saved to
            your account yet.
          </span>
          <button
            type="button"
            onClick={() =>
              update((s) => ({
                ...s,
                picks: entry.picks,
                points: entry.points,
              }))
            }
            className={cn(
              "rounded-md bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-950",
              focusCls,
            )}
          >
            Save these picks
          </button>
        </div>
      )}
      {saveError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {saveError}
        </p>
      )}

      {board && me?.user && (
        <div className="mt-4">
          <Leaderboard
            board={board}
            me={me.user}
            games={games}
            onLeave={() => {
              void fetch(`/api/pickem/pools/${board.pool.id}`, {
                method: "DELETE",
              }).then(() => {
                setPoolId(null);
                void refreshMe();
              });
            }}
          />
        </div>
      )}

      {t.started && (
        <section
          aria-label="Your week so far"
          className="mt-4 grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-6"
        >
          <Stat label="Banked" value={t.banked} tone="text-emerald-700" />
          <Stat label="Winning now" value={t.winning} tone="text-emerald-600" />
          <Stat label="Losing now" value={t.losing} tone="text-red-600" />
          <Stat label="Still to play" value={t.toPlay} />
          <Stat label="Expected final" value={t.expected.toFixed(1)} />
          <Stat label="Best case" value={t.max} />
          {anyLive && (
            <p className="col-span-3 text-xs text-slate-500 sm:col-span-6">
              Live win chances from ESPN. Updates every 30 seconds.
            </p>
          )}
        </section>
      )}

      {result && (
        <section className="bg-turf-50 border-turf-100 mt-4 rounded-xl border p-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat
              label="Chance to win the pool"
              value={pct2(result.winProb)}
              tone="text-turf-900"
            />
            <Stat
              label="Straight odds would give"
              value={pct2(result.evWinProb)}
            />
            <Stat label="Even share" value={pct2(1 / settings.poolSize)} />
            <Stat label="Games faded" value={faded} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {result.usedBaseline
              ? "Hedging couldn't beat picking every favourite here, so that's what's shown. That's normal in small pools or before you've entered how your office picked."
              : faded > 0
                ? "Fading a popular pick costs a few expected points on purpose: when the crowd is wrong you pass all of them at once, and only first place pays."
                : "Same picks as straight odds, with the confidence order tuned for your pool."}
          </p>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {noLine > 0 && (
        <p className="mt-3 text-sm text-amber-800">
          {noLine} game{noLine === 1 ? " has" : "s have"} no line yet and count
          as coin flips.
        </p>
      )}

      {loading && !games.length ? (
        <ul className="mt-4 grid gap-3 lg:grid-cols-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <li
              key={i}
              className="h-40 animate-pulse rounded-xl bg-slate-200/60"
            />
          ))}
        </ul>
      ) : games.length === 0 ? (
        <p className="mt-6 text-slate-500">
          No games with odds for this week yet.
        </p>
      ) : (
        <ol className="mt-4 grid gap-3 lg:grid-cols-2">
          {ordered.map((g) => {
            const pts = entry.points[g.id] ?? 1;
            return (
              <GameCard
                key={g.id}
                g={g}
                pick={entry.picks[g.id] ?? "home"}
                points={pts}
                shownRank={shownRank(pts)}
                n={n}
                office={
                  poolCounts?.[g.id] ??
                  state.office[g.id] ?? { home: 0, away: 0 }
                }
                officeFromPool={!!poolCounts}
                result={perGame[g.id]}
                pinned={state.pinned.includes(g.id)}
                locked={locked.has(g.id)}
                onPick={(side) => setPick(g.id, side)}
                onMove={(dir) => move(g.id, dir)}
                onOffice={(o) =>
                  update((s) => ({ ...s, office: { ...s.office, [g.id]: o } }))
                }
                onUnpin={() =>
                  update((s) => ({
                    ...s,
                    pinned: s.pinned.filter((x) => x !== g.id),
                  }))
                }
              />
            );
          })}
        </ol>
      )}
      <Toaster position="bottom-center" />
    </div>
  );
}
