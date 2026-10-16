import type { Move } from '@/game/utils/session.utils'

export type MarkKind = 'mistake' | 'hint' | 'undo'

/** The cell that the move marks, with the id of the move, so a repeat of the same mark plays again. */
export type CellMark = { cell: number; id: number; kind: MarkKind }

export function markOf(move: Move | null): CellMark | null {
  if (move === null || move.cell === null) return null
  if (move.mistake) return { cell: move.cell, id: move.id, kind: 'mistake' }
  if (move.kind === 'hint' || move.kind === 'undo') return { cell: move.cell, id: move.id, kind: move.kind }
  return null
}
