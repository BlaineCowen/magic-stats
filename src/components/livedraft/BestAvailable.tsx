"use client"

import { useMemo, useState } from "react"

import { fmt } from "@/lib/livedraft/queries"
import { RISK_BAND_CLASS, rankingVor, riskBand, type RiskLean } from "@/lib/livedraft/risk"
import type { LivePlayer } from "@/lib/livedraft/types"
import { PosBadge } from "./Chrome"

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "DEF"] as const
type PosFilter = (typeof POSITIONS)[number]

/**
 * Explains the ★ in the terms that matter for this player's position: a back
 * cares about the run defenses he faces, a receiver about the secondaries.
 */
function matchupTooltip(p: LivePlayer): string {
  const isRusher = p.pos === "RB"
  const unit = isRusher ? "run defenses" : "secondaries"
  const grade = isRusher ? p.oppRunDef : p.oppPassDef
  const funnel = isRusher ? "run funnels" : "pass funnels"
  const games = p.funnelGames ?? 0
  return (
    `Weeks 1-5: opponents grade ${grade?.toFixed(2) ?? "?"} against the ` +
    `${isRusher ? "run" : "pass"} (league avg ~5.3; lower is softer). ` +
    `${games} of 5 opponents are ${funnel}. ` +
    `Soft ${unit} early — a sell-high window.`
  )
}

/** Short "+8% pass" style label when blaine_score has moved this player. */
function adjLabel(p: LivePlayer): string | null {
  const parts: string[] = []
  if (p.adjPass && Math.abs(p.adjPass - 1) > 0.001) {
    parts.push(`${p.adjPass > 1 ? "+" : ""}${Math.round((p.adjPass - 1) * 100)}% pass`)
  }
  if (p.adjRush && Math.abs(p.adjRush - 1) > 0.001) {
    parts.push(`${p.adjRush > 1 ? "+" : ""}${Math.round((p.adjRush - 1) * 100)}% rush`)
  }
  return parts.length ? parts.join(" ") : null
}

type SortKey = "vona" | "vor" | "adp" | "ceiling"

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: "vona", label: "VONA", hint: "Value over the next player likely to survive to your pick" },
  { key: "vor", label: "VOR", hint: "Value over replacement, at the current risk lean" },
  { key: "ceiling", label: "Ceiling", hint: "90th-percentile season outcome" },
  { key: "adp", label: "ADP", hint: "Superflex average draft position" },
]

export function BestAvailable({
  players,
  needsOnly,
  onToggleNeeds,
  lean,
}: {
  players: LivePlayer[]
  needsOnly: boolean
  onToggleNeeds: (v: boolean) => void
  lean: RiskLean
}) {
  const [pos, setPos] = useState<PosFilter>("ALL")
  const [sort, setSort] = useState<SortKey>("vona")
  const [starsOnly, setStarsOnly] = useState(false)

  const rows = useMemo(() => {
    let out = players
    if (pos !== "ALL") out = out.filter((p) => p.pos === pos)
    // No free source projects points allowed, so defenses score only their
    // sacks/turnovers and their VOR is compressed near zero -- which lands them
    // among the genuine first-round picks. You take exactly one DEF, in the last
    // round, so keep them out of the default view and behind their own chip.
    else out = out.filter((p) => p.pos !== "DEF")
    if (needsOnly) out = out.filter((p) => p.fillsNeed)
    if (starsOnly) out = out.filter((p) => p.earlyStar)
    const sorted = [...out]
    sorted.sort((a, b) => {
      if (sort === "adp") return (a.adp ?? 9999) - (b.adp ?? 9999)
      if (sort === "ceiling") return (b.ceiling ?? -9999) - (a.ceiling ?? -9999)
      if (sort === "vona") return (b.vona ?? -9999) - (a.vona ?? -9999)
      // VOR respects the active risk lean, so switching floor/upside actually
      // reorders the board rather than only relabelling it.
      return rankingVor(b, lean) - rankingVor(a, lean)
    })
    return sorted.slice(0, 60)
  }, [players, pos, needsOnly, starsOnly, sort, lean])

  return (
    <div className="pb-20 sm:pb-4">
      <div className="sticky top-[57px] z-10 space-y-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex gap-1 overflow-x-auto">
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
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                title={s.hint}
                onClick={() => setSort(s.key)}
                className={`rounded px-2 py-1 text-[11px] font-medium ${
                  sort === s.key ? "bg-slate-200 text-slate-900" : "text-slate-500"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={needsOnly}
                onChange={(e) => onToggleNeeds(e.target.checked)}
                className="h-3.5 w-3.5 accent-slate-900"
              />
              fills a need
            </label>
            <label
              className="flex items-center gap-1.5 text-[11px] text-slate-600"
              title="Soft weeks 1-5 — likely to look good early and be tradeable at a premium"
            >
              <input
                type="checkbox"
                checked={starsOnly}
                onChange={(e) => setStarsOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-500"
              />
              <span className="text-amber-600">★</span> early
            </label>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((p, i) => {
          // Mark where the tier changes, so "can I wait?" is visible at a glance.
          const prev = rows[i - 1]
          const tierBreak =
            prev && prev.pos === p.pos && prev.tier !== null && p.tier !== prev.tier
          return (
            <li
              key={p.id}
              className={`px-3 py-2 ${tierBreak ? "border-t-2 border-t-slate-300" : ""} ${
                p.fillsNeed ? "bg-emerald-50/40" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <PosBadge pos={p.pos} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {p.name}
                    </span>
                    {p.earlyStar && (
                      <span title={matchupTooltip(p)} className="shrink-0 text-[11px] text-amber-500">
                        ★
                        {(p.funnelGames ?? 0) >= 2 && (
                          <span className="ml-0.5 text-[9px] font-bold">
                            {p.funnelGames}
                          </span>
                        )}
                      </span>
                    )}
                    {p.adpLagRisk && (
                      <span
                        title="Experts rank him well ahead of ADP — may go earlier than simulated"
                        className="shrink-0 text-[10px] font-bold text-red-600"
                      >
                        ▲
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {p.team ?? "FA"}
                    {p.tier !== null ? ` · tier ${fmt(p.tier)}` : ""}
                    {p.bye ? ` · bye ${p.bye}` : ""}
                    {p.adp !== null ? ` · ADP ${fmt(p.adp, 1)}` : ""}
                  </div>
                  <div className="text-[10px] tabular-nums text-slate-400">
                    <span className={RISK_BAND_CLASS[riskBand(p.risk) ?? "low"]}>
                      {fmt(p.floor)}–{fmt(p.ceiling)}
                    </span>
                    <span className="text-slate-400">
                      {" "}
                      · {fmt(p.expGames, 1)} g
                      {adjLabel(p) ? ` · ${adjLabel(p)}` : ""}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-slate-900">
                    {fmt(rankingVor(p, lean), 1)}
                  </div>
                  <div className="text-[10px] tabular-nums text-slate-500">
                    VONA {fmt(p.vona, 1)}
                  </div>
                </div>
                <div className="w-11 shrink-0 text-right">
                  <div
                    className={`text-[11px] font-medium tabular-nums ${
                      p.availNext >= 0.7
                        ? "text-emerald-600"
                        : p.availNext >= 0.35
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {Math.round(p.availNext * 100)}%
                  </div>
                  <div className="text-[9px] leading-tight text-slate-400">lasts</div>
                </div>
              </div>
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-slate-500">
            No players match this filter.
          </li>
        )}
      </ul>
    </div>
  )
}
