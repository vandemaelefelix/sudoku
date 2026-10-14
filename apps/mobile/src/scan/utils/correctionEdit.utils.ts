import { BOXES, COLUMNS, GRID_CELLS, ROWS, type Digit } from '@sudoku/core'
import { hasDigit, type CellLook, type CellStyle } from '@/scan/utils/correction.utils'

/**
 * The edits of the correction screen, on top of the looks of the scanner result.
 * overrides: the cells the player changed. checked: the cells the player confirmed with Yes.
 * selected: the cell in the panel, or null for the summary state. picking: the panel shows the keypad (the pick state).
 */
export type CorrectionEdits = {
  overrides: Readonly<Record<number, CellLook>>
  checked: Readonly<Record<number, true>>
  selected: number | null
  picking: boolean
}

/** The plain grid that a game loads (SUD-03). 0 is an empty cell. A cell holds a given or an entry, never both. */
export type CorrectedGrid = { givens: number[]; entries: number[] }

const UNITS = [...ROWS, ...COLUMNS, ...BOXES]

export const NO_EDITS: CorrectionEdits = { overrides: {}, checked: {}, selected: null, picking: false }

/** The look of each cell after the edits. base: the looks of the scanner result. */
export function editedLooks(base: readonly CellLook[], edits: CorrectionEdits): CellLook[] {
  return base.map((look, cell) => {
    const own = edits.overrides[cell]
    if (own) return own
    return edits.checked[cell] ? { ...look, uncertain: false } : look
  })
}

/** The next cell to check after `after`, in reading order, from the start again at the end. Null when none is left. */
export function nextToCheck(looks: readonly CellLook[], after: number): number | null {
  for (let step = 1; step <= looks.length; step++) {
    const cell = (after + step) % looks.length
    if (cell !== after && looks[cell]?.uncertain) return cell
  }
  return null
}

/** A tap on the selected cell closes it. A sure cell opens on the keypad: it has nothing to confirm. */
export function selectCell(base: readonly CellLook[], edits: CorrectionEdits, cell: number): CorrectionEdits {
  if (edits.selected === cell) return closeCell(edits)
  const look = editedLooks(base, edits)[cell]
  return { ...edits, selected: cell, picking: !look?.uncertain }
}

/** Opens the first cell to check, in the check state. */
export function startCheck(base: readonly CellLook[], edits: CorrectionEdits): CorrectionEdits {
  const looks = editedLooks(base, edits)
  const first = looks[0]?.uncertain ? 0 : nextToCheck(looks, 0)
  return first === null ? edits : { ...edits, selected: first, picking: false }
}

export function closeCell(edits: CorrectionEdits): CorrectionEdits {
  return edits.selected === null && !edits.picking ? edits : { ...edits, selected: null, picking: false }
}

/** No: the read is wrong, so the panel shows the keypad. */
export function answerNo(edits: CorrectionEdits): CorrectionEdits {
  return edits.selected === null ? edits : { ...edits, picking: true }
}

/** An answer on a cell to check moves to the next cell to check. An answer on a sure cell goes back to the summary state. */
function answer(base: readonly CellLook[], edits: CorrectionEdits, next: Partial<CorrectionEdits>): CorrectionEdits {
  const cell = edits.selected
  if (cell === null) return edits
  const wasUncertain = editedLooks(base, edits)[cell]?.uncertain ?? false
  const after = { ...edits, ...next }
  const selected = wasUncertain ? nextToCheck(editedLooks(base, after), cell) : null
  return { ...after, selected, picking: false }
}

/** Yes: the read is right. The ring goes. */
export function answerYes(base: readonly CellLook[], edits: CorrectionEdits): CorrectionEdits {
  const cell = edits.selected
  if (cell === null) return edits
  return answer(base, edits, { checked: { ...edits.checked, [cell]: true } })
}

function override(edits: CorrectionEdits, cell: number, look: CellLook): Partial<CorrectionEdits> {
  return { overrides: { ...edits.overrides, [cell]: look } }
}

/** A digit in a cell without one becomes a given, because a missed printed digit is the common case. */
export function setDigit(base: readonly CellLook[], edits: CorrectionEdits, digit: Digit): CorrectionEdits {
  const cell = edits.selected
  if (cell === null) return edits
  const look = editedLooks(base, edits)[cell]
  const style: CellStyle = look && hasDigit(look) ? look.style : 'given'
  return answer(base, edits, override(edits, cell, { digit: String(digit), style, uncertain: false }))
}

/** Empty on the keypad. */
export function clearCell(base: readonly CellLook[], edits: CorrectionEdits): CorrectionEdits {
  const cell = edits.selected
  if (cell === null) return edits
  return answer(base, edits, override(edits, cell, { digit: '', style: 'empty', uncertain: false }))
}

/**
 * The kind of the selected cell, from the dev menu labels. It keeps the cell open. A given or an entry needs a digit, so a cell
 * without one keeps its kind.
 */
export function setKind(base: readonly CellLook[], edits: CorrectionEdits, style: CellStyle): CorrectionEdits {
  const cell = edits.selected
  if (cell === null) return edits
  const look = editedLooks(base, edits)[cell]
  if (!look) return edits
  const digit = style === 'given' || style === 'entry' ? look.digit : ''
  if (digit === '' && (style === 'given' || style === 'entry')) return edits
  return { ...edits, ...override(edits, cell, { digit, style, uncertain: false }) }
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

/** For example "Row 1, column 3". cell: the index, row-major. */
export function cellPlace(cell: number): string {
  return `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`
}

/** The VoiceOver label of a correction cell, for example "Row 1, column 3, entry 7, check this cell". */
export function correctionCellLabel(cell: number, look: CellLook, conflict: boolean, hint = ''): string {
  const parts = [cellPlace(cell)]
  parts.push(hasDigit(look) ? `${look.style} ${look.digit}` : look.style === 'notes' ? 'notes' : 'empty')
  if (hint !== '') parts.push(`differs from the solution, solution ${hint}`)
  else if (conflict) parts.push('same digit as another given')
  if (look.uncertain) parts.push('check this cell')
  return parts.join(', ')
}

/** The question of the panel for an open cell, for example "Is this a 4?" in the check state. */
export function panelQuestion(look: CellLook, picking: boolean): string {
  if (look.uncertain && !picking) return hasDigit(look) ? `Is this a ${look.digit}?` : 'Is this empty?'
  if (look.uncertain) return 'What is it?'
  return hasDigit(look) ? `Change this ${look.digit}` : 'Fill this cell'
}

/** The label of the Yes button, for example "Yes, 4". */
export function yesLabel(look: CellLook): string {
  return hasDigit(look) ? `Yes, ${look.digit}` : 'Yes, empty'
}
