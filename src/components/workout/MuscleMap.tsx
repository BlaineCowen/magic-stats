// src/components/workout/MuscleMap.tsx
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { muscleActivation, type WorkoutRow } from "@/lib/workout"
import { MUSCLE_LABEL, type MuscleId, type MuscleTarget } from "@/lib/muscleMap"
import MuscleSvg from "@/components/workout/MuscleSvg"

const ACCENT = "#00aaff"
const MUTED = "#94a3b8"

interface MappingEntry {
  exerciseName: string
  primary: MuscleId[]
  secondary: MuscleId[]
}

interface Props {
  rows: WorkoutRow[]
  user: string
}

export default function MuscleMap({ rows, user }: Props) {
  const [mappings, setMappings] = useState<Record<string, MuscleTarget>>({})
  const [loadingMap, setLoadingMap] = useState(true)
  const [metric, setMetric] = useState<"sets" | "volume">("sets")
  const [hovered, setHovered] = useState<MuscleId | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingMap(true)
    fetch(`/api/workout/muscles?user=${user}`)
      .then(r => r.json())
      .then((d: { mappings?: MappingEntry[] }) => {
        const map: Record<string, MuscleTarget> = {}
        for (const m of d.mappings ?? []) {
          map[m.exerciseName] = { primary: m.primary, secondary: m.secondary }
        }
        setMappings(map)
      })
      .catch(() => {})
      .finally(() => setLoadingMap(false))
  }, [user])

  const activation = useMemo(() => muscleActivation(rows, mappings), [rows, mappings])

  // Normalize 0–1 for each metric
  const intensities = useMemo(() => {
    const vals = [...activation.values()].map(v => metric === "sets" ? v.sets : v.volume)
    const max = Math.max(...vals, 1)
    const result = new Map<MuscleId, number>()
    for (const [id, v] of activation) {
      result.set(id, (metric === "sets" ? v.sets : v.volume) / max)
    }
    return result
  }, [activation, metric])

  function handleHover(id: MuscleId | null, e?: MouseEvent<SVGElement>) {
    setHovered(id)
    if (e && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 24 })
    }
  }

  function formatStat(id: MuscleId): string {
    const v = activation.get(id)
    if (!v) return "0 sets"
    if (metric === "sets") return `${v.sets.toFixed(1)} sets`
    return `${Math.round(v.volume).toLocaleString()} lbs`
  }

  if (loadingMap) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
        Loading muscle data…
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["sets", "volume"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                padding: "4px 12px",
                borderRadius: "6px",
                border: `1px solid ${metric === m ? ACCENT : "#2d3748"}`,
                background: metric === m ? "rgba(0,170,255,0.15)" : "transparent",
                color: metric === m ? ACCENT : MUTED,
                fontSize: "0.8rem",
                cursor: "pointer",
                fontWeight: metric === m ? 600 : 400,
              }}
            >
              {m === "sets" ? "Sets" : "Volume"}
            </button>
          ))}
        </div>
        <a
          href="/workout/muscle-config"
          style={{ fontSize: "0.8rem", color: MUTED, textDecoration: "none" }}
        >
          ⚙ Review Mappings
        </a>
      </div>

      {/* Body diagrams */}
      <div style={{ display: "flex", gap: "3rem", justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Front</p>
          <MuscleSvg view="front" intensities={intensities} onHover={handleHover} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Back</p>
          <MuscleSvg view="back" intensities={intensities} onHover={handleHover} />
        </div>
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: "absolute",
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: "#1a1f2e",
            border: "1px solid #2d3748",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "0.82rem",
            color: "#e2e8f0",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 20,
          }}
        >
          <span style={{ color: ACCENT, fontWeight: 600 }}>{MUSCLE_LABEL[hovered]}</span>
          {" — "}
          {formatStat(hovered)}
        </div>
      )}
    </div>
  )
}
