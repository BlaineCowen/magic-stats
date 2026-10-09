"use client"

import { useMemo, useState } from "react"

import { fmt } from "@/lib/livedraft/queries"
import type { Board, Player } from "@/lib/livedraft/types"
import { PosBadge } from "./Chrome"

type SortKey =
  | "vor" | "pts" | "adp" | "ecr" | "spread" | "rec_yd" | "rush_yd" | "pass_yd" | "rec_td"

const COLUMNS: { key: SortKey; label: string; get: (p: Player) => number | null; digits?: number }[] = [
  { key: "pts", label: "Pts", get: (p) => p.pts, digits: 1 },
  { key: "vor", label: "VOR", get: (p) => p.vor, digits: 1 },
  { key: "adp", label: "ADP", get: (p) => p.adp, digits: 1 },
  { key: "ecr", label: "ECR", get: (p) => p.ecr },
  { key: "spread", label: "Spread", get: (p) => p.spread, digits: 1 },
  { key: "pass_yd", label: "PaYd", get: (p) => p.components.pass_yd },
  { key: "rush_yd", label: "RuYd", get: (p) => p.components.rush_yd },
  { key: "rec_yd", label: "ReYd", get: (p) => p.components.rec_yd },
  { key: "rec_td", label: "ReTD", get: (p) => p.components.rec_td, digits: 1 },
]

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "DEF"] as const

export function BoardExplorer({
  board,
  takenIds,
}: {
  board: Board | undefined
  takenIds: Set<string>
}) {
  const [query, setQuery] = useState("")
  const [pos, setPos] = useState<(typeof POSITIONS)[number]>("ALL")
  const [sort, setSort] = useState<SortKey>("vor")
  const [asc, setAsc] = useState(false)
  const [hideTaken, setHideTaken] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!board) return []
    let out = board.players
    if (pos !== "ALL") out = out.filter((p) => p.pos === pos)
    if (hideTaken) out = out.filter((p) => !takenIds.has(p.id))
    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.team ?? "").toLowerCase().includes(q),
      )
    }
    const col = COLUMNS.find((c) => c.key === sort)!
    return [...out].sort((a, b) => {
      const av = col.get(a)
      const bv = col.get(b)
      // Nulls always sort last regardless of direction.
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return asc ? av - bv : bv - av
    })
  }, [board, pos, query, sort, asc, hideTaken, takenIds])

  function toggleSort(key: SortKey) {
    if (key === sort) setAsc((v) => !v)
    else {
      setSort(key)
      // ADP and ECR are ranks: lower is better, so default those ascending.
      setAsc(key === "adp" || key === "ecr")
    }
  }

  if (!board) return null

  return (
    <div className="pb-20 sm:pb-4">
      <div className="sticky top-[57px] z-10 space-y-2 border-b border-slate-200 bg-white px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player or team…"
          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <div className="flex items-center gap-1 overflow-x-auto">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                pos === p ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {p}
            </button>
          ))}
          <label className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={hideTaken}
              onChange={(e) => setHideTaken(e.target.checked)}
              className="h-3.5 w-3.5 accent-slate-900"
            />
            hide drafted
          </label>
        </div>
        <div className="flex gap-1 overflow-x-auto text-[11px]">
          {COLUMNS.map((c) => (
            <button
              key={c.key}
              onClick={() => toggleSort(c.key)}
              className={`shrink-0 rounded px-2 py-1 font-medium ${
                sort === c.key ? "bg-slate-200 text-slate-900" : "text-slate-500"
              }`}
            >
              {c.label}
              {sort === c.key ? (asc ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-1 text-[11px] text-slate-500">
        {rows.length} players · board generated{" "}
        {new Date(board.generatedAt).toLocaleString()}
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.slice(0, 300).map((p) => {
          const isOpen = expanded === p.id
          const taken = takenIds.has(p.id)
          return (
            <li key={p.id}>
              <button
                onClick={() => setExpanded(isOpen ? null : p.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                  taken ? "opacity-40" : ""
                }`}
              >
                <PosBadge pos={p.pos} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {p.name}
                    {taken && <span className="ml-1 text-[10px] text-slate-500">drafted</span>}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {p.team ?? "FA"} · ADP {fmt(p.adp, 1)} · ECR {fmt(p.ecr)}
                    {p.bye ? ` · bye ${p.bye}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    {fmt(p.vor, 1)}
                  </div>
                  <div className="text-[10px] tabular-nums text-slate-500">{fmt(p.pts)} pts</div>
                </div>
              </button>

              {isOpen && (
                <div className="space-y-2 bg-slate-50 px-3 py-2.5 text-[11px]">
                  <Row label="Projection">
                    {p.components.pass_yd ? `${fmt(p.components.pass_yd)} pass yd · ${fmt(p.components.pass_td)} pass TD · ${fmt(p.components.pass_int)} INT · ` : ""}
                    {p.components.rush_yd ? `${fmt(p.components.rush_yd)} rush yd · ${fmt(p.components.rush_td)} rush TD · ` : ""}
                    {p.components.rec ? `${fmt(p.components.rec)} rec · ${fmt(p.components.rec_yd)} yd · ${fmt(p.components.rec_td)} TD` : ""}
                  </Row>
                  <Row label="By source">
                    Rotowire {fmt(p.bySource.rotowire)} · Clay {fmt(p.bySource.clay)} · FFToday{" "}
                    {fmt(p.bySource.fftoday)}{" "}
                    <span className="text-slate-500">(spread {fmt(p.spread, 1)})</span>
                  </Row>
                  <Row label="Experts">
                    ECR {fmt(p.ecr)} · disagreement {fmt(p.ecrStd, 1)}
                    {p.adpLagRisk && (
                      <span className="ml-1 font-medium text-red-600">
                        ▲ ranked well ahead of ADP — may go early
                      </span>
                    )}
                  </Row>
                  <Row label="Context">
                    tier {fmt(p.tier)} · {p.nSources ?? "–"} sources
                    {p.gp ? ` · ${fmt(p.gp)} g` : ""}
                    {p.winTotal ? ` · team O/U ${fmt(p.winTotal, 1)}` : ""}
                  </Row>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="flex-1 text-slate-800">{children}</span>
    </div>
  )
}
