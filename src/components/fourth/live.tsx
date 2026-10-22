"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import type { LiveCall, LiveGame, LiveGameSummary } from "@/lib/fourth/live";
import { cn } from "@/lib/utils";
import { DecisionTable } from "./decision-table";
import { TEAM_COLOR, TEAM_NAME } from "./ui";

const GAME_MS = 15_000;
const BOARD_MS = 30_000;

/** Fetch now and then on an interval while `on`; pauses while the tab is hidden. */
function usePoll<T>(url: string | null, every: number, on = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    if (!url) return;
    let stop = false;
    const load = () => {
      if (document.hidden) return;
      fetch(url)
        .then((r) => r.json())
        .then((j: T & { error?: string }) => {
          if (stop) return;
          if (j && typeof j === "object" && "error" in j && j.error)
            setError(j.error);
          else {
            setError(null);
            setData(j);
            setAt(Date.now());
          }
        })
        .catch((e: Error) => !stop && setError(e.message));
    };
    load();
    const t = on ? setInterval(load, every) : undefined;
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      if (t) clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [url, every, on]);
  return { data, error, at };
}

/** "Updated 20s ago", ticking every few seconds. */
function Updated({ at }: { at: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);
  if (at == null) return null;
  const s = Math.max(0, Math.round((now - at) / 1000));
  const ago =
    s < 10
      ? "just now"
      : s < 60
        ? `${s}s ago`
        : `${Math.round(s / 60)} min ago`;
  return (
    <span className="text-sm text-slate-500" aria-live="off">
      Updated {ago}
    </span>
  );
}

const name = (t: string) => TEAM_NAME[t] ?? t;

function kickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const kickTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

/** "Thursday", or "Thursday, Oct 30" when it's more than a week out. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const far = d.getTime() - Date.now() > 6 * 864e5;
  return d.toLocaleDateString(
    undefined,
    far
      ? { weekday: "long", month: "short", day: "numeric" }
      : { weekday: "long" },
  );
}

function TeamChip({ team }: { team: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-5 w-1.5 shrink-0 rounded-full"
      style={{ background: TEAM_COLOR[team] ?? "#64748b" }}
    />
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-px text-[11px] font-semibold text-white">
      <span className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
      Live
    </span>
  );
}

function GameButton({
  g,
  selected,
  onClick,
}: {
  g: LiveGameSummary;
  selected: boolean;
  onClick: () => void;
}) {
  const scored = g.state !== "pre";
  const done = g.state === "post";
  const row = (team: string, score: number, other: number) => {
    const lead = done && score > other;
    return (
      <div className="flex items-center gap-2">
        <TeamChip team={team} />
        <span
          className={cn(
            "font-display flex-1 truncate text-base leading-tight",
            !done || lead
              ? "font-semibold text-slate-900"
              : "font-medium text-slate-500",
          )}
        >
          {name(team)}
        </span>
        {g.possession === team && g.state === "in" && (
          <span
            className="size-1.5 rounded-full bg-amber-700"
            aria-label="has the ball"
          />
        )}
        {scored && (
          <span
            className={cn(
              "font-display text-lg leading-tight tabular-nums",
              !done || lead ? "font-bold text-slate-900" : "text-slate-500",
            )}
          >
            {score}
          </span>
        )}
      </div>
    );
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "focus-visible:outline-turf-700 block w-44 shrink-0 rounded-lg border bg-white px-3 py-2.5 text-left transition hover:shadow-md focus-visible:outline-2 lg:w-full",
        selected
          ? "border-turf-700 ring-turf-700 ring-1"
          : "border-slate-200 hover:border-slate-300",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {row(g.away, g.awayScore, g.homeScore)}
          {row(g.home, g.homeScore, g.awayScore)}
        </div>
        {g.state === "pre" && (
          <span className="shrink-0 text-xs font-medium text-slate-600 tabular-nums">
            {kickTime(g.start)}
          </span>
        )}
      </div>
      {g.state !== "pre" && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
          {g.state === "in" ? (
            <>
              <LivePill />
              <span className="truncate font-medium text-slate-800">
                {g.detail}
              </span>
            </>
          ) : (
            "Final"
          )}
        </div>
      )}
      {g.state === "in" && g.downDistance && (
        <div className="mt-0.5 truncate text-xs text-slate-500">
          {g.downDistance}
        </div>
      )}
    </button>
  );
}

function verdictOf(c: LiveCall) {
  if (!c.decision) return "none" as const;
  if (c.decision.best === c.actual) return "right" as const;
  return c.cost > -1 ? ("close" as const) : ("wrong" as const);
}

function did(c: LiveCall) {
  return c.actual === "go"
    ? "Went for it"
    : c.actual === "fg"
      ? "Kicked a field goal"
      : "Punted";
}

function CallRow({ c }: { c: LiveCall }) {
  const v = verdictOf(c);
  const Icon = v === "right" ? Check : v === "wrong" ? X : Minus;
  const color =
    v === "right" ? "#059669" : v === "wrong" ? "#dc2626" : "#9ca3af";
  return (
    <div className="border-b border-slate-100 px-4 py-4 last:border-0">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-600">
        <Icon className="size-4" style={{ color }} aria-label={v} />
        <span className="font-display text-base font-semibold text-slate-900">
          {name(c.posteam)}
        </span>
        <span>
          {c.qtr > 4 ? "OT" : `Q${c.qtr}`}, {c.time} left
        </span>
      </div>
      {c.decision ? (
        <>
          <DecisionTable
            d={c.decision}
            team={c.posteam}
            opp={c.defteam}
            actual={c.actual}
            compact
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
            <span className="font-medium text-slate-900">{did(c)}.</span>
            {v === "right" && (
              <span className="font-semibold text-emerald-700">
                Right call.
              </span>
            )}
            {v === "close" && (
              <span className="font-semibold text-slate-700">
                A coin flip either way.
              </span>
            )}
            {v === "wrong" && (
              <span className="font-semibold text-red-700">
                Wrong call, cost {Math.max(1, Math.round(-c.cost))}% in chance
                to win.
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Overtime 4th down. {did(c)}. Overtime calls aren&apos;t graded here.
        </p>
      )}
    </div>
  );
}

function ScoreHeader({ g, at }: { g: LiveGame; at: number | null }) {
  const side = (team: string, score: number, other: number) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <TeamChip team={team} />
      <span className="font-display min-w-0 flex-1 truncate text-2xl leading-tight font-semibold text-slate-900 sm:text-3xl">
        {name(team)}
      </span>
      <span
        className={cn(
          "font-display text-3xl leading-tight font-bold tabular-nums sm:text-4xl",
          g.state === "post" && score < other
            ? "text-slate-400"
            : "text-slate-900",
        )}
      >
        {g.state === "pre" ? "" : score}
      </span>
    </div>
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {g.state === "in" && <LivePill />}
        <span className="font-medium text-slate-700">
          {g.state === "post"
            ? "Final"
            : g.state === "pre"
              ? `Kicks off ${g.detail}`
              : g.detail}
        </span>
        {g.state === "in" && (
          <span className="ml-auto">
            <Updated at={at} />
          </span>
        )}
      </div>
      <div className="space-y-1">
        {side(g.away, g.awayScore, g.homeScore)}
        {side(g.home, g.homeScore, g.awayScore)}
      </div>
    </div>
  );
}

function GameView({ eventId }: { eventId: string }) {
  const [live, setLive] = useState(true);
  const {
    data: g,
    error,
    at,
  } = usePoll<LiveGame>(`/api/fourth-down?live=${eventId}`, GAME_MS, live);
  useEffect(() => {
    if (g) setLive(g.state === "in");
  }, [g]);
  if (error)
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        Couldn&apos;t load this game: {error}
      </div>
    );
  if (!g)
    return <div className="h-64 animate-pulse rounded-lg bg-slate-200/70" />;

  const calls = [...g.calls].reverse();
  const wrong = g.calls.filter((c) => verdictOf(c) === "wrong");
  return (
    <div className="space-y-4">
      <ScoreHeader g={g} at={at} />

      {g.state === "in" && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          {g.now ? (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-700">
                <LivePill /> Right now: {name(g.now.posteam)} face 4th down
              </div>
              <DecisionTable
                d={g.now.decision}
                team={g.now.posteam}
                opp={g.now.defteam}
              />
            </>
          ) : (
            <p className="text-slate-700">
              No 4th down right now. When a team faces one, the call shows up
              here within about {GAME_MS / 1000} seconds.
            </p>
          )}
        </div>
      )}

      {g.state === "pre" ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600">
          This game hasn&apos;t started. Its 4th down calls show up here once it
          kicks off.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-display text-xl font-semibold text-slate-900">
              4th downs so far
            </h3>
            <div className="text-sm text-slate-600">
              {g.calls.length === 0
                ? "None yet."
                : wrong.length === 0
                  ? "No wrong calls yet."
                  : `${wrong.length} wrong ${wrong.length === 1 ? "call" : "calls"}: ${wrong.map((c) => name(c.posteam)).join(", ")}.`}{" "}
              {g.calls.length > 1 && "Newest first."}
            </div>
          </div>
          {calls.map((c) => (
            <CallRow key={c.playId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

type Group = { key: string; label: string; games: LiveGameSummary[] };

/** Live games, then finished, then upcoming by day. */
function groupGames(sorted: LiveGameSummary[]): Group[] {
  const groups: Group[] = [];
  const add = (key: string, label: string, g: LiveGameSummary) => {
    const last = groups.at(-1);
    if (last?.key === key) last.games.push(g);
    else groups.push({ key, label, games: [g] });
  };
  for (const g of sorted) {
    if (g.state === "in") add("in", "On now", g);
    else if (g.state === "post") add("post", "Final", g);
    else {
      const label = dayLabel(g.start);
      add(`pre-${label}`, label, g);
    }
  }
  return groups;
}

export function Live() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const {
    data: games,
    error,
    at,
  } = usePoll<LiveGameSummary[]>("/api/fourth-down?live=1", BOARD_MS);
  const order = { in: 0, post: 1, pre: 2 } as const;
  const sorted = [...(games ?? [])].sort(
    (a, b) => order[a.state] - order[b.state] || a.start.localeCompare(b.start),
  );
  // with no game picked, open the first one being played
  const selected =
    params.get("event") ??
    sorted.find((g) => g.state === "in")?.eventId ??
    null;
  const pick = (id: string) =>
    router.replace(`${pathname}?tab=live&event=${id}`, { scroll: false });
  const liveCount = sorted.filter((g) => g.state === "in").length;
  const next = sorted.find((g) => g.state === "pre");
  const groups = groupGames(sorted);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="max-w-3xl text-slate-700">
          {games === null
            ? "Loading this week's games."
            : liveCount > 0
              ? `${liveCount} ${liveCount === 1 ? "game is" : "games are"} on now. Pick one to see every 4th down call as it happens.`
              : next
                ? `No games on right now. Next up: ${name(next.away)} at ${name(next.home)}, ${kickoff(next.start)}.${sorted.some((g) => g.state === "post") ? " This week's finished games are in the list too." : ""}`
                : "No games on right now."}
        </p>
        <Updated at={at} />
      </div>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t reach the live scores: {error}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav
          aria-label="This week's games"
          className="nfl-scroll-fade -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 lg:sticky lg:top-4 lg:mx-0 lg:block lg:max-h-[calc(100vh-2rem)] lg:space-y-5 lg:overflow-y-auto lg:px-0 lg:pb-0"
        >
          {games === null &&
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-[86px] w-44 shrink-0 animate-pulse rounded-lg bg-slate-200/70 lg:mb-2 lg:w-full"
              />
            ))}
          {groups.map((grp) => (
            <section key={grp.key} className="shrink-0">
              <h3 className="font-display mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                {grp.key === "in" && (
                  <span className="size-2 rounded-full bg-red-600" />
                )}
                {grp.label}
              </h3>
              <div className="flex gap-2 lg:flex-col">
                {grp.games.map((g) => (
                  <GameButton
                    key={g.eventId}
                    g={g}
                    selected={g.eventId === selected}
                    onClick={() => pick(g.eventId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="min-w-0">
          {selected ? (
            <GameView key={selected} eventId={selected} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-600">
              {next ? (
                <>
                  <div className="font-display text-2xl font-semibold text-slate-900">
                    Next up: {name(next.away)} at {name(next.home)}
                  </div>
                  <div className="mt-1">
                    {kickoff(next.start)}. Every 4th down call shows up here
                    once a game kicks off. Pick a game to follow it.
                  </div>
                </>
              ) : (
                "Pick a game to see its 4th down calls."
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Live play-by-play from ESPN. Betting lines and stadium details from
        nflverse. Overtime 4th downs are listed but not graded here.
      </p>
    </div>
  );
}
