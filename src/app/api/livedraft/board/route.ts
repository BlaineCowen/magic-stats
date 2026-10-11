import { NextResponse } from "next/server"

import { BoardUnavailableError, loadBoard } from "@/lib/livedraft/boardStore"
import { resolveFormat } from "@/lib/livedraft/resolveFormat"

export const dynamic = "force-dynamic"

/**
 * The full draft board.
 *
 * With no query parameters this serves the league board untouched. With
 * `?draft_id=…&recompute=1` it is re-scored for that draft's format, so mock
 * mode and the live view never disagree about a player's value.
 */
export async function GET(req: Request) {
  try {
    const board = loadBoard()
    const url = new URL(req.url)
    const resolved = await resolveFormat(url.searchParams, board)

    return NextResponse.json(
      {
        ...resolved.board,
        mock: resolved.format
          ? {
              draftId: resolved.draftId,
              name: resolved.format.name,
              status: resolved.format.status,
              recomputed: resolved.recomputed,
              scoringNote: resolved.format.scoringNote,
              scoringAmbiguous: resolved.format.scoringAmbiguous,
              slot: resolved.slot,
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
        },
      },
    )
  } catch (err) {
    if (err instanceof BoardUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error("livedraft board error:", err)
    return NextResponse.json({ error: "Failed to load board" }, { status: 500 })
  }
}
