"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Minus, X } from "lucide-react";
import type { LiveCall, LiveGame, LiveGameSummary } from "@/lib/fourth/live";
import { cn } from "@/lib/utils";
import { yardText } from "./decision-card";
import {
  CHOICE,
  CHOICE_COLOR,
  ChanceBars,
  Expand,
  StrengthTag,
  TEAM_NAME,
  verdictLine,
} from "./ui";

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
  const s = c.decision?.situation;
  const Icon = v === "right" ? Check : v === "wrong" ? X : Minus;
  const color =
    v === "right" ? "#059669" : v === "wrong" ? "#dc2626" : "#9ca3af";
  return (
    <div className="border-b border-gray-100 px-3 py-2.5 last:border-0">
      <div className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-3 text-sm">
        <Icon className="mt-0.5 size-4" style={{ color }} aria-label={v} />
        <span>
          <span className="font-medium text-gray-900">{name(c.posteam)}</span>{" "}
          {s ? (
            <span className="text-gray-700">
              4th &amp; {s.ydstogo >= s.yardline ? "goal" : s.ydstogo} at{" "}
              {yardText(s.yardline, c.posteam, c.defteam)}
            </span>
          ) : (
            <span className="text-gray-700">overtime 4th down</span>
          )}
          <span className="block text-xs text-gray-600">
            {c.qtr > 4 ? "OT" : `Q${c.qtr}`} {c.time}. {did(c)}.
          </span>
        </span>
        <span className="text-right whitespace-nowrap">
          {v === "right" && (
            <span className="text-emerald-700">Right call</span>
          )}
          {v === "close" && <span className="text-gray-600">Coin flip</span>}
          {v === "wrong" && (
            <span className="text-red-700">
              Should{" "}
              {c.decision!.best === "go"
                ? "go for it"
                : c.decision!.best === "fg"
                  ? "kick"
                  : "punt"}
              <span className="block text-xs text-gray-600">
                cost {Math.max(1, Math.round(-c.cost))}% chance to win
              </span>
            </span>
          )}
        </span>
      </div>
      {c.decision && (
        <Expand label="Numbers" className="mt-1 pl-8">
          <div className="max-w-md">
            <ChanceBars
              options={c.decision.options.map((o) => ({
                key: o.key,
                wp: o.wp,
              }))}
              best={c.decision.best}
              actual={c.actual}
              size="sm"
            />
          </div>
        </Expand>
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
              <div className="text-sm text-gray-600">
                Right now: {name(g.now.posteam)} face {g.now.text}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span
                  className="text-3xl font-bold"
                  style={{ color: CHOICE_COLOR[g.now.decision.best] }}
                >
                  {CHOICE[g.now.decision.best]}
                </span>
                <StrengthTag strength={g.now.decision.strength} />
              </div>
              <p className="mt-1 text-gray-700">
                {verdictLine(
                  g.now.decision.options.map((o) => ({ key: o.key, wp: o.wp })),
                  g.now.decision.best,
                )}
              </p>
              <div className="mt-4 max-w-xl">
                <ChanceBars
                  options={g.now.decision.options.map((o) => ({
                    key: o.key,
                    wp: o.wp,
                  }))}
                  best={g.now.decision.best}
                />
              </div>
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
