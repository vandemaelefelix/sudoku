import { BOXES, COLUMNS, GRID_CELLS, ROWS, type Digit } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'

export type EntryKind = 'given' | 'entry'

/** looks: 81 cells, row-major, a copy of the scanner result. selected: a cell index, or null. */
export type CorrectionEdits = { looks: readonly CellLook[]; selected: number | null }

/** The plain grid that a game loads (SUD-03). 0 is an empty cell. A cell holds a given or an entry, never both. */
export type CorrectedGrid = { givens: number[]; entries: number[] }

const UNITS = [...ROWS, ...COLUMNS, ...BOXES]

export function startEdits(looks: readonly CellLook[]): CorrectionEdits {
  return { looks, selected: null }
}

/** A tap on the selected cell clears the selection. */
export function selectCell(edits: CorrectionEdits, cell: number): CorrectionEdits {
  return { ...edits, selected: edits.selected === cell ? null : cell }
}

export function deselect(edits: CorrectionEdits): CorrectionEdits {
  return edits.selected === null ? edits : { ...edits, selected: null }
}

function changeSelected(edits: CorrectionEdits, next: (look: CellLook) => CellLook): CorrectionEdits {
  const { selected } = edits
  if (selected === null) return edits
  return { ...edits, looks: edits.looks.map((look, cell) => (cell === selected ? next(look) : look)) }
}

/** Any edit removes the ring: the player checked the cell. A digit in an empty cell becomes a given, because a missed printed digit is the common case. */
export function setDigit(edits: CorrectionEdits, digit: Digit): CorrectionEdits {
  return changeSelected(edits, (look) => ({
    digit: String(digit),
    style: look.style === 'empty' ? 'given' : look.style,
    uncertain: false,
  }))
}

export function clearCell(edits: CorrectionEdits): CorrectionEdits {
  return changeSelected(edits, () => ({ digit: '', style: 'empty', uncertain: false }))
}

/** An empty cell has no kind, so the switch changes nothing there. */
export function setKind(edits: CorrectionEdits, kind: EntryKind): CorrectionEdits {
  return changeSelected(edits, (look) => (look.style === 'empty' ? look : { ...look, style: kind, uncertain: false }))
}

/** QR-04: true for each given that shares its digit with another given in a row, a column or a box. Entries never count. */
export function givenConflicts(looks: readonly CellLook[]): boolean[] {
  const marked = looks.map(() => false)
  for (const unit of UNITS) {
    const byDigit = new Map<string, number[]>()
    for (const cell of unit) {
      const look = looks[cell]
      if (look?.style !== 'given') continue
      byDigit.set(look.digit, [...(byDigit.get(look.digit) ?? []), cell])
    }
    for (const cells of byDigit.values()) {
      if (cells.length > 1) for (const cell of cells) marked[cell] = true
    }
  }
  return marked
}

export function correctedGrid(looks: readonly CellLook[]): CorrectedGrid {
  const givens = Array.from({ length: GRID_CELLS }, () => 0)
  const entries = Array.from({ length: GRID_CELLS }, () => 0)
  looks.forEach((look, cell) => {
    if (look.style === 'given') givens[cell] = Number(look.digit)
    if (look.style === 'entry') entries[cell] = Number(look.digit)
  })
  return { givens, entries }
}

/** The VoiceOver label of a correction cell, for example "Row 1, column 3, entry 7, check this cell". */
/** The place of a cell for VoiceOver, for example "Row 1, column 3". cell: the index, row-major. */
export function cellPlace(cell: number): string {
  return `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`
}

export function correctionCellLabel(cell: number, look: CellLook, conflict: boolean): string {
  const parts = [cellPlace(cell)]
  parts.push(look.style === 'empty' ? 'empty' : `${look.style} ${look.digit}`)
  if (conflict) parts.push('same digit as another given')
  if (look.uncertain) parts.push('check this cell')
  return parts.join(', ')
}
