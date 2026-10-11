"use client"

import { useMemo, useState } from "react"

import { fmt } from "@/lib/livedraft/queries"
import type { Board, Player, TeamFunnel } from "@/lib/livedraft/types"
import { PosBadge } from "./Chrome"

type View = "targets" | "defenses"

/**
 * Weeks 1-5 matchups.
 *
 * Two questions, kept separate because they are answered differently. "Who
 * should I target?" ranks players by the defenses *they* face, judged on the
 * unit that matters for their position. "Which defenses are funnels?" is the
 * league-wide table the first view is derived from, worth seeing directly when
 * you are weighing a specific player.
 */
export function Matchups({
  board,
  takenIds,
}: {
  board: Board
  takenIds: Set<string>
}) {
  const [view, setView] = useState<View>("targets")
  const [hideTaken, setHideTaken] = useState(true)

  return (
    <div className="pb-24 sm:pb-6">
      <div className="sticky top-[57px] z-10 flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex gap-1">
          {(["targets", "defenses"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${
                view === v ? "bg-slate-900 text-white" : "text-slate-500"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === "targets" && (
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={hideTaken}
              onChange={(e) => setHideTaken(e.target.checked)}
              className="h-3.5 w-3.5 accent-slate-900"
            />
            hide drafted
          </label>
        )}
      </div>

      {view === "targets" ? (
        <Targets board={board} takenIds={takenIds} hideTaken={hideTaken} />
      ) : (
        <Defenses funnels={board.funnels} />
      )}

      <p className="px-3 py-3 text-[10px] leading-relaxed text-slate-400">
        Unit grades are Clay&rsquo;s, on a 1&ndash;10 scale. Run defence is weighted
        from DI/LB/ED, pass defence from CB/ED/S, since no unit is purely one or
        the other. Edges are small (~0.5 of a grade) &mdash; a tiebreaker between
        similar players, not a reason to reach.
      </p>
    </div>
  )
}

function Targets({
  board,
  takenIds,
  hideTaken,
}: {
  board: Board
  takenIds: Set<string>
  hideTaken: boolean
}) {
  const groups = useMemo(() => {
    const pool = board.players.filter(
      (p) => (p.vor ?? 0) > 0 && (!hideTaken || !takenIds.has(p.id)),
    )
    const rank = (list: Player[]) =>
      [...list].sort(
        (a, b) =>
          (b.funnelGames ?? 0) - (a.funnelGames ?? 0) ||
          (b.matchupEdge ?? 0) - (a.matchupEdge ?? 0),
      )
    return [
      {
        title: "Backs facing run funnels",
        hint: "Opponents soft against the run — volume and efficiency for RBs",
        players: rank(pool.filter((p) => p.pos === "RB")).slice(0, 10),
        gradeKey: "oppRunDef" as const,
        gradeLabel: "opp run D",
      },
      {
        title: "Pass catchers facing pass funnels",
        hint: "Opponents soft in the secondary",
        players: rank(pool.filter((p) => p.pos === "WR" || p.pos === "TE")).slice(0, 10),
        gradeKey: "oppPassDef" as const,
        gradeLabel: "opp pass D",
      },
      {
        title: "Quarterbacks facing soft secondaries",
        hint: "",
        players: rank(pool.filter((p) => p.pos === "QB")).slice(0, 8),
        gradeKey: "oppPassDef" as const,
        gradeLabel: "opp pass D",
      },
    ]
  }, [board, takenIds, hideTaken])

  return (
    <div>
      {groups.map((g) => (
        <section key={g.title}>
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <h2 className="text-xs font-semibold text-slate-700">{g.title}</h2>
            {g.hint && <p className="text-[10px] text-slate-500">{g.hint}</p>}
          </div>
          <ul className="divide-y divide-slate-100">
            {g.players.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                <PosBadge pos={p.pos} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {p.name}
                    {takenIds.has(p.id) && (
                      <span className="ml-1 text-[10px] text-slate-400">drafted</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {p.team} · VOR {fmt(p.vor, 1)} · {g.gradeLabel}{" "}
                    {fmt(p[g.gradeKey], 2)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-sm font-semibold tabular-nums ${
                      (p.funnelGames ?? 0) >= 2 ? "text-amber-600" : "text-slate-700"
                    }`}
                  >
                    {p.funnelGames ?? 0}
                    <span className="text-[10px] font-normal text-slate-400">/5</span>
                  </div>
                  <div className="text-[10px] tabular-nums text-slate-500">
                    {(p.matchupEdge ?? 0) >= 0 ? "+" : ""}
                    {fmt(p.matchupEdge, 2)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Defenses({ funnels }: { funnels: TeamFunnel[] }) {
  const sorted = useMemo(
    () => [...funnels].sort((a, b) => b.funnel - a.funnel),
    [funnels],
  )

  return (
    <div>
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <h2 className="text-xs font-semibold text-slate-700">
          Defensive funnels, all 32
        </h2>
        <p className="text-[10px] text-slate-500">
          Sorted run funnel (feeds RBs) to pass funnel (feeds WRs). Lower unit
          grade = softer.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-white text-slate-500">
              <th className="px-2 py-1.5 text-left font-medium">Team</th>
              <th className="px-1 py-1.5 text-right font-medium">DI</th>
              <th className="px-1 py-1.5 text-right font-medium">LB</th>
              <th className="px-1 py-1.5 text-right font-medium">ED</th>
              <th className="px-1 py-1.5 text-right font-medium">CB</th>
              <th className="px-1 py-1.5 text-right font-medium">S</th>
              <th className="px-2 py-1.5 text-right font-medium">run D</th>
              <th className="px-2 py-1.5 text-right font-medium">pass D</th>
              <th className="px-2 py-1.5 text-right font-medium">funnel</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => (
              <tr key={f.team} className="border-b border-slate-50">
                <td className="px-2 py-1.5 font-semibold text-slate-900">
                  {f.team}
                  {f.kind !== "neutral" && (
                    <span
                      className={`ml-1 text-[9px] font-medium ${
                        f.kind === "run" ? "text-green-700" : "text-blue-700"
                      }`}
                    >
                      {f.kind === "run" ? "RUN" : "PASS"}
                    </span>
                  )}
                </td>
                <td className="px-1 py-1.5 text-right tabular-nums">{f.di}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{f.lb}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{f.ed}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{f.cb}</td>
                <td className="px-1 py-1.5 text-right tabular-nums">{f.s}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(f.runDef, 2)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(f.passDef, 2)}
                </td>
                <td
                  className={`px-2 py-1.5 text-right font-semibold tabular-nums ${
                    f.funnel > 0.6
                      ? "text-green-700"
                      : f.funnel < -0.6
                        ? "text-blue-700"
                        : "text-slate-400"
                  }`}
                >
                  {f.funnel >= 0 ? "+" : ""}
                  {fmt(f.funnel, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
