/**
 * Server-side loader for board.json, written by the livedraft-sync container.
 *
 * The file is ~190 KB and only changes every couple of hours, so it is parsed
 * once and cached in module scope keyed on mtime -- reparsing it on every
 * five-second poll would be pure waste.
 */
import { readFileSync, statSync } from "fs"

import type { Board } from "./types"

export const DATA_DIR = "/app/data/livedraft"
export const BOARD_PATH = `${DATA_DIR}/board.json`

let cached: { mtimeMs: number; board: Board } | null = null

export class BoardUnavailableError extends Error {}

export function loadBoard(): Board {
  let stat
  try {
    stat = statSync(BOARD_PATH)
  } catch {
    throw new BoardUnavailableError(
      `No board at ${BOARD_PATH}. The livedraft-sync container writes it; ` +
        `check \`docker logs livedraft-sync\`.`,
    )
  }

  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.board

  const board = JSON.parse(readFileSync(BOARD_PATH, "utf-8")) as Board
  cached = { mtimeMs: stat.mtimeMs, board }
  return board
}

/** Index players by id for O(1) lookup during live recompute. */
export function indexById(board: Board) {
  const map = new Map<string, Board["players"][number]>()
  for (const p of board.players) map.set(p.id, p)
  return map
}
