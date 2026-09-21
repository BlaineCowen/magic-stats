"use client"

import { POSITION_COLORS, fmt } from "@/lib/livedraft/queries"
import { LEAN_EXPLAIN, LEAN_LABEL, type RiskLean } from "@/lib/livedraft/risk"
import type { DraftState, Player, QbPace, RiskMode } from "@/lib/livedraft/types"

export function PosBadge({ pos }: { pos: string }) {
  return (
    <span
      className={`${POSITION_COLORS[pos] ?? "bg-stone-600"} inline-block w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold text-white`}
    >
      {pos}
    </span>
  )
}

/**
 * Draft status. On a phone this is the bit you glance at between picks, so the
 * two numbers that matter -- whose turn it is and how long until yours -- are
 * the largest things on screen.
 */
export function StatusHeader({
  state,
  onOpenMock,
}: {
  state: DraftState | undefined
  onOpenMock?: () => void
}) {
  if (!state) return null

  const waiting = !state.draftStarted
  const until = state.picksUntilMine

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
            <span>{waiting ? "Draft not started" : `Pick ${state.onTheClock}`}</span>
            {onOpenMock && (
              <button
                onClick={onOpenMock}
                className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium normal-case text-slate-600"
              >
                Mock
              </button>
            )}
          </div>
          <div className="text-lg font-semibold leading-tight text-slate-900">
            {state.isMyPick ? (
              <span className="text-emerald-600">You&rsquo;re on the clock</span>
            ) : state.myNextPick === null ? (
              "Roster complete"
            ) : (
              <>
                Your pick: <span className="tabular-nums">{state.myNextPick}</span>
              </>
            )}
          </div>
        </div>
        {!state.isMyPick && until !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums leading-none text-slate-900">
              {until}
            </div>
            <div className="text-[11px] text-slate-500">picks away</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * QB run alert.
 *
 * Persistent chrome rather than a tab, because it is the one thing that
 * invalidates the wait-on-quarterback plan and you will not notice it from
 * inside the draft room. FantasyPros' experts rank the second QB tier 10-25
 * picks ahead of ADP, so a run starting early is the expected failure mode.
 */
export function QbRunBanner({ pace }: { pace: QbPace | undefined }) {
  if (!pace) return null
  const { gone, expected, delta, isRun } = pace

  const tone = isRun
    ? "border-red-300 bg-red-50 text-red-900"
    : delta > 0
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-600"

  return (
    <div className={`flex items-center justify-between border-b px-3 py-1.5 text-xs ${tone}`}>
      <span className="font-medium">
        {isRun ? "QB RUN — take one now" : "QB pace"}
      </span>
      <span className="tabular-nums">
        {gone} gone · ADP expects {expected} ({delta >= 0 ? "+" : ""}
        {delta})
      </span>
    </div>
  )
}

const TABS = ["Live", "Board", "Match", "Team", "Score"] as const
export type Tab = (typeof TABS)[number]

/** Bottom tab bar — thumb-reachable on a phone, inline on desktop. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:static sm:border-t-0 sm:border-b">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`flex-1 px-1.5 py-3 text-[13px] font-medium transition-colors sm:px-3 sm:py-2 sm:text-sm ${
            tab === t
              ? "border-t-2 border-slate-900 text-slate-900 sm:border-t-0 sm:border-b-2"
              : "border-t-2 border-transparent text-slate-500 sm:border-t-0 sm:border-b-2"
          }`}
        >
          {t}
        </button>
      ))}
    </nav>
  )
}

/**
 * Risk-lean control.
 *
 * `auto` is the default because the right answer changes across a draft: rank
 * on floor while you are building the starters that have to play every week,
 * on ceiling once you are filling bench spots where upside is the only reason
 * to hold the slot.
 */
export function RiskLeanBar({
  mode,
  lean,
  onChange,
}: {
  mode: RiskMode
  lean: RiskLean
  onChange: (m: RiskMode) => void
}) {
  const modes: RiskMode[] = ["auto", "floor", "balanced", "upside"]
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${
              mode === m ? "bg-slate-900 text-white" : "text-slate-500"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-slate-500" title={LEAN_EXPLAIN[lean]}>
        {mode === "auto" ? `auto → ${LEAN_LABEL[lean]}` : LEAN_LABEL[lean]}
      </span>
    </div>
  )
}

export function PlayerMetaLine({ player }: { player: Player }) {
  return (
    <span className="text-[11px] text-slate-500">
      {player.team ?? "FA"}
      {player.bye ? ` · bye ${player.bye}` : ""}
      {player.adp !== null ? ` · ADP ${fmt(player.adp, 1)}` : ""}
      {player.ecr !== null ? ` · ECR ${fmt(player.ecr)}` : ""}
    </span>
  )
}
