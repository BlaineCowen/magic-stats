"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Coach, CoachReport } from "@/lib/fourth/coaches";
import { cn } from "@/lib/utils";
import { OPTION_COLOR, OPTION_LABEL, pct, yardText } from "./decision-card";

const DEFAULT_COACH = "DeMeco Ryans";

/** Hand-written notes for coaches with a study written up. */
const NOTES: Record<string, React.ReactNode> = {
  "DeMeco Ryans": (
    <>
      <p>
        Ryans&apos; 4th down calls have cost Houston about 3.1 expected wins
        across 63 games since 2023, roughly 4.9 points of win probability a game
        against a league average of 3.9. That ranks 39th of 42 head coaches.
        Graded with nfl4th&apos;s own numbers instead, the total is smaller (1.7
        wins, since nfl4th values going for it less) but he still ranks 34th.
      </p>
      <p>
        Almost all of it comes from caution. 264 of the 309 points were kicks or
        punts when going was better; in four seasons he&apos;s made only 3
        costly calls by being too aggressive. When the model said going was
        clearly right, he went 26 of 77 times (34%) against a league rate of
        52%, 40th of 42. The single biggest habit is field goals inside the 10
        on short yardage: 21 of them where going was better, worth about 60
        points.
      </p>
      <p>
        It hasn&apos;t improved: 0.78 expected wins given up in 2023, 0.75 in
        2024, 1.19 in 2025, and 2026 is on a similar pace. In the playoffs (3–3,
        with all three losses in the divisional round) his 4th down calls gave
        up about 27 points, including a field goal on 4th &amp; 2 from the New
        England 7 while down 11 in the third quarter of the 2025 divisional
        loss.
      </p>
      <p className="text-xs text-gray-500">
        The biggest single call on the list, a 58-yard try against Detroit tied
        with 1:56 left, is where this model and nfl4th disagree most: nfl4th had
        the kick slightly ahead. Totals add up each call&apos;s expected cost;
        they aren&apos;t games he actually lost.
      </p>
    </>
  ),
};

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

const wins = (pts: number) => (pts / 100).toFixed(2);

type SortKey = "perGame" | "wins";
const SORTS: { key: SortKey; label: string; hint: string }[] = [
  {
    key: "perGame",
    label: "Per game",
    hint: "win probability given up per game",
  },
  { key: "wins", label: "Wins given up", hint: "total expected wins given up" },
];

function Leaderboard({
  report,
  selected,
  onSelect,
}: {
  report: CoachReport;
  selected: string;
  onSelect: (c: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("perGame");
  // true = most given up first
  const [mostFirst, setMostFirst] = useState(false);
  const value = (c: Coach) =>
    sort === "perGame" ? -c.lostPerGame : -c.lost / 100;
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
  // keep the selected coach visible in the scrolling list (Ryans sits near the bottom)
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(
      "[data-selected=true]",
    );
    if (row && list.current)
      list.current.scrollTop = row.offsetTop - list.current.clientHeight / 2;
  }, [selected, sort, mostFirst]);
  const hint = SORTS.find((x) => x.key === sort)!.hint;
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="space-y-2 border-b border-gray-100 px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">
          Every head coach
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-hidden rounded-md border border-gray-300 text-xs">
            {SORTS.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => setSort(x.key)}
                className={cn(
                  "flex-1 px-2 py-1",
                  sort === x.key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMostFirst((v) => !v)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            title="Flip the order"
          >
            {mostFirst ? "Most first" : "Least first"}
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {hint[0]!.toUpperCase() + hint.slice(1)} on 4th downs ·{" "}
          {report.minGames}+ games
        </div>
      </div>
      <div ref={list} className="relative max-h-[38rem] overflow-y-auto">
        {rows.map((c, i) => (
          <button
            key={c.coach}
            type="button"
            data-selected={c.coach === selected}
            onClick={() => onSelect(c.coach)}
            className={cn(
              "grid w-full grid-cols-[1.75rem_1fr_5.5rem] items-center gap-2 px-4 py-1.5 text-left text-sm hover:bg-slate-50",
              c.coach === selected && "bg-blue-50 hover:bg-blue-50",
            )}
          >
            <span className="text-xs text-gray-400 tabular-nums">{i + 1}</span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate",
                  c.coach === selected
                    ? "font-semibold text-blue-800"
                    : "text-gray-800",
                )}
              >
                {c.coach}
              </span>
              <span className="block h-1.5 rounded-full bg-gray-100">
                <span
                  className="block h-1.5 rounded-full bg-red-400"
                  style={{ width: `${(value(c) / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="text-right text-xs text-gray-600 tabular-nums">
              {value(c).toFixed(2)}{" "}
              <span className="text-gray-400">
                {sort === "wins" ? `${c.games}g` : c.teams.join("/")}
              </span>
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
  return `4th & ${togo} at ${yardText(d.yardline)}, ${score}`;
}

function CoachDetail({ c, report }: { c: Coach; report: CoachReport }) {
  const leaguePerGame = report.league.lostPerGame;
  const parts = [
    {
      key: "passive",
      label: "Too passive (kicked or punted when going was better)",
      v: c.passiveLost,
      color: OPTION_COLOR.go,
    },
    {
      key: "aggressive",
      label: "Too aggressive (went when kicking was better)",
      v: c.aggressiveLost,
      color: OPTION_COLOR.fg,
    },
    {
      key: "other",
      label: "Wrong kick (punted when a field goal was better, or the reverse)",
      v: c.otherLost,
      color: OPTION_COLOR.punt,
    },
  ];
  const mistakeTotal = parts.reduce((a, p) => a + p.v, 0) || -1;
  const maxSeason = Math.min(...c.seasons.map((s) => s.lost), -1);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-gray-900">{c.coach}</h3>
        <div className="text-sm text-gray-500">
          {c.teams.join(", ")} · {c.games} games · {c.decisions} fourth downs
          graded
        </div>
      </div>
      {NOTES[c.coach] && (
        <div className="space-y-2 text-sm leading-relaxed text-gray-700">
          {NOTES[c.coach]}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Expected wins given up"
          value={wins(-c.lost)}
          sub={`${(-c.lost).toFixed(1)} win-probability points`}
        />
        <Tile
          label="Per game"
          value={(-c.lostPerGame).toFixed(2)}
          sub={`league average ${(-leaguePerGame).toFixed(2)}`}
        />
        <Tile
          label="League rank"
          value={`${c.rank} of ${report.coaches.length}`}
          sub="1 = gives up the least"
        />
        <Tile
          label="Clear mistakes"
          value={c.mistakes}
          sub={`calls costing over 1 point, of ${c.decisions}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-800">
            Where the mistakes came from
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
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
          <div className="mt-3 space-y-1.5 text-sm">
            {parts.map((p) => (
              <div
                key={p.key}
                className="flex items-start justify-between gap-3"
              >
                <span className="flex items-start gap-2 text-gray-700">
                  <span
                    className="mt-1.5 size-2.5 shrink-0 rounded-sm"
                    style={{ background: p.color }}
                  />
                  {p.label}
                </span>
                <span className="font-medium whitespace-nowrap text-gray-900 tabular-nums">
                  {p.v.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            When the model said go was clearly right (2.25+ points),{" "}
            {c.coach.split(" ").at(-1)} went {c.wentInStrongGoSpots} of{" "}
            {c.strongGoSpots} times (
            {pct(c.wentInStrongGoSpots / Math.max(1, c.strongGoSpots))}).
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-medium text-gray-800">By season</div>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1 font-medium">Season</th>
                <th className="py-1 font-medium">Games</th>
                <th className="py-1 font-medium">Points lost</th>
                <th
                  className="py-1 text-right font-medium"
                  title="Same plays graded with nfl4th's own numbers"
                >
                  nfl4th
                </th>
              </tr>
            </thead>
            <tbody>
              {c.seasons.map((s) => (
                <tr key={s.season} className="border-t border-gray-100">
                  <td className="py-1.5">{s.season}</td>
                  <td className="py-1.5 tabular-nums">{s.games}</td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-red-400"
                          style={{ width: `${(s.lost / maxSeason) * 100}%` }}
                        />
                      </div>
                      <span className="tabular-nums">
                        {(-s.lost).toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">
                    {(-s.nfl4thLost).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            nfl4th column: the same plays graded with nfl4th&apos;s published
            numbers ({c.nfl4thGraded} of {c.decisions} available).
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-800">
          Costliest calls
        </div>
        {c.worst.map((d) => (
          <a
            key={`${d.gameId}-${d.time}-${d.qtr}`}
            href={`?tab=game&season=${d.season}&id=${d.gameId}&focus=${d.team}`}
            className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b border-gray-100 px-4 py-2.5 text-sm last:border-0 hover:bg-slate-50 sm:grid-cols-[9rem_1fr_11rem_4rem]"
          >
            <span className="text-xs text-gray-500">
              {d.season} {d.post ? "playoffs" : `wk ${d.week}`} vs {d.opp}
              <span className="block">
                {d.qtr > 4 ? "OT" : `Q${d.qtr}`} {d.time}
              </span>
            </span>
            <span className="text-gray-800 sm:order-none">{situation(d)}</span>
            <span className="text-gray-600">
              <span style={{ color: OPTION_COLOR[d.actual] }}>
                {OPTION_LABEL[d.actual]}
              </span>
              {d.worked != null && (
                <span
                  className={d.worked ? "text-emerald-700" : "text-red-700"}
                >
                  {" "}
                  {d.worked ? "✓" : "✗"}
                </span>
              )}
              {" → "}
              <span
                className="font-medium"
                style={{ color: OPTION_COLOR[d.best] }}
              >
                {OPTION_LABEL[d.best]}
              </span>
              {d.n4Best && (
                <span className="block text-xs text-gray-400">
                  nfl4th: {OPTION_LABEL[d.n4Best]}
                  {d.n4Cost != null && d.n4Cost < 0
                    ? ` (${d.n4Cost.toFixed(1)})`
                    : ""}
                </span>
              )}
            </span>
            <span className="text-right font-semibold text-red-700 tabular-nums">
              {d.cost.toFixed(1)}
            </span>
          </a>
        ))}
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
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-relaxed text-gray-700">
        Every 4th down from {report.seasons[0]} through {report.through},
        playoffs included, graded by the same model. A call &ldquo;gives
        up&rdquo; the difference between the win probability of what the coach
        chose and the best choice. Added up, 100 points is one expected win.
        Overtime isn&apos;t included.
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
    </div>
  );
}
