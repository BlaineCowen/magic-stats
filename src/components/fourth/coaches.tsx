"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Coach, CoachReport } from "@/lib/fourth/coaches";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { yardText } from "./decision-card";
import { DecisionTable, SureTag } from "./decision-table";
import { MiniField } from "./field";
import {
  CHOICE,
  CHOICE_COLOR,
  Expand,
  TEAM_NAME,
  teamInfo,
  teamPhrase,
} from "./ui";

const DEFAULT_COACH = "DeMeco Ryans";
/** Costly calls shown before "Show all". */
const TOP_CALLS = 5;

/** Hand-written detail for coaches with a study written up, shown under "Why we say that". */
const NOTES: Record<string, React.ReactNode> = {
  "DeMeco Ryans": (
    <>
      <p>
        Almost all of it is caution. Of everything his 4th down calls gave away,
        89% came from kicking or punting when going for it was better. In four
        seasons he has made only 3 costly calls by being too aggressive.
      </p>
      <p>
        His most expensive habit is kicking field goals on short yardage near
        the goal line: 21 times inside the 10 when going for it was better,
        worth about 0.7 wins on their own.
      </p>
      <p>
        It isn&apos;t getting better. He gave away about 0.9 wins in 2023, 0.9
        in 2024 and 1.4 in 2025, and 2026 is on a similar pace. In the playoffs
        (3 wins, 3 losses, all three losses in the divisional round) one example
        is a field goal on 4th &amp; 2 from the New England 7 while down 11 in
        the third quarter of the 2025 loss.
      </p>
      <p className="text-xs text-slate-600">
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
  const [query, setQuery] = useState("");
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
  const q = query.trim().toLowerCase();
  const shown = rows
    .map((c, i) => ({ c, rank: i + 1 }))
    .filter(
      ({ c }) =>
        !q ||
        c.coach.toLowerCase().includes(q) ||
        c.teams.some(
          (t) =>
            t.toLowerCase() === q ||
            (TEAM_NAME[t] ?? "").toLowerCase().includes(q),
        ),
    );
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
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="space-y-2.5 border-b border-slate-100 px-4 py-3">
        <h3 className="font-display text-lg font-semibold text-slate-900">
          Every head coach
        </h3>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a coach or team"
            aria-label="Find a coach or team"
            className="focus-visible:outline-turf-700 w-full rounded-md border border-slate-300 bg-white py-1.5 pr-2.5 pl-8 text-sm placeholder:text-slate-400 focus-visible:outline-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Rank by"
            className="flex flex-1 overflow-hidden rounded-md border border-slate-300 text-xs"
          >
            {(
              [
                ["wins", "Total"],
                ["perGame", "Per game"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                aria-pressed={sort === k}
                className={cn(
                  "focus-visible:outline-turf-700 flex-1 px-2 py-1.5 font-medium focus-visible:outline-2 focus-visible:-outline-offset-2",
                  sort === k
                    ? "bg-turf-950 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMostFirst((v) => !v)}
            className="focus-visible:outline-turf-700 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2"
          >
            {mostFirst ? "Worst first" : "Best first"}
          </button>
        </div>
        <div className="text-xs text-slate-600">
          {sort === "wins"
            ? `Wins given away by 4th down calls since ${report.seasons[0]}`
            : "Chance to win given away per game, on average"}
        </div>
      </div>
      <div
        ref={list}
        className="relative max-h-[28rem] overflow-y-auto lg:max-h-[calc(100vh-15rem)]"
      >
        {shown.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No coach or team matches &ldquo;{query}&rdquo;.
          </p>
        )}
        {shown.map(({ c, rank }) => (
          <button
            key={c.coach}
            type="button"
            data-selected={c.coach === selected}
            aria-current={c.coach === selected ? "true" : undefined}
            onClick={() => onSelect(c.coach)}
            className={cn(
              "focus-visible:outline-turf-700 grid w-full grid-cols-[1.75rem_1fr_4.5rem] items-center gap-2 border-l-[3px] px-4 py-1.5 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2",
              c.coach === selected
                ? "border-line bg-turf-50 hover:bg-turf-50"
                : "border-transparent",
            )}
          >
            <span className="text-xs text-slate-500 tabular-nums">{rank}</span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate",
                  c.coach === selected
                    ? "text-turf-900 font-semibold"
                    : "text-slate-800",
                )}
              >
                {c.coach}{" "}
                <span className="text-xs font-normal text-slate-500">
                  {c.teams.join("/")}
                </span>
              </span>
              <span className="block h-1.5 rounded-full bg-slate-100">
                <span
                  className="block h-1.5 rounded-full bg-red-400"
                  style={{ width: `${(value(c) / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="text-right text-xs text-slate-700 tabular-nums">
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

/** Each choice's chance to win, inline: the best one bold, the one he chose marked. */
function ChanceChips({ d }: { d: Coach["worst"][number] }) {
  const opts = (
    [
      ["go", d.goWp],
      ["fg", d.fgWp],
      ["punt", d.puntWp],
    ] as const
  ).filter(([, wp]) => wp != null);
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {opts.map(([k, wp]) => (
        <span
          key={k}
          className={
            k === d.best ? "font-semibold text-slate-900" : "text-slate-600"
          }
        >
          <span
            className="mr-1 inline-block size-2 rounded-sm align-middle"
            style={{ background: CHOICE_COLOR[k] }}
          />
          {CHOICE[k]} {Math.round(wp! * 100)}%{k === d.actual ? " (chose)" : ""}
        </span>
      ))}
    </span>
  );
}

/** One costly call, laid out like the game view: the field, what he did, what he should have done. */
function CostlyCall({ d }: { d: Coach["worst"][number] }) {
  const dec = d.decision!;
  const s = dec.situation;
  const best = dec.options.find((o) => o.key === dec.best)!;
  const chosen = dec.options.find((o) => o.key === d.actual);
  const togo = s.ydstogo >= s.yardline ? "goal" : s.ydstogo;
  const score =
    s.scoreDiff === 0
      ? "Tied"
      : s.scoreDiff > 0
        ? `Up ${s.scoreDiff}`
        : `Down ${-s.scoreDiff}`;
  return (
    <div className="grid gap-x-6 gap-y-3 border-b border-slate-100 px-4 py-5 last:border-0 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold text-slate-900">
            {d.qtr > 4 ? "OT" : `Q${d.qtr}`}, {d.time.replace(/^0(?=\d:)/, "")}
          </span>
          <span>
            {d.season} {d.post ? "playoffs" : `week ${d.week}`} vs{" "}
            {TEAM_NAME[d.opp] ?? d.opp}
          </span>
        </div>
        <MiniField
          yardline={s.yardline}
          ydstogo={s.ydstogo}
          offense={teamInfo(d.team)}
          defense={teamInfo(d.opp)}
        />
      </div>
      <div className="min-w-0">
        <div className="font-display text-xl leading-snug font-semibold text-slate-900">
          {score}, 4th &amp; {togo} at {yardText(s.yardline, d.team, d.opp)}
        </div>
        <div className="text-slate-700">{did(d)}.</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-red-700">
            <b>
              Should have{" "}
              {d.best === "go"
                ? "gone for it"
                : d.best === "fg"
                  ? "kicked the field goal"
                  : "punted"}
              :
            </b>{" "}
            {Math.round(best.wp * 100)}% to win vs{" "}
            {chosen ? Math.round(chosen.wp * 100) : "–"}%.
          </span>
          {dec.confidence && <SureTag c={dec.confidence} />}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4">
          <Expand label="All the numbers">
            <DecisionTable
              d={{ ...dec, goGains: [] }}
              team={d.team}
              opp={d.opp}
              actual={d.actual}
              compact
              showHeading={false}
            />
          </Expand>
          <a
            className="text-turf-700 hover:text-turf-900 focus-visible:outline-turf-700 rounded py-1 text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2"
            href={`?tab=game&season=${d.season}&id=${d.gameId}&focus=${d.team}`}
          >
            See the whole game
          </a>
        </div>
      </div>
    </div>
  );
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
      <div className="font-medium text-slate-900">
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
            <span className="text-slate-700">{label}</span>
            <div className="h-3.5 rounded-full bg-slate-100">
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
      <div className="mt-1 text-xs text-slate-600">
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
  const [allCalls, setAllCalls] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="text-sm text-slate-500">
              Head coach, {c.teams.map((t) => TEAM_NAME[t] ?? t).join(", ")}
            </div>
            <h3 className="font-display text-4xl leading-none font-bold tracking-tight text-slate-900 sm:text-5xl">
              {c.coach}
            </h3>
            <p className="mt-2 text-lg leading-snug font-semibold text-slate-800">
              {styleLine(c, report)}
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <div className="font-display text-5xl leading-none font-bold text-red-700 tabular-nums sm:text-6xl">
              {wins(c.lost).toFixed(1)}
              <span className="ml-1.5 text-2xl font-semibold sm:text-3xl">
                {wins(c.lost) >= 0.95 ? "wins" : "of a win"}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              given away since {report.seasons[0]}
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-[70ch] border-t border-slate-100 pt-3 text-slate-700">
          His 4th down calls have cost {team} about <b>{fmtWins(c.lost)}</b>{" "}
          since {report.seasons[0]} ({c.games} games), {totalRank}. Per game he
          ranks {ordinal(c.rank)} of {n}.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <GoRate c={c} report={report} />
      </div>

      <div className="space-y-1 border-t border-slate-200 pt-3">
        {NOTES[c.coach] && (
          <Expand label="Why we say that">
            <div className="max-w-2xl space-y-2 text-sm leading-relaxed text-slate-700">
              {NOTES[c.coach]}
            </div>
          </Expand>
        )}

        <Expand label="His most costly calls" defaultOpen>
          <div className="rounded-lg border border-slate-200 bg-white">
            {(allCalls ? c.worst : c.worst.slice(0, TOP_CALLS)).map((d) =>
              d.decision ? (
                <CostlyCall key={`${d.gameId}-${d.qtr}-${d.time}`} d={d} />
              ) : (
                <a
                  key={`${d.gameId}-${d.qtr}-${d.time}`}
                  href={`?tab=game&season=${d.season}&id=${d.gameId}&focus=${d.team}`}
                  className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50"
                >
                  <span>
                    <span className="text-slate-900">{situation(d)}</span>
                    <ChanceChips d={d} />
                    <span className="block text-xs text-slate-600">
                      {d.season} {d.post ? "playoffs" : `week ${d.week}`} vs{" "}
                      {d.opp}, {d.qtr > 4 ? "OT" : `Q${d.qtr}`} {d.time}.{" "}
                      {did(d)}.
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
              ),
            )}
            {c.worst.length > TOP_CALLS && (
              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  aria-expanded={allCalls}
                  onClick={() => setAllCalls((v) => !v)}
                  className="focus-visible:outline-turf-700 border-turf-700 text-turf-700 hover:bg-turf-50 rounded-md border px-3 py-1.5 text-sm font-semibold focus-visible:outline-2"
                >
                  {allCalls ? "Show fewer" : `Show all ${c.worst.length}`}
                </button>
              </div>
            )}
          </div>
        </Expand>

        <Expand label="Season by season">
          <table className="w-full max-w-lg text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-600">
                <th className="py-1 font-medium">Season</th>
                <th className="py-1 font-medium">Games</th>
                <th className="py-1 font-medium">Wins given away</th>
                <th className="py-1 text-right font-medium">nfl4th says</th>
              </tr>
            </thead>
            <tbody>
              {c.seasons.map((s) => (
                <tr key={s.season} className="border-t border-slate-100">
                  <td className="py-1.5">{s.season}</td>
                  <td className="py-1.5 tabular-nums">{s.games}</td>
                  <td className="py-1.5 tabular-nums">
                    {wins(s.lost).toFixed(2)}
                  </td>
                  <td className="py-1.5 text-right text-slate-600 tabular-nums">
                    {wins(s.nfl4thLost).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-600">
            &ldquo;nfl4th says&rdquo; grades the same plays with Ben
            Baldwin&apos;s published numbers.
          </p>
        </Expand>

        <Expand label="What kind of mistakes">
          <div className="max-w-lg">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
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
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{ background: p.color }}
                    />
                    {p.label}
                  </span>
                  <span className="text-slate-900 tabular-nums">
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
    return <div className="h-96 animate-pulse rounded-lg bg-slate-200/70" />;

  return (
    <div className="space-y-5">
      <p className="max-w-[70ch] text-slate-700">
        Every 4th down since {report.seasons[0]}, graded the same way. When a
        coach picks something other than the best choice, his team&apos;s chance
        to win drops a little. Add those drops up and you get how many wins his
        4th down calls have given away.
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div id="coach-detail" className="min-w-0 scroll-mt-4">
          <a
            href="#coach-list"
            className="text-turf-700 focus-visible:outline-turf-700 mb-3 inline-block rounded text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-2 lg:hidden"
          >
            Pick another coach
          </a>
          <CoachDetail key={coach.coach} c={coach} report={report} />
        </div>
        <div id="coach-list" className="scroll-mt-4 lg:sticky lg:top-4">
          <Leaderboard
            report={report}
            selected={coach.coach}
            onSelect={(c) => {
              router.replace(
                `${pathname}?tab=coaches&coach=${encodeURIComponent(c)}`,
                { scroll: false },
              );
              // on phones the list sits below the coach, so jump back up to him
              if (!window.matchMedia("(min-width: 1024px)").matches)
                requestAnimationFrame(() =>
                  document.getElementById("coach-detail")?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "auto"
                      : "smooth",
                    block: "start",
                  }),
                );
            }}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Data through {report.through}, playoffs included, overtime not included.
        Coaches with at least {report.minGames} games. {CHOICE.go}, field goal
        and punt odds come from the model on the How it works tab.
      </p>
    </div>
  );
}
