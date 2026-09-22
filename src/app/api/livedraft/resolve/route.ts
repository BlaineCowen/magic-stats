import { NextResponse } from "next/server"

import { BoardUnavailableError, loadBoard } from "@/lib/livedraft/boardStore"
import { buildFormat } from "@/lib/livedraft/format"
import { draftIdForLeague, fetchDraft } from "@/lib/livedraft/resolveFormat"

export const dynamic = "force-dynamic"

/**
 * Look up a pasted draft or league and report its format.
 *
 * Server-side so the browser never has to call Sleeper directly, and so a bare
 * numeric id — which could be either a draft or a league — can be tried both
 * ways without CORS getting in the way.
 */
export async function GET(req: Request) {
  try {
    const board = loadBoard()
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    const kind = url.searchParams.get("kind") ?? "draft"
    if (!id) {
      return NextResponse.json({ error: "No id supplied" }, { status: 400 })
    }

    let draftId: string | null = kind === "league" ? await draftIdForLeague(id) : id
    let draft: any = null

    if (draftId) {
      try {
        draft = await fetchDraft(draftId)
      } catch {
        draft = null
      }
    }
    // A bare id is ambiguous — the paste could have been a league. Fall back
    // rather than telling the user their perfectly good link is invalid.
    if (!draft && kind !== "league") {
      const viaLeague = await draftIdForLeague(id)
      if (viaLeague) {
        draftId = viaLeague
        draft = await fetchDraft(viaLeague).catch(() => null)
      }
    }

    if (!draft) {
      return NextResponse.json(
        { error: `No Sleeper draft or league found for id ${id}` },
        { status: 404 },
      )
    }

    return NextResponse.json({
      format: buildFormat(draft, board.league.myUserId),
    })
  } catch (err) {
    if (err instanceof BoardUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    console.error("livedraft resolve error:", err)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }
}
