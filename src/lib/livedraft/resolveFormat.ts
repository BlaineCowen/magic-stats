/**
 * Server-side format resolution, shared by the board and state routes.
 *
 * Both endpoints have to agree on which draft is being followed, how many teams
 * are in it and how players should be scored -- if they disagree, the board
 * shows one set of values while availability is simulated against another.
 */
import { buildFormat, type DraftFormat } from "./format"
import { rescoreBoard } from "./rescore"
import type { Board } from "./types"

const SLEEPER = "https://api.sleeper.app/v1"

export interface ResolvedFormat {
  draftId: string
  slot: number
  numTeams: number
  rounds: number
  /** Whether the board was re-scored for this draft's format. */
  recomputed: boolean
  format: DraftFormat | null
  /** Board to serve — re-scored when recomputed, otherwise the league board. */
  board: Board
  /** Stable key for caching. */
  signature: string
}

const draftCache = new Map<string, { at: number; data: unknown }>()
const DRAFT_TTL_MS = 30_000

export async function fetchDraft(draftId: string): Promise<any> {
  const hit = draftCache.get(draftId)
  if (hit && Date.now() - hit.at < DRAFT_TTL_MS) return hit.data
  const res = await fetch(`${SLEEPER}/draft/${draftId}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Sleeper draft ${draftId}: ${res.status}`)
  const data = await res.json()
  draftCache.set(draftId, { at: Date.now(), data })
  return data
}

/** Resolve a league id to its draft, for when a league link is pasted. */
export async function draftIdForLeague(leagueId: string): Promise<string | null> {
  const res = await fetch(`${SLEEPER}/league/${leagueId}/drafts`, { cache: "no-store" })
  if (!res.ok) return null
  const drafts = (await res.json()) as { draft_id: string }[]
  return drafts?.[0]?.draft_id ?? null
}

/**
 * Work out which draft, format and slot a request refers to.
 *
 * With no `draft_id` this is the league's own draft and the board is served
 * untouched, so the default view is byte-identical to before mock mode existed.
 */
export async function resolveFormat(
  params: URLSearchParams,
  board: Board,
): Promise<ResolvedFormat> {
  const draftId = params.get("draft_id") ?? board.league.draftId
  const isMock = draftId !== board.league.draftId
  const recompute = params.get("recompute") === "1"
  const pprParam = params.get("ppr")
  const ppr = pprParam === null ? undefined : Number(pprParam)

  let format: DraftFormat | null = null
  if (isMock || recompute || params.has("roster") || params.has("teams")) {
    try {
      const draft = await fetchDraft(draftId)
      format = buildFormat(draft, board.league.myUserId, ppr)
    } catch {
      format = null // fall back to league settings rather than failing the request
    }
  }

  // Explicit format overrides. These let you try a format without having to
  // find a mock that happens to use it -- `?roster=QB,RB,RB,WR,WR,TE,FLEX,DEF`
  // drops the superflex slot, `?teams=10` changes the snake. They also make the
  // format logic testable directly.
  const rosterParam = params.get("roster")
  if (format && rosterParam) {
    const rosterSlots = rosterParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
    format = {
      ...format,
      rosterSlots,
      starterSlots: rosterSlots.filter((s) => !["BN", "IR", "TAXI"].includes(s)),
      superflex: rosterSlots.includes("SUPER_FLEX"),
      hasKicker: rosterSlots.includes("K"),
    }
  }
  const teamsParam = Number(params.get("teams") ?? NaN)
  if (format && Number.isFinite(teamsParam) && teamsParam > 1) {
    format = { ...format, numTeams: teamsParam }
  }

  const slotParam = params.get("slot")
  const slot = slotParam
    ? Number(slotParam)
    : (format?.detectedSlot ?? board.league.mySlot)

  // Team count and rounds MUST follow the draft being played. They drive the
  // snake maths for which picks are yours; using the league's 12 for a 10-team
  // mock would compute picks 6/19/30 instead of 6/15/26 and quietly invalidate
  // every availability number on screen.
  const numTeams = format?.numTeams ?? board.league.numTeams
  const rounds = format?.rounds ?? board.league.rounds

  let served = board
  if (recompute && format) {
    const { players, demand, replacement } = rescoreBoard(
      board.players,
      format.scoring,
      format.rosterSlots,
      numTeams,
    )
    served = {
      ...board,
      players,
      meta: { ...board.meta, demand, replacement },
      league: {
        ...board.league,
        numTeams,
        rounds,
        mySlot: slot,
        rosterSlots: format.rosterSlots,
        starterSlots: format.starterSlots,
        superflex: format.superflex,
        hasKicker: format.hasKicker,
        scoring: format.scoring,
        draftablePositions: [
          ...new Set(
            format.starterSlots.flatMap((s) =>
              s === "FLEX"
                ? ["RB", "WR", "TE"]
                : s === "SUPER_FLEX"
                  ? ["QB", "RB", "WR", "TE"]
                  : s === "REC_FLEX"
                    ? ["WR", "TE"]
                    : s === "WRRB_FLEX"
                      ? ["RB", "WR"]
                      : [s],
            ),
          ),
        ],
      },
    }
  } else {
    // Even without re-scoring, the snake shape has to match the draft played.
    served = {
      ...board,
      league: { ...board.league, numTeams, rounds, mySlot: slot },
    }
  }

  return {
    draftId,
    slot,
    numTeams,
    rounds,
    recomputed: recompute && !!format,
    format,
    board: served,
    signature:
      `${draftId}:${slot}:${numTeams}:${rounds}:${recompute ? "r" : "l"}:${ppr ?? "-"}` +
      `:${params.get("roster") ?? "-"}`,
  }
}
