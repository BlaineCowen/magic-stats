"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { filterByDateRange, type WorkoutRow } from "@/lib/workout"
import OverviewTab from "@/components/workout/OverviewTab"
import ExerciseExplorer from "@/components/workout/ExerciseExplorer"
import WorkoutLog from "@/components/workout/WorkoutLog"
import PersonalRecords from "@/components/workout/PersonalRecords"
import MuscleMap from "@/components/workout/MuscleMap"
import { useIsMobile } from "@/hooks/useIsMobile"

const ACCENT = "#00aaff"
const MUTED = "#94a3b8"

type Tab = "overview" | "explorer" | "workouts" | "records" | "muscles"
const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "overview", label: "Overview",          short: "Overview" },
  { id: "explorer", label: "Exercise Explorer", short: "Explorer" },
  { id: "workouts", label: "Workouts",          short: "Workouts" },
  { id: "records",  label: "Personal Records",  short: "Records"  },
  { id: "muscles",  label: "Muscle Map",        short: "Muscles"  },
]

function displayName(username: string): string {
  return username
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function WorkoutPage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<WorkoutRow[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [metric, setMetric] = useState<"weight" | "1rm" | "reps">("weight")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const mtimeRef = useRef(0)

  // Multi-user state
  const [user, setUser] = useState("blaine")
  const [users, setUsers] = useState<string[]>(["blaine"])
  const [showUpload, setShowUpload] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Upload form state
  const [newName, setNewName] = useState("")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/workout/users")
      .then(r => r.json())
      .then((d: { users: string[] }) => setUsers(d.users))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (force = false, forUser = "blaine") => {
    try {
      const res = await fetch(`/api/workout/data?user=${forUser}`, { cache: "no-store" })
      const data = (await res.json()) as { rows: WorkoutRow[]; mtime: number }
      if (!force && data.mtime === mtimeRef.current) return
      mtimeRef.current = data.mtime
      setRows(data.rows)

      if (force && data.rows.length > 0) {
        const today = new Date().toISOString().slice(0, 10)
        const allDates = data.rows.map(r => r.dateStr)
        const minDate = allDates.reduce((a, b) => (a < b ? a : b))
        const dates2026 = allDates.filter(d => d.startsWith("2026"))
        const defaultStart =
          forUser === "blaine" && dates2026.length > 0
            ? dates2026.reduce((a, b) => (a < b ? a : b))
            : minDate
        setStartDate(s => s || defaultStart)
        setEndDate(e => e || today)
      }
    } catch {
      // network error — keep existing data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setRows([])
    setStartDate("")
    setEndDate("")
    setLoading(true)
    mtimeRef.current = 0
    void fetchData(true, user)
    const id = setInterval(() => void fetchData(false, user), 30_000)
    return () => clearInterval(id)
  }, [fetchData, user])

  const filteredRows = useMemo(
    () => filterByDateRange(rows, startDate, endDate),
    [rows, startDate, endDate],
  )

  const status = useMemo(() => {
    if (loading) return "Loading…"
    if (rows.length === 0) return "No data"
    const sessions = new Set(filteredRows.map(r => r.dateStr)).size
    return `✓ ${filteredRows.length.toLocaleString()} sets · ${sessions} sessions`
  }, [loading, rows.length, filteredRows])

  const setPreset = useCallback(
    (preset: "all" | "1y" | "6m") => {
      const today = new Date().toISOString().slice(0, 10)
      if (preset === "all") {
        const all = rows.map(r => r.dateStr)
        setStartDate(all.reduce((a, b) => (a < b ? a : b), today))
        setEndDate(all.reduce((a, b) => (a > b ? a : b), today))
      } else {
        const d = new Date()
        if (preset === "1y") d.setFullYear(d.getFullYear() - 1)
        else d.setMonth(d.getMonth() - 6)
        setStartDate(d.toISOString().slice(0, 10))
        setEndDate(today)
      }
    },
    [rows],
  )

  function closeUpload() {
    setShowUpload(false)
    setUploadError("")
    setNewName("")
    setUploadFile(null)
  }

  async function handleUpload() {
    if (!newName || !uploadFile) return
    setUploading(true)
    setUploadError("")
    try {
      const form = new FormData()
      form.append("username", newName)
      form.append("file", uploadFile)
      const res = await fetch("/api/workout/upload", { method: "POST", body: form })
      const data = (await res.json()) as { username?: string; error?: string }
      if (!res.ok || !data.username) {
        setUploadError(data.error ?? "Upload failed")
        return
      }
      setUsers(prev => (prev.includes(data.username!) ? prev : [...prev, data.username!]))
      setUser(data.username!)
      closeUpload()
    } catch {
      setUploadError("Upload failed — check your connection and try again")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(username: string) {
    await fetch(`/api/workout/users?user=${username}`, { method: "DELETE" })
    setUsers(prev => prev.filter(u => u !== username))
    if (user === username) setUser("blaine")
    setDeleteConfirm(null)
  }

  const NAV_BTN = (active = false) => ({
    padding: "4px 10px",
    border: "1px solid #2d3748",
    borderRadius: "6px",
    background: active ? "rgba(0,170,255,0.15)" : "transparent",
    color: active ? ACCENT : MUTED,
    fontSize: "0.8rem",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
  } as const)

  const DATE_INPUT = {
    padding: "4px 8px",
    background: "#1a1f2e",
    border: "1px solid #2d3748",
    borderRadius: "6px",
    color: "#e2e8f0",
    fontSize: "0.82rem",
    colorScheme: "dark",
    outline: "none",
  } as const

  return (
    <div>
      {/* Navbar */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#0a0d13",
        borderBottom: "1px solid #2d3748",
        padding: "10px 20px",
      }}>
        {/* Main row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* User selector + delete */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <select
              value={user}
              onChange={e => {
                if (e.target.value === "__new__") { setShowUpload(true); return }
                setDeleteConfirm(null)
                setUser(e.target.value)
              }}
              style={{
                padding: "4px 8px",
                background: "#1a1f2e",
                border: `1px solid ${ACCENT}`,
                borderRadius: "6px",
                color: "#e2e8f0",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {users.map(u => (
                <option key={u} value={u}>{displayName(u)}</option>
              ))}
              <option value="__new__">+ Add User…</option>
            </select>

            {/* Delete button — only for non-Blaine users */}
            {user !== "blaine" && (
              deleteConfirm === user ? (
                <>
                  <button
                    onClick={() => handleDelete(user)}
                    style={{ padding: "3px 10px", borderRadius: "6px", border: "1px solid #ef4444", background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    Confirm delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #2d3748", background: "transparent", color: MUTED, fontSize: "0.78rem", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(user)}
                  title={`Delete ${displayName(user)}`}
                  style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #2d3748", background: "transparent", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer", lineHeight: 1 }}
                >
                  🗑
                </button>
              )
            )}
          </div>

          {!isMobile && <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#64748b" }}>💪 Workout Dashboard</span>}

          {/* Presets + date inputs — always on desktop, toggleable on mobile */}
          {(!isMobile || filtersOpen) && (
            <>
              <div style={{ display: "flex", gap: "4px" }}>
                {(["all", "1y", "6m"] as const).map(p => (
                  <button key={p} onClick={() => setPreset(p)} style={NAV_BTN()}>
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={DATE_INPUT} />
                <span style={{ color: MUTED }}>→</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={DATE_INPUT} />
              </div>
            </>
          )}

          {/* Status + refresh + mobile filter toggle */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: MUTED, fontSize: "0.8rem" }}>{status}</span>
            <button
              onClick={() => void fetchData(true, user)}
              title="Refresh data"
              style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid #2d3748", background: "transparent", color: MUTED, fontSize: "0.82rem", cursor: "pointer", lineHeight: 1 }}
            >
              ↺
            </button>
            {isMobile && (
              <button
                onClick={() => setFiltersOpen(f => !f)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: `1px solid ${filtersOpen ? ACCENT : "#2d3748"}`,
                  background: filtersOpen ? "rgba(0,170,255,0.15)" : "transparent",
                  color: filtersOpen ? ACCENT : MUTED,
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {filtersOpen ? "▲ Filters" : "▼ Filters"}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Upload panel */}
      {showUpload && (
        <div style={{
          background: "#111827",
          borderBottom: "1px solid #2d3748",
          padding: "20px",
        }}>
          <div style={{ maxWidth: "420px", margin: "0 auto" }}>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#f1f5f9", margin: "0 0 4px" }}>Add a New User</p>
            <p style={{ fontSize: "0.82rem", color: MUTED, margin: "0 0 20px" }}>
              Export your workouts from the Strong app: <strong style={{ color: "#e2e8f0" }}>Profile → Settings → Export Strong Data</strong> — then upload the CSV here.
            </p>

            {/* Step 1 */}
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Your name
            </label>
            <input
              placeholder="e.g. Alice"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoCapitalize="words"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 12px",
                background: "#1a1f2e",
                border: "1px solid #2d3748",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "1rem",
                outline: "none",
                marginBottom: "16px",
                boxSizing: "border-box",
              }}
            />

            {/* Step 2 */}
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
              Strong CSV file
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 14px",
                background: "#1a1f2e",
                border: `1px solid ${uploadFile ? ACCENT : "#2d3748"}`,
                borderRadius: "8px",
                color: uploadFile ? "#e2e8f0" : MUTED,
                fontSize: "0.9rem",
                cursor: "pointer",
                textAlign: "left",
                marginBottom: "20px",
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>{uploadFile ? "📄" : "📂"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {uploadFile ? uploadFile.name : "Choose CSV file…"}
              </span>
            </button>

            {uploadError && (
              <p style={{ color: "#f87171", fontSize: "0.82rem", margin: "0 0 12px" }}>{uploadError}</p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleUpload}
                disabled={uploading || !newName.trim() || !uploadFile}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: "8px",
                  border: "none",
                  background: uploading || !newName.trim() || !uploadFile ? "#2d3748" : ACCENT,
                  color: uploading || !newName.trim() || !uploadFile ? MUTED : "#000",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  cursor: uploading || !newName.trim() || !uploadFile ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "Uploading…" : "Upload & View"}
              </button>
              <button
                onClick={closeUpload}
                style={{
                  padding: "11px 18px",
                  borderRadius: "8px",
                  border: "1px solid #2d3748",
                  background: "transparent",
                  color: MUTED,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ borderBottom: "1px solid #2d3748", padding: "0 20px", display: "flex", gap: "0", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: isMobile ? "10px 10px" : "12px 18px",
              border: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${ACCENT}` : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? ACCENT : MUTED,
              fontSize: isMobile ? "0.78rem" : "0.88rem",
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isMobile ? tab.short : tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "1.5rem 20px", maxWidth: "1400px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>💪</div>
            Loading workout data…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: MUTED }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📋</div>
            <p>No workout data found for {displayName(user)}.</p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab rows={filteredRows} />}
            {activeTab === "explorer" && (
              <ExerciseExplorer
                rows={filteredRows}
                allRows={rows}
                selected={selectedExercise}
                onSelect={setSelectedExercise}
                metric={metric}
                onMetricChange={setMetric}
              />
            )}
            {activeTab === "workouts" && <WorkoutLog rows={filteredRows} allRows={rows} />}
            {activeTab === "records" && <PersonalRecords rows={filteredRows} />}
            {activeTab === "muscles" && <MuscleMap rows={filteredRows} user={user} />}
          </>
        )}
      </div>
    </div>
  )
}
