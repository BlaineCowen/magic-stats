"use client"

import { useState } from "react"

import { diffFormat, parseDraftRef, type DraftFormat } from "@/lib/livedraft/format"
import type { LeagueInfo } from "@/lib/livedraft/types"

/**
 * Point the app at another Sleeper draft.
 *
 * The panel deliberately shows the detected format and how it differs from your
 * league *before* you start. A mock is often a different shape — losing the
 * superflex slot alone moves quarterback replacement from QB22 to QB12 — and
 * running the league's board against it would produce confident, wrong advice.
 */
export function MockPanel({
  league,
  onStart,
  onClose,
}: {
  league: LeagueInfo
  onStart: (opts: { draftId: string; slot: number; recompute: boolean; ppr?: number }) => void
  onClose: () => void
}) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<DraftFormat | null>(null)
  const [recompute, setRecompute] = useState(true)
  const [ppr, setPpr] = useState<number | null>(null)
  const [slot, setSlot] = useState<number | null>(null)

  async function resolve() {
    setError(null)
    setFormat(null)
    const ref = parseDraftRef(input)
    if (!ref) {
      setError("Could not find a draft or league id in that. Paste a Sleeper draft link, league link, or id.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/livedraft/resolve?${new URLSearchParams({ kind: ref.kind, id: ref.id })}`,
      )
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? "Could not load that draft")
      setFormat(body.format as DraftFormat)
      setSlot((body.format as DraftFormat).detectedSlot)
      setPpr(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that draft")
    } finally {
      setLoading(false)
    }
  }

  const diffs = format ? diffFormat(league, format) : []
  const material = diffs.filter((d) => d.material)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-4 sm:rounded-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Mock draft</h2>
            <p className="text-[11px] text-slate-500">
              Run the assistant against any Sleeper draft.
            </p>
          </div>
          <button onClick={onClose} className="px-2 text-lg leading-none text-slate-400">
            &times;
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void resolve()}
            placeholder="sleeper.com/draft/nfl/… or a league link / id"
            className="min-w-0 flex-1 rounded border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            onClick={() => void resolve()}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {loading ? "…" : "Load"}
          </button>
        </div>

        {error && (
          <p className="mt-2 rounded bg-red-50 px-2.5 py-2 text-[11px] text-red-800">{error}</p>
        )}

        {format && (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-slate-200 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-slate-900">{format.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {format.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-600">
                {format.numTeams} teams · {format.rounds} rounds ·{" "}
                {format.starterSlots.join(" ")}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{format.scoringNote}</div>
            </div>

            {material.length === 0 ? (
              <p className="rounded bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-900">
                Same format as your league — the board applies directly.
              </p>
            ) : (
              <div className="rounded bg-amber-50 px-2.5 py-2">
                <p className="text-[11px] font-medium text-amber-900">
                  Different format from your league:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {material.map((d) => (
                    <li key={d.label} className="text-[11px] text-amber-900">
                      <b>{d.label}:</b> {d.league} → {d.mock}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <label className="flex items-start gap-2 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={recompute}
                onChange={(e) => setRecompute(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-slate-900"
              />
              <span>
                <b>Recompute the board for this format.</b> Re-scores every player and
                recomputes replacement levels. Turn this off to keep your league&rsquo;s
                settings — useful for rehearsing your own draft, misleading otherwise.
              </span>
            </label>

            {format.scoringAmbiguous && (
              <div>
                <label className="text-[11px] font-medium text-slate-600">
                  PPR (Sleeper didn&rsquo;t say — override if this is wrong)
                </label>
                <div className="mt-1 flex gap-1">
                  {[0, 0.5, 1].map((v) => (
                    <button
                      key={v}
                      onClick={() => setPpr(v)}
                      className={`rounded px-2.5 py-1 text-xs ${
                        (ppr ?? format.ppr) === v
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {v === 0 ? "Standard" : v === 0.5 ? "Half PPR" : "Full PPR"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-medium text-slate-600">
                Your slot{" "}
                {format.detectedSlot
                  ? `(detected: ${format.detectedSlot})`
                  : "(not detected — you may not have joined yet)"}
              </label>
              <input
                type="number"
                min={1}
                max={format.numTeams}
                value={slot ?? ""}
                onChange={(e) => setSlot(Number(e.target.value) || null)}
                placeholder="1"
                className="mt-1 w-24 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>

            <button
              onClick={() =>
                onStart({
                  draftId: format.draftId,
                  slot: slot ?? 1,
                  recompute,
                  ppr: ppr ?? undefined,
                })
              }
              disabled={!slot}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Start mock
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Persistent reminder that the board on screen is not your league. */
export function MockBanner({
  draftId,
  recomputed,
  numTeams,
  onExit,
}: {
  draftId: string
  recomputed: boolean
  numTeams: number
  onExit: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-[11px] text-amber-900">
      <span className="truncate">
        <b>Mock</b> · {numTeams} teams ·{" "}
        {recomputed ? "board recomputed for this format" : "using your league settings"}
        <span className="ml-1 text-amber-700">#{draftId.slice(-6)}</span>
      </span>
      <button
        onClick={onExit}
        className="shrink-0 rounded bg-amber-900 px-2 py-0.5 font-medium text-white"
      >
        Exit
      </button>
    </div>
  )
}
