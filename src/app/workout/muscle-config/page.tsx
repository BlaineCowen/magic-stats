// src/app/workout/muscle-config/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { MUSCLE_LABEL, type MuscleId } from "@/lib/muscleMap"

const ACCENT = "#00aaff"
const MUTED = "#94a3b8"
const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as MuscleId[]

interface MappingRow {
  exerciseName: string
  wgerId: number | null
  wgerName: string | null
  confidence: number
  primary: MuscleId[]
  secondary: MuscleId[]
  override: boolean
}

type Filter = "all" | "review" | "overridden"

interface WgerResult {
  id: number
  name: string
  muscles: MuscleId[]
  muscles_secondary: MuscleId[]
}

const CARD = { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px" }
const PILL_BASE = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "0 10px", borderRadius: "999px", fontSize: "0.75rem",
  cursor: "pointer", userSelect: "none" as const, minHeight: "32px",
  border: "1px solid #2d3748",
}

export default function MuscleConfigPage() {
  const searchParams = useSearchParams()
  const user = searchParams.get("user") ?? "blaine"

  const [rows, setRows] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("review")
  const [search, setSearch] = useState("")
  const [editId, setEditId] = useState<string | null>(null)

  // Edit state
  const [editPrimary, setEditPrimary] = useState<Set<MuscleId>>(new Set())
  const [editSecondary, setEditSecondary] = useState<Set<MuscleId>>(new Set())
  const [editWgerId, setEditWgerId] = useState<number | null>(null)
  const [wgerSearch, setWgerSearch] = useState("")
  const [wgerResults, setWgerResults] = useState<WgerResult[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/workout/muscles?user=${user}`)
      .then(r => r.json())
      .then((d: { mappings?: MappingRow[] }) => setRows(d.mappings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  const filtered = rows
    .filter(r => {
      if (filter === "review" && r.confidence >= 0.7 && !r.override) return false
      if (filter === "overridden" && !r.override) return false
      if (search && !r.exerciseName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      // Low confidence + not overridden float to top
      const aScore = a.override ? 1 : a.confidence
      const bScore = b.override ? 1 : b.confidence
      return aScore - bScore
    })

  function openEdit(row: MappingRow) {
    setEditId(row.exerciseName)
    setEditPrimary(new Set(row.primary))
    setEditSecondary(new Set(row.secondary))
    setEditWgerId(row.wgerId ?? null)
    setWgerSearch(row.wgerName ?? "")
    setWgerResults([])
  }

  function toggleMuscle(
    set: Set<MuscleId>,
    setter: (s: Set<MuscleId>) => void,
    id: MuscleId,
  ) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  async function searchWger(q: string) {
    setWgerSearch(q)
    if (q.length < 3) { setWgerResults([]); return }
    try {
      // exerciseinfo returns muscles as objects and name via translations[]
      const res = await fetch(
        `https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=8&name=${encodeURIComponent(q)}`
      )
      const data = (await res.json()) as {
        results: {
          id: number
          muscles: { id: number }[]
          muscles_secondary: { id: number }[]
          translations: { name: string }[]
        }[]
      }
      const { WGER_MUSCLE_MAP } = await import("@/lib/muscleMap")
      setWgerResults(
        data.results
          .filter(e => e.translations[0]?.name)
          .map(e => ({
            id: e.id,
            name: e.translations[0].name,
            muscles: e.muscles.flatMap(m => WGER_MUSCLE_MAP[m.id] ?? []) as MuscleId[],
            muscles_secondary: e.muscles_secondary.flatMap(m => WGER_MUSCLE_MAP[m.id] ?? []) as MuscleId[],
          }))
      )
    } catch { /* ignore */ }
  }

  function pickWgerResult(r: WgerResult) {
    setWgerSearch(r.name)
    setEditWgerId(r.id)
    setEditPrimary(new Set(r.muscles))
    setEditSecondary(new Set(r.muscles_secondary))
    setWgerResults([])
  }

  async function save(exerciseName: string) {
    setSaving(true)
    try {
      await fetch("/api/workout/muscles/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseName,
          primary: [...editPrimary],
          secondary: [...editSecondary],
          wgerName: wgerSearch || null,
          wgerId: editWgerId ?? undefined,
        }),
      })
      setRows(prev =>
        prev.map(r =>
          r.exerciseName === exerciseName
            ? { ...r, primary: [...editPrimary], secondary: [...editSecondary], override: true, confidence: 1 }
            : r
        )
      )
      setSaved(exerciseName)
      setTimeout(() => { setSaved(null); setEditId(null) }, 1200)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const INPUT = {
    padding: "6px 10px",
    background: "#111827",
    border: "1px solid #2d3748",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "0.85rem",
    outline: "none",
  } as const

  return (
    <div style={{ background: "#0f1117", minHeight: "100vh", color: "#e2e8f0", padding: "1.5rem 20px" }}>
      {/* Header */}
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <a href="/workout" style={{ color: MUTED, fontSize: "0.82rem", textDecoration: "none" }}>← Back to Dashboard</a>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f1f5f9", margin: "0.75rem 0 0.25rem" }}>
          Muscle Mappings
        </h1>
        <p style={{ fontSize: "0.82rem", color: MUTED, marginBottom: "1.5rem" }}>
          Review how your exercises map to muscles. Changes save immediately.
          Low-confidence matches (⚠️) are shown first.
        </p>

        {/* Controls */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1rem", flexWrap: "wrap" }}>
          {(["all", "review", "overridden"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: `1px solid ${filter === f ? ACCENT : "#2d3748"}`,
                background: filter === f ? "rgba(0,170,255,0.15)" : "transparent",
                color: filter === f ? ACCENT : MUTED,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              {f === "all" ? "All" : f === "review" ? "Needs Review" : "Overridden"}
            </button>
          ))}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises…"
            style={{ ...INPUT, width: "220px", marginLeft: "auto" }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <p style={{ color: MUTED }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {filtered.map(row => {
              const isEditing = editId === row.exerciseName
              const isSaved = saved === row.exerciseName
              const needsReview = row.confidence < 0.7 && !row.override

              return (
                <div key={row.exerciseName} style={{ ...CARD, overflow: "hidden" }}>
                  {/* Row summary */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto auto auto",
                    gap: "10px",
                    padding: "10px 14px",
                    alignItems: "center",
                    fontSize: "0.83rem",
                  }}>
                    <span style={{ fontWeight: 600, color: needsReview ? "#fbbf24" : "#e2e8f0" }}>
                      {needsReview && "⚠️ "}{row.exerciseName}
                    </span>
                    <span style={{ color: MUTED, fontSize: "0.78rem" }}>
                      {row.wgerName ?? "—"}{" "}
                      <span style={{ color: needsReview ? "#fbbf24" : "#64748b" }}>
                        ({Math.round(row.confidence * 100)}%)
                      </span>
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                      {row.primary.map(m => MUSCLE_LABEL[m]).join(", ") || "—"}
                    </span>
                    {row.override && (
                      <span style={{ background: "rgba(0,170,255,0.15)", color: ACCENT, borderRadius: "999px", padding: "1px 8px", fontSize: "0.68rem" }}>
                        edited
                      </span>
                    )}
                    <button
                      onClick={() => isEditing ? setEditId(null) : openEdit(row)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "6px",
                        border: `1px solid ${isEditing ? "#2d3748" : ACCENT}`,
                        background: "transparent",
                        color: isEditing ? MUTED : ACCENT,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      {isSaved ? "✓ Saved" : isEditing ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <div style={{ borderTop: "1px solid #2d3748", padding: "14px 14px 16px", background: "#111827" }}>
                      {/* Wger search */}
                      <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                        Search Wger exercises (auto-fills muscles)
                      </p>
                      <div style={{ position: "relative", marginBottom: "16px" }}>
                        <input
                          value={wgerSearch}
                          onChange={e => searchWger(e.target.value)}
                          placeholder="e.g. Bench Press…"
                          style={{ ...INPUT, width: "100%", boxSizing: "border-box" }}
                        />
                        {wgerResults.length > 0 && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0,
                            background: "#1a1f2e", border: "1px solid #2d3748",
                            borderRadius: "6px", zIndex: 10, marginTop: "2px",
                          }}>
                            {wgerResults.slice(0, 5).map(r => (
                              <button
                                key={r.id}
                                onClick={() => pickWgerResult(r)}
                                style={{
                                  display: "block", width: "100%", padding: "8px 12px",
                                  background: "transparent", border: "none",
                                  borderBottom: "1px solid #2d3748",
                                  color: "#e2e8f0", fontSize: "0.82rem",
                                  textAlign: "left", cursor: "pointer",
                                }}
                              >
                                {r.name}
                                <span style={{ color: MUTED, marginLeft: "8px", fontSize: "0.72rem" }}>
                                  → {r.muscles.map(m => MUSCLE_LABEL[m]).join(", ") || "—"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Muscle checkboxes */}
                      {(["primary", "secondary"] as const).map(group => {
                        const activeSet = group === "primary" ? editPrimary : editSecondary
                        const setter = group === "primary" ? setEditPrimary : setEditSecondary
                        return (
                          <div key={group} style={{ marginBottom: "14px" }}>
                            <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                              {group === "primary" ? "Primary muscles" : "Secondary muscles"}
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {ALL_MUSCLES.map(m => {
                                const active = activeSet.has(m)
                                return (
                                  <button
                                    key={m}
                                    onClick={() => toggleMuscle(activeSet, setter, m)}
                                    style={{
                                      ...PILL_BASE,
                                      background: active
                                        ? group === "primary" ? "rgba(0,170,255,0.2)" : "rgba(0,170,255,0.1)"
                                        : "transparent",
                                      border: `1px solid ${active ? ACCENT : "#2d3748"}`,
                                      color: active ? ACCENT : MUTED,
                                      fontWeight: active ? 600 : 400,
                                    }}
                                  >
                                    {MUSCLE_LABEL[m]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      <button
                        onClick={() => save(row.exerciseName)}
                        disabled={saving}
                        style={{
                          padding: "8px 20px",
                          borderRadius: "6px",
                          border: "none",
                          background: saving ? "#2d3748" : ACCENT,
                          color: saving ? MUTED : "#000",
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          cursor: saving ? "not-allowed" : "pointer",
                        }}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p style={{ color: MUTED, textAlign: "center", padding: "2rem" }}>No exercises match this filter.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
