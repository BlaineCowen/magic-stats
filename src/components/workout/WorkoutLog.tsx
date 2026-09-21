"use client"

import { useMemo } from "react"
import { groupedSessions, exercisePRMap, type WorkoutRow } from "@/lib/workout"

const ACCENT = "#00aaff"
const GOLD = "#ffd700"
const MUTED = "#94a3b8"
const MONO = { fontFamily: "monospace" }

export default function WorkoutLog({ rows, allRows }: { rows: WorkoutRow[]; allRows: WorkoutRow[] }) {
  const sessions = useMemo(() => groupedSessions(rows), [rows])
  const prMap = useMemo(() => exercisePRMap(allRows), [allRows])

  if (sessions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: MUTED }}>
        No sessions in this date range.
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {sessions.map((session, si) => (
        <details
          key={session.key}
          open={si === 0}
          style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "10px", overflow: "hidden" }}
        >
          <summary style={{
            padding: "12px 16px",
            cursor: "pointer",
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            userSelect: "none",
            fontSize: "0.9rem",
          }}>
            <span style={{ color: ACCENT, fontWeight: 600 }}>▶</span>
            <span style={{ fontWeight: 600, color: "#f1f5f9" }}>📅 {session.date}</span>
            <span style={{ color: "#e2e8f0" }}>{session.workoutName}</span>
            <span style={{ marginLeft: "auto", color: MUTED, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
              {session.duration && session.duration !== "nan" && session.duration !== "0" && `${session.duration} · `}
              {session.nExercises} exercises · {session.nSets} sets
            </span>
          </summary>

          <div style={{ padding: "4px 16px 16px", borderTop: "1px solid #2d3748" }}>
            {session.exercises.map(ex => {
              const pr = prMap.get(ex.name)
              return (
                <div key={ex.name} style={{ marginTop: "14px" }}>
                  <p style={{ color: ACCENT, fontWeight: 600, fontSize: "0.88rem", margin: "0 0 6px" }}>{ex.name}</p>
                  <div style={{ overflowX: "auto" }}>
                  <table style={{ fontSize: "0.82rem", borderCollapse: "collapse" }}>
                    <tbody>
                      {ex.sets.map((set, si) => {
                        const isWeightPR = pr !== undefined && set.weight > 0 && Math.abs(set.weight - pr.weight) < 0.01
                        const is1rmPR = pr !== undefined && set.weight > 0 && Math.abs(set.est1rm - pr.est1rm) < 0.01
                        return (
                          <tr key={si}>
                            <td style={{ ...MONO, color: "#555", paddingRight: "12px", width: "20px" }}>{set.setOrder}</td>
                            <td style={{ ...MONO, paddingRight: "12px", whiteSpace: "nowrap" }}>{set.weight > 0 ? `${set.weight} lbs` : "BW"}</td>
                            <td style={{ ...MONO, paddingRight: "12px" }}>× {set.reps}</td>
                            <td style={{ ...MONO, color: "#666", paddingRight: "12px", whiteSpace: "nowrap" }}>{set.est1rm.toFixed(0)} 1RM</td>
                            <td style={{ whiteSpace: "nowrap", paddingTop: "2px", paddingBottom: "2px" }}>
                              {isWeightPR && (
                                <span style={{ background: ACCENT, color: "#000", borderRadius: "999px", padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700, marginRight: "4px" }}>
                                  ⚖ Weight PR
                                </span>
                              )}
                              {is1rmPR && (
                                <span style={{ background: GOLD, color: "#000", borderRadius: "999px", padding: "1px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
                                  🏆 1RM PR
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      ))}
    </div>
  )
}
