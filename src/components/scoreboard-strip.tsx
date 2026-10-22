"use client";

import { useEffect, useState } from "react";
import type { LiveGameSummary } from "@/lib/fourth/live";
import { TEAM_COLOR } from "@/components/fourth/ui";
import { cn } from "@/lib/utils";

const kickoff = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** This week's games from ESPN, live ones first. Each opens its 4th down calls. */
export function ScoreboardStrip() {
  const [games, setGames] = useState<LiveGameSummary[] | null>(null);

  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/fourth-down?live=1")
        .then((r) => r.json())
        .then(
          (g: LiveGameSummary[]) =>
            !stop && setGames(Array.isArray(g) ? g : []),
        )
        .catch(() => !stop && setGames([]));
    void load();
    // scores move during games; refresh every minute while the page is open
    const id = setInterval(() => void load(), 60_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  if (games === null)
    return (
      <div className="flex gap-2 overflow-hidden" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-[74px] w-40 shrink-0 animate-pulse rounded-lg bg-white/10"
          />
        ))}
      </div>
    );
  if (games.length === 0)
    return (
      <p className="text-turf-100/80 text-sm">
        No games on the schedule this week.
      </p>
    );

  const order = { in: 0, pre: 1, post: 2 } as const;
  const sorted = [...games].sort(
    (a, b) => order[a.state] - order[b.state] || a.start.localeCompare(b.start),
  );
  const liveCount = games.filter((g) => g.state === "in").length;

  return (
    <div>
      <div className="text-turf-100/80 mb-2 text-sm">
        {liveCount > 0
          ? `${liveCount} game${liveCount > 1 ? "s" : ""} on now. Tap one for its 4th down calls.`
          : "This week's games. Tap one for its 4th down calls."}
      </div>
      <ul className="nfl-scroll-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {sorted.map((g) => {
          const team = (t: string, score: number) => (
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3.5 w-1 rounded-full"
                style={{ background: TEAM_COLOR[t] ?? "#94a3b8" }}
              />
              <span className="font-display flex-1 text-base font-semibold">
                {t}
              </span>
              {g.state !== "pre" && (
                <span className="font-display text-base font-bold tabular-nums">
                  {score}
                </span>
              )}
            </div>
          );
          return (
            <li key={g.eventId} className="shrink-0">
              <a
                href={`/magic-stats/fourth-down?tab=live&event=${g.eventId}`}
                className={cn(
                  "focus-visible:outline-line block w-40 rounded-lg px-3 py-2 transition focus-visible:outline-2",
                  g.state === "in"
                    ? "bg-white text-slate-900 hover:bg-white/90"
                    : "bg-white/8 text-white hover:bg-white/15",
                )}
              >
                {team(g.away, g.awayScore)}
                {team(g.home, g.homeScore)}
                <div
                  className={cn(
                    "mt-1 truncate text-xs",
                    g.state === "in"
                      ? "font-semibold text-red-700"
                      : "text-turf-100/70",
                  )}
                >
                  {g.state === "pre"
                    ? kickoff(g.start)
                    : g.state === "in"
                      ? g.detail
                      : "Final"}
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
