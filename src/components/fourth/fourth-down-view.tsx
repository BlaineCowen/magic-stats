"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { safeSituation } from "@/lib/fourth/params";
import type { GameListItem } from "@/lib/fourth/games";
import type { LiveGameSummary } from "@/lib/fourth/live";
import { cn } from "@/lib/utils";
import { Calculator } from "./calculator";
import { GameStudy } from "./game-study";
import { Method } from "./method";
import { Coaches } from "./coaches";
import { Live } from "./live";
import { TEAM_COLOR, TEAM_NAME } from "./ui";

const TABS = [
  { key: "live", label: "Live" },
  { key: "coaches", label: "Coaches" },
  { key: "calculator", label: "Calculator" },
  { key: "game", label: "Game finder" },
  { key: "method", label: "How it works" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

// NFL seasons start in September, so before August the latest season is last year's
const NOW = new Date();
const CURRENT_SEASON =
  NOW.getMonth() >= 7 ? NOW.getFullYear() : NOW.getFullYear() - 1;

const weekLabel = (w: number) =>
  w <= 18
    ? `Week ${w}`
    : (["Wild card", "Divisional", "Conference", "Super Bowl"][w - 19] ??
      `Week ${w}`);

function TeamChip({ team }: { team: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-6 w-1.5 shrink-0 rounded-full"
      style={{ background: TEAM_COLOR[team] ?? "#64748b" }}
    />
  );
}

function GameCard({
  g,
  selected,
  onPick,
}: {
  g: GameListItem;
  selected: boolean;
  onPick: () => void;
}) {
  const done = g.homeScore != null && g.awayScore != null;
  const row = (team: string, score: number | null, won: boolean) => (
    <div className="flex items-center gap-2">
      <TeamChip team={team} />
      <span
        className={cn(
          "font-display flex-1 text-lg leading-tight",
          won ? "font-bold text-slate-900" : "font-medium text-slate-600",
        )}
      >
        {TEAM_NAME[team] ?? team}
      </span>
      <span
        className={cn(
          "font-display text-lg tabular-nums",
          won ? "font-bold text-slate-900" : "text-slate-500",
        )}
      >
        {score ?? ""}
      </span>
    </div>
  );
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        "focus-visible:outline-turf-700 w-full rounded-lg border bg-white p-3 text-left transition hover:-translate-y-px hover:shadow-md focus-visible:outline-2",
        selected
          ? "border-turf-700 ring-turf-700 ring-1"
          : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="space-y-1">
        {row(g.away, g.awayScore, done && g.awayScore! > g.homeScore!)}
        {row(g.home, g.homeScore, done && g.homeScore! > g.awayScore!)}
      </div>
    </button>
  );
}

function GameFinder() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [season, setSeason] = useState(
    Number(params.get("season") ?? CURRENT_SEASON),
  );
  const [games, setGames] = useState<GameListItem[] | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [team, setTeam] = useState("");
  const gameId = params.get("id");

  useEffect(() => {
    setGames(null);
    fetch(`/api/fourth-down?games=${season}`)
      .then((r) => r.json())
      .then((g: GameListItem[]) => {
        const list = Array.isArray(g) ? g : [];
        setGames(list);
        // open on the selected game's week, or the latest week played
        const sel = list.find((x) => x.gameId === gameId);
        setWeek(sel?.week ?? list.at(-1)?.week ?? null);
      })
      .catch(() => setGames([]));
    // gameId only seeds the first week; changing games shouldn't refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const weeks = useMemo(
    () => [...new Set((games ?? []).map((g) => g.week))],
    [games],
  );
  const teams = useMemo(
    () =>
      [...new Set((games ?? []).flatMap((g) => [g.home, g.away]))].sort(
        (a, b) => (TEAM_NAME[a] ?? a).localeCompare(TEAM_NAME[b] ?? b),
      ),
    [games],
  );
  const shown = (games ?? []).filter((g) =>
    team ? g.home === team || g.away === team : g.week === week,
  );
  const sel = games?.find((g) => g.gameId === gameId);

  const pick = (id: string) => {
    router.replace(`${pathname}?tab=game&season=${season}&id=${id}`, {
      scroll: false,
    });
    requestAnimationFrame(() =>
      document
        .getElementById("game-study")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const seasons = Array.from(
    { length: CURRENT_SEASON - 1999 + 1 },
    (_, i) => CURRENT_SEASON - i,
  );
  const selectCls =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-turf-700";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={selectCls}
          value={season}
          onChange={(e) => {
            setSeason(Number(e.target.value));
            setTeam("");
          }}
          aria-label="Season"
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s} season
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          aria-label="Team"
        >
          <option value="">Every team</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {TEAM_NAME[t] ?? t}
            </option>
          ))}
        </select>
        {sel && (
          <span className="text-sm text-slate-500">
            Showing {TEAM_NAME[sel.away] ?? sel.away} at{" "}
            {TEAM_NAME[sel.home] ?? sel.home}, {weekLabel(sel.week)}
          </span>
        )}
      </div>

      {!team && weeks.length > 0 && (
        <div
          className="nfl-scroll-fade -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          role="tablist"
          aria-label="Week"
        >
          {weeks.map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={w === week}
              onClick={() => setWeek(w)}
              className={cn(
                "font-display shrink-0 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap transition",
                w === week
                  ? "border-turf-950 bg-turf-950 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400",
              )}
            >
              {w <= 18 ? w : weekLabel(w)}
            </button>
          ))}
        </div>
      )}

      {games === null ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-lg bg-slate-200/70"
            />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600">
          No games with play-by-play for {season} yet. Pick an earlier season.
        </p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((g) => (
            <div key={g.gameId}>
              {team && (
                <div className="mb-1 text-xs font-medium text-slate-500">
                  {weekLabel(g.week)}
                </div>
              )}
              <GameCard
                g={g}
                selected={g.gameId === gameId}
                onPick={() => pick(g.gameId)}
              />
            </div>
          ))}
        </div>
      )}

      {gameId && (
        <div id="game-study" className="scroll-mt-4 pt-2">
          <GameStudy
            gameId={gameId}
            focus={params.get("focus") ?? sel?.home ?? gameId.split("_")[3]!}
          />
        </div>
      )}
    </div>
  );
}

export function FourthDownView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: TabKey =
    TABS.find((t) => t.key === params.get("tab"))?.key ?? "coaches";
  const [liveNow, setLiveNow] = useState(false);

  // a dot on the Live tab while any game is being played
  useEffect(() => {
    fetch("/api/fourth-down?live=1")
      .then((r) => r.json())
      .then((g: LiveGameSummary[]) =>
        setLiveNow(Array.isArray(g) && g.some((x) => x.state === "in")),
      )
      .catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          4th down decisions
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Go for it, kick or punt? Each choice gets a chance to win the game,
          and the highest one is the call.
        </p>
      </header>
      <div
        role="tablist"
        aria-label="4th down sections"
        className="nfl-scroll-fade -mx-4 mb-7 flex gap-6 overflow-x-auto border-b border-slate-300 px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() =>
              router.replace(`${pathname}?tab=${t.key}`, { scroll: false })
            }
            className={cn(
              "font-display focus-visible:outline-turf-700 -mb-px flex items-center gap-1.5 border-b-[3px] pb-2 text-lg font-semibold whitespace-nowrap transition-colors focus-visible:outline-2",
              tab === t.key
                ? "border-line text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.key === "live" && liveNow && (
              <span className="relative flex size-2" aria-label="games on now">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-red-600" />
              </span>
            )}
            {t.label}
          </button>
        ))}
      </div>
      {tab === "calculator" && <Calculator initial={safeSituation(params)} />}
      {tab === "coaches" && <Coaches />}
      {tab === "live" && <Live />}
      {tab === "game" && <GameFinder />}
      {tab === "method" && <Method />}
    </main>
  );
}
