// src/components/workout/MuscleMap.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { muscleActivation, type WorkoutRow } from "@/lib/workout"
import { MUSCLE_TO_LIB_SLUG, LIB_SLUG_LABEL, type MuscleId, type MuscleTarget, type LibMuscleSlug } from "@/lib/muscleMap"
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
  const [selected, setSelected] = useState<LibMuscleSlug | null>(null)
  const [gender, setGender] = useState<"male" | "female">(() => {
    if (typeof window === "undefined") return "male"
    return (localStorage.getItem(`muscle-gender-${user}`) as "male" | "female") ?? "male"
  })

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

  function handleSelect(slug: LibMuscleSlug | null) {
    setSelected(slug)
  }

  function formatStat(slug: LibMuscleSlug): string {
    let totalSets = 0
    let totalVolume = 0
    for (const [id, v] of activation) {
      if (MUSCLE_TO_LIB_SLUG[id] === slug) {
        totalSets += v.sets
        totalVolume += v.volume
      }
    }
    if (metric === "sets") return `${totalSets.toFixed(1)} sets`
    return `${Math.round(totalVolume).toLocaleString()} lbs`
  }

  if (loadingMap) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
        Loading muscle data…
      </div>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
          <div style={{ width: "1px", height: "20px", background: "#2d3748" }} />
          <div style={{ display: "flex", gap: "4px" }}>
            {(["male", "female"] as const).map(g => (
              <button
                key={g}
                onClick={() => {
                  setGender(g)
                  localStorage.setItem(`muscle-gender-${user}`, g)
                }}
                style={{
                  padding: "4px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${gender === g ? ACCENT : "#2d3748"}`,
                  background: gender === g ? "rgba(0,170,255,0.15)" : "transparent",
                  color: gender === g ? ACCENT : MUTED,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  fontWeight: gender === g ? 600 : 400,
                }}
              >
                {g === "male" ? "Male" : "Female"}
              </button>
            ))}
          </div>
        </div>
        <a
          href={`/workout/muscle-config?user=${user}`}
          style={{ fontSize: "0.8rem", color: MUTED, textDecoration: "none" }}
        >
          ⚙ Review Mappings
        </a>
      </div>

      {/* Body diagrams */}
      <div style={{ display: "flex", gap: "3rem", justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Front</p>
          <MuscleSvg view="front" gender={gender} intensities={intensities} selected={selected} onSelect={handleSelect} />
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.72rem", color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Back</p>
          <MuscleSvg view="back" gender={gender} intensities={intensities} selected={selected} onSelect={handleSelect} />
        </div>
      </div>

      {/* Selected muscle stats */}
      {selected && (
        <div style={{ textAlign: "center", marginTop: "1.5rem", padding: "10px 16px", background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px", display: "inline-block", margin: "1.5rem auto 0", width: "100%" }}>
          <span style={{ color: "#00aaff", fontWeight: 600, fontSize: "0.9rem" }}>
            {LIB_SLUG_LABEL[selected]}
          </span>
          <span style={{ color: "#94a3b8", marginLeft: "8px", fontSize: "0.85rem" }}>
            — {formatStat(selected)}
          </span>
        </div>
      )}
    </div>
  )
}
