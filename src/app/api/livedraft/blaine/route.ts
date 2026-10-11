import { NextResponse } from "next/server"
import { readFileSync, writeFileSync } from "fs"

import type { BlaineScore } from "@/lib/livedraft/types"

export const dynamic = "force-dynamic"

/**
 * blaine_score lives in the pipeline's config directory, bind-mounted into this
 * container. The YAML file stays the source of truth -- it is diffable and
 * carries the reasoning in comments -- and this route is a thin editor over it
 * so adjustments can also be made from a phone mid-draft.
 */
const CONFIG_PATH = "/app/data/livedraft/blaine_score.json"
const BOARD_PATH = "/app/data/livedraft/board.json"

const MIN_MULT = 0.6
const MAX_MULT = 1.4

function clampMultiplier(value: unknown, fallback = 1): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(MAX_MULT, Math.max(MIN_MULT, n))
}

function empty(): BlaineScore {
  return { weight: 1, teams: {}, riskOverrides: {} }
}

/** Just the overlay this route owns — what the UI has written. */
function readOverlay(): BlaineScore {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Partial<BlaineScore>
    return {
      weight: clampMultiplier(raw.weight ?? 1, 1),
      teams: raw.teams ?? {},
      riskOverrides: raw.riskOverrides ?? {},
    }
  } catch {
    return empty()
  }
}

/**
 * The *effective* config: YAML base with the UI overlay on top.
 *
 * The editor has to show what is actually being applied, not just what it
 * personally wrote. Returning the bare overlay made adjustments defined in
 * blaine_score.yaml render as neutral sliders and an empty "active" list, which
 * invites someone to re-enter an adjustment that was already live, or to think
 * their YAML edit never took.
 *
 * board.json carries the merged config as of the last rebuild, so it is the
 * right base to read.
 */
function readEffective(): BlaineScore {
  const overlay = readOverlay()
  let base = empty()
  try {
    const board = JSON.parse(readFileSync(BOARD_PATH, "utf-8")) as {
      blaineScore?: Partial<BlaineScore>
    }
    if (board.blaineScore) {
      base = {
        weight: clampMultiplier(board.blaineScore.weight ?? 1, 1),
        teams: board.blaineScore.teams ?? {},
        riskOverrides: board.blaineScore.riskOverrides ?? {},
      }
    }
  } catch {
    // No board yet -- the overlay alone is the best we can report.
  }
  return {
    weight: overlay.weight,
    teams: { ...base.teams, ...overlay.teams },
    riskOverrides: { ...base.riskOverrides, ...overlay.riskOverrides },
  }
}

export async function GET() {
  return NextResponse.json(readEffective())
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BlaineScore>
    const overlay = readOverlay()
    const effective = readEffective()

    const teams: BlaineScore["teams"] = { ...overlay.teams }
    for (const [team, adj] of Object.entries(body.teams ?? {})) {
      const key = team.toUpperCase().slice(0, 4)
      const pass = clampMultiplier(adj?.pass ?? 1)
      const rush = clampMultiplier(adj?.rush ?? 1)

      // The overlay stores only *differences* from the YAML. The editor now
      // loads the effective config, so a plain save would otherwise copy every
      // YAML-defined team into the overlay and permanently mask later edits to
      // blaine_score.yaml. Storing deltas keeps the YAML authoritative for
      // anything you have not deliberately changed here.
      const base = effective.teams[key]
      const baseUnchanged =
        base &&
        clampMultiplier(base.pass ?? 1) === pass &&
        clampMultiplier(base.rush ?? 1) === rush &&
        (base.note ?? "") === (adj?.note ?? "")
      if (baseUnchanged) {
        delete teams[key]
        continue
      }

      // A team back at neutral with no note is a deletion, not an entry.
      if (pass === 1 && rush === 1 && !adj?.note) {
        delete teams[key]
        continue
      }
      teams[key] = { pass, rush, note: (adj?.note ?? "").slice(0, 200) }
    }

    const riskOverrides: Record<string, number> = { ...overlay.riskOverrides }
    for (const [id, value] of Object.entries(body.riskOverrides ?? {})) {
      const n = Number(value)
      if (!Number.isFinite(n) || n === 1) delete riskOverrides[id]
      else riskOverrides[id] = Math.min(2.5, Math.max(0.4, n))
    }

    const next: BlaineScore = {
      weight: clampMultiplier(body.weight ?? overlay.weight, 1),
      teams,
      riskOverrides,
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf-8")
    return NextResponse.json({
      ok: true,
      config: next,
      // Edits land on the board when the sync container next rebuilds it.
      note: "Saved. Takes effect on the next board rebuild (up to 2h, or run the sync manually).",
    })
  } catch (err) {
    console.error("blaine_score save failed:", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
