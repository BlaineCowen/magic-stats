"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Coach, CoachReport } from "@/lib/fourth/coaches";
import { cn } from "@/lib/utils";
import { yardText } from "./decision-card";
import { CHOICE, CHOICE_COLOR, Expand, teamPhrase } from "./ui";

const DEFAULT_COACH = "DeMeco Ryans";

/** Hand-written detail for coaches with a study written up, shown under "Why we say that". */
const NOTES: Record<string, React.ReactNode> = {
  "DeMeco Ryans": (
    <>
      <p>
        Almost all of it is caution. Of everything his 4th down calls gave away,
        85% came from kicking or punting when going for it was better. In four
        seasons he has made only 3 costly calls by being too aggressive.
      </p>
      <p>
        His most expensive habit is kicking field goals on short yardage near
        the goal line: 21 times inside the 10 when going for it was better,
        worth about 0.6 wins on their own.
      </p>
      <p>
        It isn&apos;t getting better. He gave away about 0.8 wins in 2023, 0.75
        in 2024 and 1.2 in 2025, and 2026 is on a similar pace. In the playoffs
        (3 wins, 3 losses, all three losses in the divisional round) one example
        is a field goal on 4th &amp; 2 from the New England 7 while down 11 in
        the third quarter of the 2025 loss.
      </p>
      <p className="text-xs text-gray-600">
        Ben Baldwin&apos;s nfl4th, which values going for it a little less, puts
        his total at about 1.7 wins, still in the bottom fifth of the league.
        The single biggest call on his list, a 58-yard try against Detroit tied
        with 1:56 left, is where the two models disagree most. These totals add
        up how much each call cost on average; they aren&apos;t games he
        actually lost.
      </p>
    </>
  ),
};

const wins = (pts: number) => -pts / 100;
const fmtWins = (pts: number) => {
  const w = wins(pts);
  return w >= 0.95 ? `${w.toFixed(1)} wins` : `${w.toFixed(1)} of a win`;
};
const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

/** Plain-English one-liner about a coach's 4th down style. */
function styleLine(c: Coach, report: CoachReport): string {
  const n = report.coaches.length;
  const goRate = c.wentInStrongGoSpots / Math.max(1, c.strongGoSpots);
  const leagueGo =
    report.league.wentInStrongGoSpots /
    Math.max(1, report.league.strongGoSpots);
  if (c.rank <= Math.ceil(n / 4))
    return "One of the best 4th down decision makers in the league.";
  if (c.aggressiveLost < c.passiveLost * 0.5 && c.aggressiveLost < -20)
    return "Goes for it too often.";
  if (goRate < leagueGo - 0.08) return "Plays it too safe on 4th down.";
  if (c.rank > n - Math.ceil(n / 4))
    return "Among the worst 4th down decision makers in the league.";
  return "About average on 4th down.";
}

function Leaderboard({
  report,
  selected,
  onSelect,
}: {
  report: CoachReport;
  selected: string;
  onSelect: (c: string) => void;
}) {
  const [sort, setSort] = useState<"perGame" | "wins">("wins");
  const [mostFirst, setMostFirst] = useState(true);
  const value = (c: Coach) =>
    sort === "perGame" ? -c.lostPerGame : wins(c.lost);
  const rows = useMemo(
    () =>
      [...report.coaches].sort((a, b) =>
        mostFirst ? value(b) - value(a) : value(a) - value(b),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, sort, mostFirst],
  );
  const max = Math.max(...report.coaches.map(value));
  const list = useRef<HTMLDivElement>(null);
  // keep the selected coach visible in the scrolling list
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(
      "[data-selected=true]",
    );
    if (row && list.current)
      list.current.scrollTop = row.offsetTop - list.current.clientHeight / 2;
  }, [selected, sort, mostFirst]);
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="space-y-2 border-b border-gray-100 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">
          Every head coach
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-hidden rounded-md border border-gray-300 text-xs">
            {(
              [
                ["wins", "Wins given away"],
                ["perGame", "Per game"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                className={cn(
                  "flex-1 px-2 py-1",
                  sort === k
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMostFirst((v) => !v)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            {mostFirst ? "Worst first" : "Best first"}
          </button>
        </div>
        <div className="text-xs text-gray-600">
          {sort === "wins"
            ? `Wins given away by 4th down calls since ${report.seasons[0]}`
            : "Chance to win given away per game, on average"}
        </div>
      </div>
      <div ref={list} className="relative max-h-[34rem] overflow-y-auto">
        {rows.map((c, i) => (
          <button
            key={c.coach}
            type="button"
            data-selected={c.coach === selected}
            onClick={() => onSelect(c.coach)}
            className={cn(
              "grid w-full grid-cols-[1.75rem_1fr_4.5rem] items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-slate-50",
              c.coach === selected && "bg-blue-50 hover:bg-blue-50",
            )}
          >
            <span className="text-xs text-gray-500 tabular-nums">{i + 1}</span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate",
                  c.coach === selected
                    ? "font-semibold text-blue-800"
                    : "text-gray-800",
                )}
              >
                {c.coach}{" "}
                <span className="text-xs font-normal text-gray-500">
                  {c.teams.join("/")}
                </span>
              </span>
              <span className="block h-1.5 rounded-full bg-gray-100">
                <span
                  className="block h-1.5 rounded-full bg-red-400"
                  style={{ width: `${(value(c) / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="text-right text-xs text-gray-700 tabular-nums">
              {sort === "wins"
                ? value(c).toFixed(1)
                : `${value(c).toFixed(1)}%`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function situation(d: Coach["worst"][number]) {
  const togo = d.ydstogo >= d.yardline ? "goal" : d.ydstogo;
  const score =
    d.scoreDiff === 0
      ? "tied"
      : d.scoreDiff > 0
        ? `up ${d.scoreDiff}`
        : `down ${-d.scoreDiff}`;
  return `4th & ${togo} at ${yardText(d.yardline, d.team, d.opp)}, ${score}`;
}

function did(d: Coach["worst"][number]) {
  if (d.actual === "go")
    return `Went for it${d.worked == null ? "" : d.worked ? " (made it)" : " (stopped)"}`;
  if (d.actual === "fg")
    return `Kicked a field goal${d.worked == null ? "" : d.worked ? " (good)" : " (missed)"}`;
  return "Punted";
}

/** Two bars: how often this coach goes for it when he should, against the league. */
function GoRate({ c, report }: { c: Coach; report: CoachReport }) {
  const mine = c.wentInStrongGoSpots / Math.max(1, c.strongGoSpots);
  const league =
    report.league.wentInStrongGoSpots /
    Math.max(1, report.league.strongGoSpots);
  const last = c.coach.split(" ").at(-1);
  return (
    <div>
      <div className="font-medium text-gray-900">
        When going for it was clearly right, how often did he go?
      </div>
      <div className="mt-3 space-y-2">
        {(
          [
            [last, mine, CHOICE_COLOR.go],
            ["League", league, "#94a3b8"],
          ] as const
        ).map(([label, v, color]) => (
          <div
            key={label}
            className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm"
          >
            <span className="text-gray-700">{label}</span>
            <div className="h-3.5 rounded-full bg-gray-100">
              <div
                className="h-3.5 rounded-full"
                style={{ width: `${v * 100}%`, background: color }}
              />
            </div>
            <span className="text-right font-semibold tabular-nums">
              {Math.round(v * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-gray-600">
        {c.wentInStrongGoSpots} of {c.strongGoSpots} times
      </div>
    </div>
  );
}

function CoachDetail({ c, report }: { c: Coach; report: CoachReport }) {
  const n = report.coaches.length;
  const byTotal =
    [...report.coaches]
      .sort((a, b) => a.lost - b.lost)
      .findIndex((x) => x.coach === c.coach) + 1;
  const team = teamPhrase(c.teams);
  const totalRank =
    byTotal === 1
      ? "the most of any coach in the league"
      : byTotal <= n / 2
        ? `the ${ordinal(byTotal)} most in the league`
        : `fewer than most coaches`;
  const parts = [
    {
      key: "passive",
      label: "Played it safe when he should have gone for it",
      v: c.passiveLost,
      color: CHOICE_COLOR.go,
    },
    {
      key: "aggressive",
      label: "Went for it when he should have kicked",
      v: c.aggressiveLost,
      color: CHOICE_COLOR.fg,
    },
    {
      key: "other",
      label: "Picked the wrong kind of kick",
      v: c.otherLost,
      color: CHOICE_COLOR.punt,
    },
  ].filter((p) => p.v < 0);
  const mistakeTotal = parts.reduce((a, p) => a + p.v, 0) || -1;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">{c.coach}</h3>
        <p className="mt-1 text-xl leading-snug font-semibold text-gray-900">
          {styleLine(c, report)}
        </p>
        <p className="mt-2 max-w-2xl text-gray-700">
          His 4th down calls have cost {team} about <b>{fmtWins(c.lost)}</b>{" "}
          since {report.seasons[0]} ({c.games} games), {totalRank}. Per game he
          ranks {ordinal(c.rank)} of {n}.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <GoRate c={c} report={report} />
      </div>

      <div className="space-y-1 border-t border-gray-200 pt-3">
        {NOTES[c.coach] && (
          <Expand label="Why we say that">
            <div className="max-w-2xl space-y-2 text-sm leading-relaxed text-gray-700">
              {NOTES[c.coach]}
            </div>
          </Expand>
        )}

        <Expand label="His most costly calls">
          <div className="rounded-md border border-gray-200 bg-white">
            {c.worst.map((d) => (
              <a
                key={`${d.gameId}-${d.qtr}-${d.time}`}
                href={`?tab=game&season=${d.season}&id=${d.gameId}&focus=${d.team}`}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-100 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50"
              >
                <span>
                  <span className="text-gray-900">{situation(d)}</span>
                  <span className="block text-xs text-gray-600">
                    {d.season} {d.post ? "playoffs" : `week ${d.week}`} vs{" "}
                    {d.opp}, {d.qtr > 4 ? "OT" : `Q${d.qtr}`} {d.time}. {did(d)}
                    .
                  </span>
                </span>
                <span className="text-right">
                  <span
                    className="font-medium"
                    style={{ color: CHOICE_COLOR[d.best] }}
                  >
                    Should{" "}
                    {d.best === "go"
                      ? "go for it"
                      : d.best === "fg"
                        ? "kick"
                        : "punt"}
                  </span>
                  <span className="block text-xs text-red-700">
                    cost {Math.round(-d.cost)}% chance to win
                  </span>
                </span>
              </a>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Tap a call to see the whole game.
          </p>
        </Expand>

        <Expand label="Season by season">
          <table className="w-full max-w-lg text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-600">
                <th className="py-1 font-medium">Season</th>
                <th className="py-1 font-medium">Games</th>
                <th className="py-1 font-medium">Wins given away</th>
                <th className="py-1 text-right font-medium">nfl4th says</th>
              </tr>
            </thead>
            <tbody>
              {c.seasons.map((s) => (
                <tr key={s.season} className="border-t border-gray-100">
                  <td className="py-1.5">{s.season}</td>
                  <td className="py-1.5 tabular-nums">{s.games}</td>
                  <td className="py-1.5 tabular-nums">
                    {wins(s.lost).toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right text-gray-600 tabular-nums">
                    {wins(s.nfl4thLost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-gray-600">
            &ldquo;nfl4th says&rdquo; grades the same plays with Ben
            Baldwin&apos;s published numbers.
          </p>
        </Expand>

        <Expand label="What kind of mistakes">
          <div className="max-w-lg">
            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
              {parts.map((p) => (
                <div
                  key={p.key}
                  style={{
                    width: `${(p.v / mistakeTotal) * 100}%`,
                    background: p.color,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 space-y-1 text-sm">
              {parts.map((p) => (
                <div key={p.key} className="flex justify-between gap-3">
                  <span className="flex items-center gap-2 text-gray-700">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{ background: p.color }}
                    />
                    {p.label}
                  </span>
                  <span className="text-gray-900 tabular-nums">
                    {Math.round((p.v / mistakeTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Expand>
      </div>
    </div>
  );
}

export function Coaches() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [report, setReport] = useState<CoachReport | null>(null);
  const selected = params.get("coach") ?? DEFAULT_COACH;

  useEffect(() => {
    fetch("/api/fourth-down?coaches=1")
      .then((r) => r.json())
      .then(setReport)
      .catch(() => undefined);
  }, []);

  const coach = useMemo(
    () =>
      report?.coaches.find((c) => c.coach === selected) ?? report?.coaches[0],
    [report, selected],
  );
  if (!report || !coach)
    return <div className="h-96 animate-pulse rounded-lg bg-gray-100" />;

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-gray-700">
        Every 4th down since {report.seasons[0]}, graded the same way. When a
        coach picks something other than the best choice, his team&apos;s chance
        to win drops a little. Add those drops up and you get how many wins his
        4th down calls have given away.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <CoachDetail c={coach} report={report} />
        <Leaderboard
          report={report}
          selected={coach.coach}
          onSelect={(c) =>
            router.replace(
              `${pathname}?tab=coaches&coach=${encodeURIComponent(c)}`,
              { scroll: false },
            )
          }
        />
      </div>
      <p className="text-xs text-gray-600">
        Data through {report.through}, playoffs included, overtime not included.
        Coaches with at least {report.minGames} games. {CHOICE.go}, field goal
        and punt odds come from the model on the How it works tab.
      </p>
    </div>
  );
}
