"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import type { Board, DraftState, LivePlayer, Player } from "./types"

/** Query-string describing which draft/format the app is following. */
export interface DraftParams {
  draftId?: string
  slot?: number
  recompute?: boolean
  ppr?: number
}

export function draftQuery(params: DraftParams): string {
  const q = new URLSearchParams()
  if (params.draftId) q.set("draft_id", params.draftId)
  if (params.slot) q.set("slot", String(params.slot))
  if (params.recompute) q.set("recompute", "1")
  if (params.ppr !== undefined) q.set("ppr", String(params.ppr))
  const s = q.toString()
  return s ? `?${s}` : ""
}

export const livedraftKeys = {
  board: (q: string) => ["livedraft", "board", q] as const,
  state: (q: string) => ["livedraft", "state", q] as const,
}

/** Poll cadence for the live draft. Fast enough to feel immediate on a phone. */
export const STATE_REFETCH_MS = 5_000

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

/**
 * The full board. Fetched once and kept -- it only changes every few hours.
 *
 * Keyed on the draft params because a mock with `recompute` gets a board
 * re-scored for that format; caching it under the same key as the league board
 * would show one format's values while the live view used another's.
 */
export function useBoard(params: DraftParams = {}) {
  const qs = draftQuery(params)
  return useQuery({
    queryKey: livedraftKeys.board(qs),
    queryFn: () => getJson<Board>(`/api/livedraft/board${qs}`),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}

/** Live draft state, polled. */
export function useDraftState(params: DraftParams = {}) {
  const qs = draftQuery(params)
  return useQuery({
    queryKey: livedraftKeys.state(qs),
    queryFn: () => getJson<DraftState>(`/api/livedraft/state${qs}`),
    refetchInterval: STATE_REFETCH_MS,
    refetchIntervalInBackground: false,
    staleTime: 1_000,
  })
}

export interface LiveView {
  board: Board | undefined
  state: DraftState | undefined
  /** Undrafted players, joined with live VONA/availability, best first. */
  available: LivePlayer[]
  myRoster: Player[]
  isLoading: boolean
  error: Error | null
}

/**
 * Join the cached board with the small live overlay.
 *
 * The poll only ships {id, availNext, vona, fillsNeed}; everything else comes
 * from the board already in memory. Memoised so a five-second poll does not
 * rebuild several hundred objects on every tick.
 */
export function useLiveDraft(params: DraftParams = {}): LiveView {
  const boardQuery = useBoard(params)
  const stateQuery = useDraftState(params)

  const board = boardQuery.data
  const state = stateQuery.data

  const byId = useMemo(() => {
    const map = new Map<string, Player>()
    for (const p of board?.players ?? []) map.set(p.id, p)
    return map
  }, [board])

  const available = useMemo(() => {
    if (!board || !state) return []
    const out: LivePlayer[] = []
    for (const o of state.overlay) {
      const p = byId.get(o.id)
      if (!p) continue
      out.push({ ...p, availNext: o.availNext, vona: o.vona, fillsNeed: o.fillsNeed })
    }
    return out
  }, [board, state, byId])

  const myRoster = useMemo(
    () =>
      (state?.myRosterIds ?? [])
        .map((id) => byId.get(id))
        .filter((p): p is Player => !!p),
    [state, byId],
  )

  return {
    board,
    state,
    available,
    myRoster,
    isLoading: boardQuery.isLoading || stateQuery.isLoading,
    error: (boardQuery.error ?? stateQuery.error) as Error | null,
  }
}

export const POSITION_COLORS: Record<string, string> = {
  QB: "bg-orange-600",
  RB: "bg-green-700",
  WR: "bg-blue-700",
  TE: "bg-purple-700",
  DEF: "bg-stone-600",
  K: "bg-stone-600",
}

export function fmt(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return value.toFixed(digits)
}
