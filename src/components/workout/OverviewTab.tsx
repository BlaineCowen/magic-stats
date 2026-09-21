"use client"

import { useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { summaryStats, workoutFrequency, topExercises, type WorkoutRow } from "@/lib/workout"
import { useIsMobile } from "@/hooks/useIsMobile"

const ACCENT = "#00aaff"
const CARD = { background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "10px", padding: "1.25rem" }
const MUTED = "#94a3b8"
const TOOLTIP_STYLE = { background: "#1a1f2e", border: "1px solid #2d3748", color: "#e2e8f0", borderRadius: "6px", fontSize: "0.85rem" }

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={CARD}>
      <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: "0.35rem", fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: "1.9rem", fontWeight: 700, color: ACCENT, letterSpacing: "-0.5px", margin: 0 }}>{value}</p>
    </div>
  )
}

function Heatmap({ rows }: { rows: WorkoutRow[] }) {
  const data = useMemo(() => workoutFrequency(rows), [rows])
  const { weeks, grid, dayLabels } = data

  function cellColor(count: number) {
    if (count === 0) return "rgba(255,255,255,0.05)"
    if (count === 1) return "rgba(0,170,255,0.3)"
    if (count === 2) return "rgba(0,170,255,0.65)"
    return ACCENT
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: "6px", minWidth: "fit-content" }}>
        {/* Day labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", paddingTop: "22px" }}>
          {dayLabels.map(d => (
            <div key={d} style={{ height: "13px", lineHeight: "13px", fontSize: "10px", color: "#555", width: "26px", textAlign: "right" }}>{d}</div>
          ))}
        </div>
        {/* Columns */}
        <div>
          {/* Week labels */}
          <div style={{ display: "flex", gap: "3px", marginBottom: "4px" }}>
            {weeks.map((wk, i) => (
              <div key={wk} style={{ width: "13px", fontSize: "9px", color: "#555", overflow: "visible", whiteSpace: "nowrap" }}>
                {i % 8 === 0 ? wk.split("-W")[0] : ""}
              </div>
            ))}
          </div>
          {/* Grid rows */}
          {dayLabels.map((_, di) => (
            <div key={di} style={{ display: "flex", gap: "3px", marginBottom: "3px" }}>
              {weeks.map((wk, wi) => {
                const count = grid[di]?.[wi] ?? 0
                return (
                  <div
                    key={wk}
                    title={`${wk} ${dayLabels[di]}: ${count} workout${count !== 1 ? "s" : ""}`}
                    style={{ width: "13px", height: "13px", background: cellColor(count), borderRadius: "2px", border: "1px solid rgba(255,255,255,0.04)" }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OverviewTab({ rows }: { rows: WorkoutRow[] }) {
  const isMobile = useIsMobile()
  const stats = useMemo(() => summaryStats(rows), [rows])
  const top = useMemo(() => topExercises(rows, 10).reverse(), [rows]) // reverse for horizontal bar bottom-to-top

  const volStr = stats.totalVolume >= 1_000_000
    ? `${(stats.totalVolume / 1_000_000).toFixed(1)}M lbs`
    : `${Math.round(stats.totalVolume).toLocaleString()} lbs`

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
        <StatCard label="Total Workouts" value={String(stats.totalWorkouts)} />
        <StatCard label="Total Volume" value={volStr} />
        <StatCard label="Unique Exercises" value={String(stats.uniqueExercises)} />
        <StatCard label="Avg / Week" value={String(stats.avgPerWeek)} />
      </div>

      {/* Heatmap */}
      <div style={CARD}>
        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Workout Frequency</p>
        <Heatmap rows={rows} />
      </div>

      {/* Top exercises */}
      <div style={CARD}>
        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: MUTED, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Most Trained Exercises</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" horizontal={false} />
            <XAxis type="number" stroke="#444" tick={{ fill: "#666", fontSize: 11 }} />
            <YAxis type="category" dataKey="exercise" width={isMobile ? 110 : 190} stroke="#444" tick={{ fill: "#e2e8f0", fontSize: isMobile ? 10 : 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="sessions" fill={ACCENT} radius={[0, 4, 4, 0]} name="Sessions" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
