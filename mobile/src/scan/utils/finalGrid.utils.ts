import type { CellResult } from '@/scanner'
import type { FinalCell, FinalGrid } from '@/utils/finalGrid.utils'
import { cellLook, hasDigit, type CellLook } from './correction.utils'

/** An empty cell has digit 0 and kind none, a pencil-marked cell kind notes. A given is printed, an entry handwritten. */
function finalKind(look: CellLook): FinalCell['kind'] {
  if (look.style === 'notes') return 'notes'
  if (look.style === 'empty') return 'none'
  return look.style === 'given' ? 'printed' : 'handwritten'
}

/**
 * The final grid of a scan. cells: the scanner result. looks: the 81 looks after the edits, row by row. A cell without a look
 * keeps what the scanner read.
 */
export function finalGrid(cells: readonly CellResult[], looks: readonly CellLook[]): FinalGrid {
  return cells.map((cell, index) => {
    const shown = cellLook(cell)
    const look = looks[index] ?? shown
    return {
      digit: hasDigit(look) ? Number(look.digit) : 0,
      kind: finalKind(look),
      digitCorrected: look.digit !== shown.digit,
      kindCorrected: look.style !== shown.style,
    }
  })
}
