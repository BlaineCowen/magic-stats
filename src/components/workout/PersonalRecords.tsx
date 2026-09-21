"use client"

import { useMemo, useState } from "react"
import { allTimePRs, type WorkoutRow } from "@/lib/workout"
import { useIsMobile } from "@/hooks/useIsMobile"

const ACCENT = "#00aaff"
const MUTED = "#94a3b8"

type SortKey = "exercise" | "bestWeight" | "bestEst1rm" | "bestVol"

export default function PersonalRecords({ rows }: { rows: WorkoutRow[] }) {
  const isMobile = useIsMobile()
  const [sortKey, setSortKey] = useState<SortKey>("bestEst1rm")
  const [sortAsc, setSortAsc] = useState(false)
  const [search, setSearch] = useState("")

  const prs = useMemo(() => allTimePRs(rows), [rows])

  const top5Threshold = useMemo(() => {
    const vals = [...prs].map(p => p.bestEst1rm).sort((a, b) => b - a)
    return vals[4] ?? -Infinity
  }, [prs])

  const sorted = useMemo(() => {
    const filtered = search
      ? prs.filter(p => p.exercise.toLowerCase().includes(search.toLowerCase()))
      : prs
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      const cmp = typeof av === "string" ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number)
      return sortAsc ? cmp : -cmp
    })
  }, [prs, sortKey, sortAsc, search])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const COLS: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "exercise", label: "Exercise", align: "left" },
    { key: "bestWeight", label: "Best Weight", align: "right" },
    { key: "bestEst1rm", label: "Best Est. 1RM", align: "right" },
    { key: "bestVol", label: "Best Set Vol.", align: "right" },
  ]

  function arrow(key: SortKey) {
    if (key !== sortKey) return " ↕"
    return sortAsc ? " ↑" : " ↓"
  }

  return (
    <div>
      <p style={{ color: MUTED, fontSize: "0.82rem", marginBottom: "1rem" }}>
        All-time personal records by exercise. Click column headers to sort.
      </p>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter exercises…"
        style={{
          width: isMobile ? "100%" : "280px",
          boxSizing: "border-box",
          padding: "6px 10px",
          background: "#1a1f2e",
          border: "1px solid #2d3748",
          borderRadius: "6px",
          color: "#e2e8f0",
          fontSize: "0.85rem",
          marginBottom: "1rem",
          outline: "none",
        }}
      />

      <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "#232b3e", borderBottom: "1px solid #2d3748" }}>
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: "10px 14px",
                      textAlign: col.align,
                      color: sortKey === col.key ? ACCENT : MUTED,
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: "pointer",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}{arrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pr, i) => {
                const isTop5 = pr.bestEst1rm >= top5Threshold
                return (
                  <tr
                    key={pr.exercise}
                    style={{
                      background: isTop5 ? "#0d2a3e" : i % 2 === 0 ? "#1a1f2e" : "#1e2535",
                      borderBottom: "1px solid #2d3748",
                    }}
                  >
                    <td style={{ padding: "8px 14px", color: isTop5 ? ACCENT : "#e2e8f0", fontWeight: isTop5 ? 600 : 400, minWidth: "180px" }}>
                      {pr.exercise}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontFamily: "monospace", color: "#e2e8f0" }}>
                      {pr.bestWeight.toFixed(1)} lbs
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontFamily: "monospace", color: isTop5 ? ACCENT : "#e2e8f0", fontWeight: isTop5 ? 600 : 400 }}>
                      {pr.bestEst1rm.toFixed(1)} lbs
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontFamily: "monospace", color: "#94a3b8" }}>
                      {Math.round(pr.bestVol).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
