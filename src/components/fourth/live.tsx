"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import type { LiveCall, LiveGame, LiveGameSummary } from "@/lib/fourth/live";
import { cn } from "@/lib/utils";
import { DecisionTable } from "./decision-table";
import { TEAM_NAME } from "./ui";

const GAME_MS = 15_000;
const BOARD_MS = 30_000;

/** Fetch now and then on an interval while `on`; pauses while the tab is hidden. */
function usePoll<T>(url: string | null, every: number, on = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  return { data, error };
}

const name = (t: string) => TEAM_NAME[t] ?? t;

function kickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left text-sm hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none",
        selected ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">
          {g.away} {g.state !== "pre" && g.awayScore}{" "}
          <span className="text-gray-400">at</span> {g.home}{" "}
          {g.state !== "pre" && g.homeScore}
        </span>
        {g.state === "in" && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
            <span className="size-2 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />{" "}
            Live
          </span>
        )}
      </div>
      <div className="text-xs text-gray-600">
        {g.state === "pre" ? kickoff(g.start) : g.detail}
        {g.state === "in" && g.downDistance && ` · ${g.downDistance}`}
      </div>
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
    <div className="border-b border-gray-100 px-4 py-4 last:border-0">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
        <Icon className="size-4" style={{ color }} aria-label={v} />
        <span className="font-medium text-gray-900">{name(c.posteam)}</span>
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
            <span className="font-medium text-gray-900">{did(c)}.</span>
            {v === "right" && (
              <span className="font-semibold text-emerald-700">
                Right call.
              </span>
            )}
            {v === "close" && (
              <span className="font-semibold text-gray-700">
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
        <p className="text-sm text-gray-600">
          Overtime 4th down. {did(c)}. Overtime calls aren&apos;t graded here.
        </p>
      )}
    </div>
  );
}

function GameView({ eventId }: { eventId: string }) {
  const [live, setLive] = useState(true);
  const { data: g, error } = usePoll<LiveGame>(
    `/api/fourth-down?live=${eventId}`,
    GAME_MS,
    live,
  );
  useEffect(() => {
    if (g) setLive(g.state === "in");
  }, [g]);
  if (error)
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        Couldn&apos;t load this game: {error}
      </div>
    );
  if (!g) return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;

  const calls = [...g.calls].reverse();
  const wrong = g.calls.filter((c) => verdictOf(c) === "wrong");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl font-bold text-gray-900">
          {name(g.away)} {g.awayScore}, {name(g.home)} {g.homeScore}
        </h3>
        <span className="text-sm text-gray-600">
          {g.detail}
          {g.state === "in" && ` · updates every ${GAME_MS / 1000} seconds`}
        </span>
      </div>

      {g.state === "in" && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          {g.now ? (
            <>
              <div className="mb-3 text-sm font-semibold text-red-700">
                Right now: {name(g.now.posteam)} face 4th down
              </div>
              <DecisionTable
                d={g.now.decision}
                team={g.now.posteam}
                opp={g.now.defteam}
              />
            </>
          ) : (
            <p className="text-gray-700">
              No 4th down right now. When a team faces one, the call shows up
              here within about 15 seconds.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="font-semibold text-gray-900">4th downs so far</div>
          <div className="text-sm text-gray-600">
            {g.calls.length === 0
              ? "None yet."
              : wrong.length === 0
                ? "No wrong calls yet."
                : `${wrong.length} wrong ${wrong.length === 1 ? "call" : "calls"}: ${wrong.map((c) => name(c.posteam)).join(", ")}.`}{" "}
            Newest first.
          </div>
        </div>
        {calls.map((c) => (
          <CallRow key={c.playId} c={c} />
        ))}
      </div>
    </div>
  );
}

export function Live() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: games, error } = usePoll<LiveGameSummary[]>(
    "/api/fourth-down?live=1",
    BOARD_MS,
  );
  const order = { in: 0, post: 1, pre: 2 } as const;
  const sorted = [...(games ?? [])].sort(
    (a, b) => order[a.state] - order[b.state] || a.start.localeCompare(b.start),
  );
  const selected =
    params.get("event") ??
    sorted.find((g) => g.state === "in")?.eventId ??
    null;
  const pick = (id: string) =>
    router.replace(`${pathname}?tab=live&event=${id}`, { scroll: false });
  const liveCount = sorted.filter((g) => g.state === "in").length;
  const next = sorted.find((g) => g.state === "pre");

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-gray-700">
        {liveCount > 0
          ? `${liveCount} ${liveCount === 1 ? "game is" : "games are"} on now. Pick one to see every 4th down call as it happens.`
          : next
            ? `No games on right now. Next up: ${name(next.away)} at ${name(next.home)}, ${kickoff(next.start)}.${sorted.some((g) => g.state === "post") ? " This week's finished games are in the list too." : ""}`
            : "No games on right now."}
      </p>
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Couldn&apos;t reach the live scores: {error}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-2">
          {sorted.map((g) => (
            <GameButton
              key={g.eventId}
              g={g}
              selected={g.eventId === selected}
              onClick={() => pick(g.eventId)}
            />
          ))}
        </div>
        <div>
          {selected ? (
            <GameView key={selected} eventId={selected} />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-600">
              Pick a game to see its 4th down calls.
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-600">
        Live play-by-play from ESPN. Betting lines and stadium details from
        nflverse. Overtime 4th downs are listed but not graded here.
      </p>
    </div>
  );
}
