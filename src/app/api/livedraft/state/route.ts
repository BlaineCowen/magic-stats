import { NextResponse } from "next/server"

import { BoardUnavailableError, loadBoard } from "@/lib/livedraft/boardStore"
import {
  byeConflicts,
  needCounts,
  neededPositions,
  nextPickForSlot,
  picksForSlot,
  quarterbackPace,
  takenIdsFrom,
} from "@/lib/livedraft/draft"
import { LEAGUE_ADP_RATIO } from "@/lib/livedraft/leagueBias"
import { rostersFromPicks, simulateNeedsAware } from "@/lib/livedraft/needsSim"
import { resolveFormat } from "@/lib/livedraft/resolveFormat"
import { computeVona, simulateAvailability } from "@/lib/livedraft/sim"
import type { DraftPick, DraftState, LiveOverlay, Player } from "@/lib/livedraft/types"

export const dynamic = "force-dynamic"

const SLEEPER = "https://api.sleeper.app/v1"

/**
 * Picks are fetched server-side rather than from the browser. That avoids any
 * CORS question, and means one poll serves every device you have open instead
 * of each phone and laptop hammering Sleeper independently.
 */
const PICKS_TTL_MS = 3_000

let picksCache: { key: string; at: number; picks: DraftPick[]; status: string } | null = null

async function fetchPicks(draftId: string) {
  const now = Date.now()
  if (picksCache && picksCache.key === draftId && now - picksCache.at < PICKS_TTL_MS) {
    return { picks: picksCache.picks, status: picksCache.status }
  }

  const [picksRes, draftRes] = await Promise.all([
    fetch(`${SLEEPER}/draft/${draftId}/picks`, { cache: "no-store" }),
    fetch(`${SLEEPER}/draft/${draftId}`, { cache: "no-store" }),
  ])
  if (!picksRes.ok) throw new Error(`Sleeper picks ${picksRes.status}`)

  const picks = (await picksRes.json()) as DraftPick[]
  const status = draftRes.ok ? ((await draftRes.json()).status as string) : "unknown"

  picksCache = { key: draftId, at: now, picks, status }
  return { picks, status }
}

/**
 * The simulation is deterministic for a given pick count, so results are cached
 * on (draftId, picksMade). Between picks every poll is a cache hit; the work
 * only happens when the board actually changes.
 */
let stateCache: { key: string; state: DraftState } | null = null

export async function GET(req: Request) {
  try {
    const leagueBoard = loadBoard()
    const url = new URL(req.url)

    // ?draft_id= points at another draft (a mock, or a completed one to
    // replay). resolveFormat also returns the board re-scored for that draft's
    // format when ?recompute=1, and -- critically -- a `league` whose team
    // count and round count come from the *draft being played*. Those drive the
    // snake maths below; taking them from our own league would compute the
    // wrong picks for any mock with a different team count.
    const resolved = await resolveFormat(url.searchParams, leagueBoard)
    const board = resolved.board
    const draftId = resolved.draftId
    const slot = resolved.slot
    const ecrWeight = Number(url.searchParams.get("ecr_weight") ?? 0)

    const { picks: allPicks, status } = await fetchPicks(draftId)
    // ?max_picks= truncates the draft, so a completed draft can be scrubbed to
    // any point. Used to replay how the board looked mid-draft.
    const maxPicks = Number(url.searchParams.get("max_picks") ?? NaN)
    const picks = Number.isFinite(maxPicks) ? allPicks.slice(0, maxPicks) : allPicks
    const picksMade = picks.length

    const cacheKey =
      `${resolved.signature}:${ecrWeight}:${picksMade}:${board.generatedAt}` +
      `:${url.searchParams.get("sim") ?? "needs"}:${url.searchParams.get("bias") ?? "1"}` +
      `:${url.searchParams.get("max_picks") ?? "-"}`
    if (stateCache?.key === cacheKey) {
      return NextResponse.json(stateCache.state)
    }

    const takenIds = takenIdsFrom(picks)
    const byId = new Map<string, Player>(board.players.map((p) => [p.id, p]))

    const myRoster = picks
      .filter((p) => p.draft_slot === slot && p.player_id)
      .map((p) => byId.get(p.player_id!))
      .filter((p): p is Player => !!p)

    const available = board.players.filter((p) => !takenIds.has(p.id))
    const myNextPick = nextPickForSlot(board.league, slot, picksMade)
    // The pick after the one we are about to make. VONA is "take him now versus
    // the best I can still get at my *following* pick", so the fallback must be
    // measured there -- measuring it at myNextPick makes the best player at each
    // position his own fallback and reports VONA 0 for everyone who matters.
    const pickAfter =
      myNextPick === null ? null : nextPickForSlot(board.league, slot, myNextPick)

    // Recompute availability against the pool that actually remains. This is
    // the whole reason the live view beats the printed sheet -- the availPre
    // values in board.json assume an untouched board.
    let overlay: LiveOverlay[] = []
    if (myNextPick !== null) {
      const picksToSim = pickAfter === null ? [myNextPick] : [myNextPick, pickAfter]

      // Needs-aware by default. Plain ADP has no model of the other rosters, so
      // after a run on a position it cannot tell the difference between "demand
      // is exhausted" and "half the league still needs one" -- which in a
      // superflex league is the single most consequential thing to get right.
      // `?sim=adp` falls back to the simpler model for comparison.
      const useNeeds = url.searchParams.get("sim") !== "adp"
      const availability = useNeeds
        ? simulateNeedsAware(
            available,
            picksToSim,
            board.league,
            rostersFromPicks(picks, byId, board.league.numTeams),
            picksMade,
            {
              // ?bias=0 disables the league-specific ADP adjustment, so its
              // effect can be separated from the needs model when validating.
              positionRatio:
                url.searchParams.get("bias") === "0" ? {} : LEAGUE_ADP_RATIO,
            },
          )
        : simulateAvailability(available, picksToSim, {
            nSims: 2000,
            ecrWeight,
            picksMade,
          })
      // On the final pick there is no "next", so fall back to comparing at the
      // current pick, which correctly yields ~0 for the best man available.
      const vona = computeVona(available, availability, pickAfter ?? myNextPick)
      const needed = neededPositions(board.league, myRoster)
      overlay = available.map((p) => ({
        id: p.id,
        availNext: availability.get(p.id)?.[myNextPick] ?? 0,
        vona: vona.get(p.id) ?? 0,
        fillsNeed: needed.has(p.pos),
      }))
    } else {
      overlay = available.map((p) => ({
        id: p.id,
        availNext: 1,
        vona: 0,
        fillsNeed: false,
      }))
    }

    const state: DraftState = {
      boardGeneratedAt: board.generatedAt,
      draftId,
      draftStatus: status,
      isMock: draftId !== leagueBoard.league.draftId,
      recomputed: resolved.recomputed,
      numTeams: resolved.numTeams,
      myPicks: picksForSlot(board.league, slot),
      picksMade,
      onTheClock: picksMade + 1,
      myNextPick,
      picksUntilMine: myNextPick === null ? null : myNextPick - picksMade - 1,
      isMyPick: myNextPick !== null && myNextPick === picksMade + 1,
      draftStarted: picksMade > 0,
      takenIds: [...takenIds],
      myRosterIds: myRoster.map((p) => p.id),
      needs: needCounts(board.league, myRoster),
      neededPositions: [...neededPositions(board.league, myRoster)],
      byeConflicts: byeConflicts(myRoster),
      qbPace: quarterbackPace(board.players, takenIds, picksMade),
      overlay,
      recentPicks: picks
        .slice(-8)
        .reverse()
        .map((p) => ({
          pick: p.pick_no,
          slot: p.draft_slot,
          playerId: p.player_id,
        })),
    }

    stateCache = { key: cacheKey, state }
    return NextResponse.json(state)
  } catch (err) {
    if (err instanceof BoardUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error("livedraft state error:", err)
    const message = err instanceof Error ? err.message : "Failed to load draft state"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
