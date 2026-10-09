"use client"

import { useMemo, useState } from "react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts"
import { exerciseSessions, exercisePRMap, topExercises, addTrendAndForecast, type WorkoutRow, type ExtendedChartPoint } from "@/lib/workout"
import { useIsMobile } from "@/hooks/useIsMobile"

const ACCENT = "#00aaff"
const GOLD = "#ffd700"
const CARD = { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "10px" }
const MUTED = "#94a3b8"
const TOOLTIP_STYLE = { background: "#1a1f2e", border: "1px solid #2d3748", color: "#e2e8f0", borderRadius: "6px", fontSize: "0.85rem" }

const BODY_PARTS = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Other"]

const METRIC_LABELS: Record<"weight" | "1rm" | "reps", string> = {
  weight: "lbs",
  "1rm": "lbs est. 1RM",
  reps: "reps",
}

function ChartTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean
  payload?: { payload: ExtendedChartPoint }[]
  label?: string
  metric: "weight" | "1rm" | "reps"
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  const isForecastOnly = d.maxWeight === null && d.bestEst1rm === null && d.maxReps === null

  return (
    <div style={{ ...TOOLTIP_STYLE, padding: "8px 12px", lineHeight: "1.6" }}>
      <div style={{ color: MUTED, fontSize: "0.78rem", marginBottom: "4px" }}>{label}</div>
      {!isForecastOnly && (
        <>
          <div style={{ color: ACCENT }}>{d.maxWeight?.toFixed(1)} lbs</div>
          <div style={{ color: "#e2e8f0" }}>{d.maxReps} reps</div>
          <div style={{ color: GOLD }}>{d.bestEst1rm?.toFixed(1)} lbs est. 1RM</div>
        </>
      )}
      {d.forecast !== null && (
        <div style={{ color: "#a855f7" }}>
          {d.forecast.toFixed(metric === "reps" ? 0 : 1)} {METRIC_LABELS[metric]} (projected)
        </div>
      )}
    </div>
  )
}

interface Props {
  rows: WorkoutRow[]
  allRows: WorkoutRow[]
  selected: string | null
  onSelect: (name: string) => void
  metric: "weight" | "1rm" | "reps"
  onMetricChange: (m: "weight" | "1rm" | "reps") => void
}

export default function ExerciseExplorer({ rows, allRows, selected, onSelect, metric, onMetricChange }: Props) {
  const isMobile = useIsMobile()
  const [bodyPart, setBodyPart] = useState("All")
  const [search, setSearch] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTrend, setShowTrend] = useState(false)
  const [showForecast, setShowForecast] = useState(false)

  const exerciseList = useMemo(() => {
    const counts = topExercises(rows, 999)
    return counts.filter(e => {
      if (bodyPart !== "All" && !rows.find(r => r.exerciseName === e.exercise && r.bodyPart === bodyPart)) return false
      if (search && !e.exercise.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, bodyPart, search])

  // Resolve selected: default to most-frequent if none
  const activeExercise = selected ?? exerciseList[0]?.exercise ?? null

  const chartData = useMemo(
    () => (activeExercise ? exerciseSessions(rows, activeExercise) : []),
    [rows, activeExercise],
  )

  const prMap = useMemo(() => exercisePRMap(allRows), [allRows])
  const pr = activeExercise ? prMap.get(activeExercise) : null
  const prDate = useMemo(() => {
    if (!activeExercise || !pr) return null
    const hit = allRows.filter(r => r.exerciseName === activeExercise && Math.abs(r.weight - pr.weight) < 0.01)
    return hit.sort((a, b) => a.dateStr.localeCompare(b.dateStr))[0]?.dateStr ?? null
  }, [allRows, activeExercise, pr])

  const GREEN = "#4ade80"
  const PURPLE = "#a855f7"
  const lineColor = metric === "weight" ? ACCENT : metric === "1rm" ? GOLD : GREEN
  const metricKey = metric === "weight" ? "maxWeight" : metric === "1rm" ? "bestEst1rm" : "maxReps"
  const yLabel = metric === "weight" ? "Max Weight (lbs)" : metric === "1rm" ? "Est. 1RM (lbs)" : "Max Reps"

  const extendedData = useMemo(
    () => addTrendAndForecast(chartData, metricKey, showForecast ? 365 : 0),
    [chartData, metricKey, showForecast],
  )

  const sidebar = (
    <div style={isMobile ? { width: "100%", marginBottom: "12px" } : { width: "260px", flexShrink: 0 }}>
      {/* Body part pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
        {BODY_PARTS.map(bp => (
          <button
            key={bp}
            onClick={() => setBodyPart(bp)}
            style={{
              padding: "3px 10px",
              borderRadius: "999px",
              border: `1px solid ${bodyPart === bp ? ACCENT : "#2d3748"}`,
              background: bodyPart === bp ? "rgba(0,170,255,0.15)" : "transparent",
              color: bodyPart === bp ? ACCENT : MUTED,
              fontSize: "0.75rem",
              cursor: "pointer",
              fontWeight: bodyPart === bp ? 600 : 400,
            }}
          >
            {bp}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search exercises…"
        style={{
          width: "100%",
          padding: "6px 10px",
          background: "#1a1f2e",
          border: "1px solid #2d3748",
          borderRadius: "6px",
          color: "#e2e8f0",
          fontSize: "0.85rem",
          marginBottom: "8px",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      {/* Exercise list */}
      <div style={{ overflowY: "auto", maxHeight: isMobile ? "45vh" : "60vh", borderRadius: "8px", border: "1px solid #2d3748" }}>
        {exerciseList.map(e => (
          <button
            key={e.exercise}
            onClick={() => { onSelect(e.exercise); if (isMobile) setSidebarOpen(false) }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "8px 12px",
              background: e.exercise === activeExercise ? "rgba(0,170,255,0.12)" : "transparent",
              borderTop: "none",
              borderRight: "none",
              borderBottom: "1px solid #2d3748",
              borderLeft: e.exercise === activeExercise ? `3px solid ${ACCENT}` : "3px solid transparent",
              color: e.exercise === activeExercise ? ACCENT : "#e2e8f0",
              fontSize: "0.82rem",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, paddingRight: "8px" }}>{e.exercise}</span>
            <span style={{ background: "#2d3748", color: MUTED, borderRadius: "999px", padding: "1px 7px", fontSize: "0.72rem", flexShrink: 0 }}>{e.sessions}</span>
          </button>
        ))}
        {exerciseList.length === 0 && (
          <p style={{ color: MUTED, fontSize: "0.82rem", padding: "1rem", margin: 0, textAlign: "center" }}>No exercises found</p>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "1.25rem", alignItems: "flex-start" }}>
      {/* Desktop: always-visible sidebar */}
      {!isMobile && sidebar}

      {/* Right: chart */}
      <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined }}>
        {/* Mobile: toggle button + collapsible sidebar */}
        {isMobile && (
          <>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                width: "100%",
                padding: "10px",
                background: "#1a1f2e",
                border: `1px solid ${sidebarOpen ? ACCENT : "#2d3748"}`,
                borderRadius: "8px",
                color: sidebarOpen ? ACCENT : MUTED,
                fontSize: "0.85rem",
                cursor: "pointer",
                marginBottom: "8px",
                textAlign: "left",
              }}
            >
              {sidebarOpen ? "▲ Close Exercise List" : `☰ ${activeExercise ?? "Choose Exercise"}`}
            </button>
            {sidebarOpen && sidebar}
          </>
        )}

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeExercise ?? "Select an exercise"}
          </h2>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Metric buttons */}
            <div style={{ display: "flex", gap: "4px" }}>
              {(["weight", "1rm", "reps"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => onMetricChange(m)}
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
                  {isMobile
                    ? (m === "weight" ? "Weight" : m === "1rm" ? "1RM" : "Reps")
                    : (m === "weight" ? "Max Weight" : m === "1rm" ? "Est. 1RM" : "Max Reps")}
                </button>
              ))}
            </div>
            {/* Trend / Forecast toggles — only shown when enough data to fit a curve */}
            {chartData.length >= 3 && (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => {
                    if (showTrend) {
                      setShowTrend(false)
                      setShowForecast(false)
                    } else {
                      setShowTrend(true)
                    }
                  }}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${showTrend ? "#94a3b8" : "#2d3748"}`,
                    background: showTrend ? "rgba(148,163,184,0.15)" : "transparent",
                    color: showTrend ? "#e2e8f0" : MUTED,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    fontWeight: showTrend ? 600 : 400,
                  }}
                >
                  Trend
                </button>
                <button
                  onClick={() => {
                    if (showForecast) {
                      setShowForecast(false)
                    } else {
                      setShowForecast(true)
                      setShowTrend(true)
                    }
                  }}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${showForecast ? PURPLE : "#2d3748"}`,
                    background: showForecast ? "rgba(168,85,247,0.15)" : "transparent",
                    color: showForecast ? PURPLE : MUTED,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    fontWeight: showForecast ? 600 : 400,
                  }}
                >
                  +1yr
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div style={{ ...CARD, padding: "0.75rem" }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={extendedData} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="date" stroke="#444" tick={{ fill: "#666", fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#444" tick={{ fill: "#666", fontSize: 11 }} label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#555", fontSize: 11, offset: -4 }} />
                <Tooltip content={<ChartTooltip metric={metric} />} />
                <Line
                  type="monotone"
                  dataKey={metricKey}
                  stroke={lineColor}
                  strokeWidth={2.5}
                  dot={<Dot r={5} fill={lineColor} stroke="#0f1117" strokeWidth={2} />}
                  activeDot={{ r: 7, fill: lineColor }}
                  connectNulls={false}
                />
                {showTrend && (
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke={lineColor}
                    strokeWidth={2}
                    strokeOpacity={0.4}
                    dot={false as never}
                    activeDot={false as never}
                    connectNulls={false}
                  />
                )}
                {showForecast && (
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke={PURPLE}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false as never}
                    activeDot={false as never}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "340px", display: "flex", alignItems: "center", justifyContent: "center", color: MUTED }}>
              No data for this exercise in the selected date range
            </div>
          )}
        </div>

        {/* PR chips */}
        {pr && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginTop: "1rem" }}>
            {[
              { label: "All-time PR", value: `${pr.weight.toFixed(1)} lbs` },
              { label: "Best Est. 1RM", value: `${pr.est1rm.toFixed(1)} lbs` },
              { label: "PR Date", value: prDate ?? "—" },
            ].map(chip => (
              <div key={chip.label} style={{ ...CARD, padding: "0.85rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, margin: "0 0 0.3rem" }}>{chip.label}</p>
                <p style={{ fontSize: "1.1rem", fontWeight: 700, color: ACCENT, margin: 0 }}>{chip.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
