"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { BestAvailable } from "@/components/livedraft/BestAvailable"
import { BlaineScoreEditor } from "@/components/livedraft/BlaineScore"
import { BoardExplorer } from "@/components/livedraft/BoardExplorer"
import { Matchups } from "@/components/livedraft/Matchups"
import { MockBanner, MockPanel } from "@/components/livedraft/MockPanel"
import { MyTeam } from "@/components/livedraft/MyTeam"
import {
  QbRunBanner,
  RiskLeanBar,
  StatusHeader,
  TabBar,
  type Tab,
} from "@/components/livedraft/Chrome"
import { useLiveDraft } from "@/lib/livedraft/queries"
import { resolveLean } from "@/lib/livedraft/risk"
import type { RiskMode } from "@/lib/livedraft/types"

/**
 * `useSearchParams` must sit under a Suspense boundary or `next build` fails
 * with "useSearchParams() should be wrapped in a suspense boundary". The dev
 * server this app runs under tolerates its absence, so without this the app
 * would only break the day someone tries to build it.
 */
export default function LiveDraftPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
          Loading board…
        </div>
      }
    >
      <LiveDraftContent />
    </Suspense>
  )
}

function LiveDraftContent() {
  const params = useSearchParams()
  const router = useRouter()

  // Which draft the app is following lives entirely in the URL, so a mock
  // survives a reload and can be opened on another device.
  const draftParams = useMemo(
    () => ({
      draftId: params.get("draft_id") ?? undefined,
      slot: params.get("slot") ? Number(params.get("slot")) : undefined,
      recompute: params.get("recompute") === "1",
      ppr: params.get("ppr") ? Number(params.get("ppr")) : undefined,
    }),
    [params],
  )

  const [tab, setTab] = useState<Tab>("Live")
  const [needsOnly, setNeedsOnly] = useState(false)
  const [riskMode, setRiskMode] = useState<RiskMode>("auto")
  const [showMock, setShowMock] = useState(false)

  const { board, state, available, myRoster, isLoading, error } = useLiveDraft(draftParams)

  const takenIds = useMemo(() => new Set(state?.takenIds ?? []), [state])

  if (error) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">Live Draft</h1>
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error.message}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          The board is written by the <code>livedraft-sync</code> container. Check{" "}
          <code>docker logs livedraft-sync</code>.
        </p>
      </div>
    )
  }

  if (isLoading || !board || !state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Loading board…
      </div>
    )
  }

  const lean = resolveLean(riskMode, board.league, state.myNextPick)

  function startMock(opts: {
    draftId: string
    slot: number
    recompute: boolean
    ppr?: number
  }) {
    const q = new URLSearchParams({
      draft_id: opts.draftId,
      slot: String(opts.slot),
    })
    if (opts.recompute) q.set("recompute", "1")
    if (opts.ppr !== undefined) q.set("ppr", String(opts.ppr))
    router.push(`/livedraft?${q.toString()}`)
    setShowMock(false)
  }

  return (
    <div className="flex min-h-screen flex-col">
      {state.isMock && (
        <MockBanner
          draftId={state.draftId}
          recomputed={state.recomputed}
          numTeams={state.numTeams}
          onExit={() => router.push("/livedraft")}
        />
      )}
      <StatusHeader state={state} onOpenMock={() => setShowMock(true)} />
      <QbRunBanner pace={state.qbPace} />
      {showMock && (
        <MockPanel
          league={board.league}
          onStart={startMock}
          onClose={() => setShowMock(false)}
        />
      )}
      {tab === "Live" && (
        <RiskLeanBar mode={riskMode} lean={lean} onChange={setRiskMode} />
      )}
      <div className="hidden sm:block">
        <TabBar tab={tab} onChange={setTab} />
      </div>

      <main className="flex-1">
        {tab === "Live" && (
          <BestAvailable
            players={available}
            needsOnly={needsOnly}
            onToggleNeeds={setNeedsOnly}
            lean={lean}
          />
        )}
        {tab === "Board" && <BoardExplorer board={board} takenIds={takenIds} />}
        {tab === "Match" && <Matchups board={board} takenIds={takenIds} />}
        {tab === "Team" && <MyTeam board={board} state={state} roster={myRoster} />}
        {tab === "Score" && <BlaineScoreEditor board={board} />}
      </main>

      <footer className="px-3 pb-24 pt-4 text-center text-[10px] text-slate-400 sm:pb-4">
        {board.league.name} · pick {board.league.mySlot} of {state.numTeams} ·{" "}
        {state.picksMade} picks made
        {state.isMock ? ` · mock ${state.draftId}` : ""}
      </footer>

      <div className="sm:hidden">
        <TabBar tab={tab} onChange={setTab} />
      </div>
    </div>
  )
}
