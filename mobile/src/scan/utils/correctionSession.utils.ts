import type { GridVerdict } from '@sudoku/core'
import type { CorrectedGrid } from './correctionEdit.utils'

/** failure: the scan failed. summary, check and pick: the three states of the correction panel. */
export type PanelState = 'failure' | 'summary' | 'check' | 'pick'

/**
 * The state of the correction panel. failed: the scanner found no grid. open: the cell in the panel, or null. picking: the panel
 * shows the keypad.
 */
export function panelState(failed: boolean, open: number | null, picking: boolean): PanelState {
  if (failed) return 'failure'
  if (open === null) return 'summary'
  return picking ? 'pick' : 'check'
}

/** The grid is full when no cell is empty, with or without a conflict. */
export function isFull(grid: CorrectedGrid): boolean {
  return grid.givens.every((digit, cell) => digit !== 0 || grid.entries[cell] !== 0)
}

/** The cells that the verdict marks: the wrong entries of the unique solution, or the cells that break a rule. */
export function markedCells(verdict: GridVerdict | null): ReadonlySet<number> {
  if (verdict?.status === 'wrong') return new Set(Object.keys(verdict.hints).map(Number))
  if (verdict?.status === 'clash') return new Set(verdict.cells)
  return new Set()
}
