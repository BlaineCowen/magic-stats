import { NextResponse } from "next/server"
import { existsSync, statSync, writeFileSync } from "fs"

export const dynamic = "force-dynamic"

/**
 * Ask the sync container to rebuild the board now.
 *
 * blaine_score edits only reach the board when the pipeline reruns, and the
 * normal cadence is two hours -- which would make "save" in the editor a
 * promise rather than a change. This drops a sentinel file that the sync loop
 * polls every ten seconds.
 *
 * Deliberately a request rather than a synchronous rebuild: the pipeline
 * refetches every projection source and takes the better part of a minute, far
 * too long to hold an HTTP request open from a phone.
 */
const TRIGGER = "/app/data/livedraft/.rebuild"
const BOARD = "/app/data/livedraft/board.json"

export async function POST() {
  try {
    writeFileSync(TRIGGER, new Date().toISOString(), "utf-8")
    return NextResponse.json({
      ok: true,
      note: "Rebuild requested — the board updates in about a minute.",
    })
  } catch (err) {
    console.error("rebuild trigger failed:", err)
    return NextResponse.json({ error: "Could not request a rebuild" }, { status: 500 })
  }
}

/** Whether a rebuild is pending, and how old the current board is. */
export async function GET() {
  const pending = existsSync(TRIGGER)
  let generatedAt: string | null = null
  try {
    generatedAt = statSync(BOARD).mtime.toISOString()
  } catch {
    generatedAt = null
  }
  return NextResponse.json({ pending, generatedAt })
}
