"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { BlaineScore, Board, TeamAdjustment } from "@/lib/livedraft/types"

const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET",
  "GB", "HOU", "IND", "JAX", "KC", "LAC", "LAR", "LV", "MIA", "MIN", "NE",
  "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
]

// Kept in step with MIN/MAX_MULTIPLIER in src/adjustments.py.
const MIN = 0.6
const MAX = 1.4
const STEP = 0.01

export function BlaineScoreEditor({ board }: { board: Board }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ["livedraft", "blaine"],
    queryFn: async () => (await fetch("/api/livedraft/blaine")).json() as Promise<BlaineScore>,
    initialData: board.blaineScore,
  })

  const [draft, setDraft] = useState<BlaineScore>(data)
  const [team, setTeam] = useState("LV")
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => setDraft(data), [data])

  const save = useMutation({
    mutationFn: async (next: BlaineScore) => {
      const res = await fetch("/api/livedraft/blaine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error("Save failed")
      return res.json() as Promise<{ note: string }>
    },
    onSuccess: (r) => {
      setSaved(r.note)
      void qc.invalidateQueries({ queryKey: ["livedraft", "blaine"] })
    },
  })

  // Saving only records the opinion; the board changes when the pipeline
  // reruns. Triggering that from here is what makes the editor actually useful
  // rather than a two-hour-delayed promise.
  const rebuild = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/livedraft/rebuild", { method: "POST" })
      if (!res.ok) throw new Error("Rebuild request failed")
      return res.json() as Promise<{ note: string }>
    },
    onSuccess: (r) => setSaved(r.note),
  })

  async function saveAndRebuild() {
    await save.mutateAsync(draft)
    await rebuild.mutateAsync()
  }

  const current: TeamAdjustment = draft.teams[team] ?? { pass: 1, rush: 1, note: "" }

  function setTeamValue(key: "pass" | "rush", value: number) {
    setDraft((d) => ({
      ...d,
      teams: { ...d.teams, [team]: { ...current, [key]: value } },
    }))
  }

  // Which players this adjustment would actually touch — an opinion you cannot
  // see the consequences of is one you cannot sanity-check.
  const affected = useMemo(
    () =>
      board.players
        .filter((p) => p.team === team)
        .sort((a, b) => (b.vor ?? 0) - (a.vor ?? 0))
        .slice(0, 6),
    [board, team],
  )

  const active = Object.entries(draft.teams).filter(
    ([, a]) => (a.pass ?? 1) !== 1 || (a.rush ?? 1) !== 1,
  )

  return (
    <div className="space-y-5 px-3 py-3 pb-24 sm:pb-6">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          blaine_score
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Your opinions, applied to the component stat line before anything is
          scored — so a pass-game boost lifts receiving yards <i>and</i>{" "}
          touchdowns, and flows through VOR, tiers and VONA. Above 1.00 is
          positive, below is negative. These sit on top of three professional
          projections, so ±10% is already a strong take.
        </p>
      </section>

      <section className="space-y-2">
        <label className="block text-[11px] font-medium text-slate-600">
          Global weight — scales every adjustment at once ({draft.weight.toFixed(2)}×)
        </label>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={draft.weight}
          onChange={(e) => setDraft((d) => ({ ...d, weight: Number(e.target.value) }))}
          className="w-full accent-slate-900"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>0 — ignore my opinions</span>
          <span>1.5× — lean in hard</span>
        </div>
      </section>

      <section className="space-y-3 rounded border border-slate-200 p-3">
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        >
          {NFL_TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
              {draft.teams[t] ? " ●" : ""}
            </option>
          ))}
        </select>

        <Slider
          label="Pass game (incl. receiving)"
          value={current.pass ?? 1}
          onChange={(v) => setTeamValue("pass", v)}
        />
        <Slider
          label="Run game"
          value={current.rush ?? 1}
          onChange={(v) => setTeamValue("rush", v)}
        />

        <input
          value={current.note ?? ""}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              teams: { ...d.teams, [team]: { ...current, note: e.target.value } },
            }))
          }
          placeholder="Why? e.g. Klint Kubiak OC — play-action heavy"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
        />

        {affected.length > 0 && (
          <div className="text-[10px] text-slate-500">
            Affects: {affected.map((p) => p.name).join(", ")}
            {board.players.filter((p) => p.team === team).length > 6 ? " …" : ""}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => save.mutate(draft)}
            disabled={save.isPending || rebuild.isPending}
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => void saveAndRebuild()}
            disabled={save.isPending || rebuild.isPending}
            className="flex-[2] rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {rebuild.isPending ? "Rebuilding…" : "Save & apply now"}
          </button>
        </div>
        {saved && <p className="text-[11px] text-emerald-700">{saved}</p>}
        {(save.isError || rebuild.isError) && (
          <p className="text-[11px] text-red-700">Failed — check the server logs.</p>
        )}
        <p className="text-[10px] leading-relaxed text-slate-400">
          Save records the opinion; the board only changes when the pipeline
          reruns (every 2h). &ldquo;Save &amp; apply now&rdquo; triggers that
          immediately — takes about a minute.
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Active adjustments
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">None — the board is pure consensus.</p>
        ) : (
          <ul className="space-y-1.5">
            {active.map(([t, a]) => (
              <li key={t} className="rounded border border-slate-200 px-2.5 py-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">{t}</span>
                  <span className="tabular-nums text-slate-600">
                    <Delta value={a.pass ?? 1} label="pass" />{" "}
                    <Delta value={a.rush ?? 1} label="rush" />
                  </span>
                </div>
                {a.note && <div className="mt-0.5 text-[10px] text-slate-500">{a.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Delta({ value, label }: { value: number; label: string }) {
  const pct = Math.round((value - 1) * 100)
  if (pct === 0) return <span className="text-slate-400">{label} –</span>
  return (
    <span className={pct > 0 ? "text-emerald-700" : "text-red-700"}>
      {label} {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  )
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const pct = Math.round((value - 1) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-medium text-slate-600">{label}</label>
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            pct > 0 ? "text-emerald-700" : pct < 0 ? "text-red-700" : "text-slate-400"
          }`}
        >
          {pct > 0 ? "+" : ""}
          {pct}%
        </span>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-slate-900"
      />
    </div>
  )
}
