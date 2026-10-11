"use client"

import { fmt } from "@/lib/livedraft/queries"
import { unfilledSlots } from "@/lib/livedraft/draft"
import type { Board, DraftState, Player } from "@/lib/livedraft/types"
import { PosBadge } from "./Chrome"

const ORDER = ["QB", "RB", "WR", "TE", "DEF", "K"]

export function MyTeam({
  board,
  state,
  roster,
}: {
  board: Board | undefined
  state: DraftState | undefined
  roster: Player[]
}) {
  if (!board || !state) return null

  const missing = unfilledSlots(board.league, roster)
  const grouped = ORDER.map((pos) => ({
    pos,
    players: roster
      .filter((p) => p.pos === pos)
      .sort((a, b) => (b.vor ?? 0) - (a.vor ?? 0)),
  })).filter((g) => g.players.length)

  const totalPts = roster.reduce((sum, p) => sum + (p.pts ?? 0), 0)
  const totalVor = roster.reduce((sum, p) => sum + (p.vor ?? 0), 0)

  return (
    <div className="space-y-4 px-3 py-3 pb-24 sm:pb-6">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Players" value={String(roster.length)} sub={`of ${board.league.rounds}`} />
        <Stat label="Proj pts" value={fmt(totalPts)} sub="starters + bench" />
        <Stat label="Total VOR" value={fmt(totalVor)} sub="above replacement" />
      </div>

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Still needed
        </h2>
        {missing.length === 0 ? (
          <p className="text-sm text-emerald-700">All starting slots filled.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {missing.map((slot, i) => (
              <span
                key={`${slot}-${i}`}
                className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900"
              >
                {slot.replace("SUPER_FLEX", "SUPERFLEX")}
              </span>
            ))}
          </div>
        )}
      </section>

      {state.byeConflicts.length > 0 && (
        <section>
          <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bye conflicts
          </h2>
          <ul className="space-y-1">
            {state.byeConflicts.map((c) => (
              <li key={c.week} className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-900">
                <b>Week {c.week}:</b> {c.players.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Roster
        </h2>
        {roster.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing drafted yet.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map((g) => (
              <div key={g.pos}>
                <div className="mb-1 flex items-center gap-2">
                  <PosBadge pos={g.pos} />
                  <span className="text-[11px] text-slate-500">{g.players.length}</span>
                </div>
                <ul className="divide-y divide-slate-100 rounded border border-slate-200 bg-white">
                  {g.players.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-2.5 py-1.5">
                      <span className="truncate text-sm text-slate-900">{p.name}</span>
                      <span className="ml-2 shrink-0 text-xs tabular-nums text-slate-500">
                        {fmt(p.pts)} pts · VOR {fmt(p.vor, 1)}
                        {p.bye ? ` · bye ${p.bye}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight text-slate-900">
        {value}
      </div>
      <div className="text-[10px] text-slate-400">{sub}</div>
    </div>
  )
}
