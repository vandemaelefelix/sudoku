import type { CellResult } from '../../scanner'

/** Provisional: the dev set has not yet fixed a threshold. */
export const REVIEW_CONFIDENCE = 0.9

export type CellLook = { digit: string; style: 'given' | 'entry' | 'empty'; uncertain: boolean }

export function cellLook(cell: CellResult): CellLook {
  'worklet'
  const uncertain = cell.confidence < REVIEW_CONFIDENCE || !cell.validPair
  if (cell.digit === 0 || cell.kind === 'none' || cell.kind === 'notes') return { digit: '', style: 'empty', uncertain }
  return { digit: String(cell.digit), style: cell.kind === 'printed' ? 'given' : 'entry', uncertain }
}

export function cellsToCheck(cells: CellResult[]): number {
  let count = 0
  for (const cell of cells) if (cellLook(cell).uncertain) count++
  return count
}
