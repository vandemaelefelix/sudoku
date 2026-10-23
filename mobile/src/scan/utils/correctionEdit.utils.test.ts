import { createAppIntl } from '@/i18n/utils/intl.utils'
import { GRID_CELLS } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'
import {
  answerNo,
  answerYes,
  cellPlaceLabel,
  clearCell,
  closeCell,
  correctedGrid,
  correctionCellLabel,
  editedLooks,
  givenConflicts,
  nextToCheck,
  NO_EDITS,
  panelQuestion,
  selectCell,
  setDigit,
  setKind,
  startCheck,
  yesLabel,
  type CorrectionEdits,
} from './correctionEdit.utils'

const EMPTY: CellLook = { digit: '', style: 'empty', uncertain: false }
const given = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'given', uncertain })
const entry = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'entry', uncertain })

function board(cells: { [n: number]: CellLook } = {}): CellLook[] {
  return Array.from({ length: GRID_CELLS }, (_, n) => cells[n] ?? EMPTY)
}

// Three cells to check (3, 40 and 70) and one sure given (0).
const BASE = board({ 0: given(5), 3: given(4, true), 40: entry(7, true), 70: { ...EMPTY, uncertain: true } })
const looksOf = (edits: CorrectionEdits) => editedLooks(BASE, edits)

const en = createAppIntl('en')
const nl = createAppIntl('nl')

describe('selectCell', () => {
  it('opens a cell to check in the check state', () => {
    expect(selectCell(BASE, NO_EDITS, 3)).toMatchObject({ selected: 3, picking: false })
  })

  it('opens a sure cell on the keypad, because it has nothing to confirm', () => {
    expect(selectCell(BASE, NO_EDITS, 0)).toMatchObject({ selected: 0, picking: true })
  })

  it('closes the open cell on a second tap', () => {
    expect(selectCell(BASE, selectCell(BASE, NO_EDITS, 3), 3)).toMatchObject({ selected: null, picking: false })
  })
})

describe('the check flow', () => {
  it('starts at the first cell to check', () => {
    expect(startCheck(BASE, NO_EDITS)).toMatchObject({ selected: 3, picking: false })
  })

  it('moves to the next cell after Yes, and removes the ring', () => {
    const edits = answerYes(BASE, startCheck(BASE, NO_EDITS))
    expect(edits.selected).toBe(40)
    expect(looksOf(edits)[3]).toEqual(given(4))
  })

  it('shows the keypad after No, then a digit fixes the cell and moves on', () => {
    const no = answerNo(startCheck(BASE, NO_EDITS))
    expect(no).toMatchObject({ selected: 3, picking: true })
    const fixed = setDigit(BASE, no, 9)
    expect(looksOf(fixed)[3]).toEqual(given(9))
    expect(fixed).toMatchObject({ selected: 40, picking: false })
  })

  it('goes back to the summary state after the last cell', () => {
    let edits = startCheck(BASE, NO_EDITS)
    for (let step = 0; step < 3; step++) edits = answerYes(BASE, edits)
    expect(edits).toMatchObject({ selected: null, picking: false })
    expect(looksOf(edits).some((look) => look.uncertain)).toBe(false)
  })

  it('wraps to an earlier cell that is still open', () => {
    const at40 = selectCell(BASE, NO_EDITS, 40)
    const edits = answerYes(BASE, answerYes(BASE, at40))
    expect(edits.selected).toBe(3)
  })

  it('closes at any time and keeps the answers', () => {
    const edits = closeCell(answerYes(BASE, startCheck(BASE, NO_EDITS)))
    expect(edits).toMatchObject({ selected: null, picking: false })
    expect(looksOf(edits)[3]?.uncertain).toBe(false)
    expect(looksOf(edits)[40]?.uncertain).toBe(true)
  })

  it('returns to the summary after an edit of a sure cell', () => {
    const edits = setDigit(BASE, selectCell(BASE, NO_EDITS, 0), 6)
    expect(edits).toMatchObject({ selected: null, picking: false })
    expect(looksOf(edits)[0]).toEqual(given(6))
  })
})

describe('nextToCheck', () => {
  it('finds the next ring in reading order, and none when no ring is left', () => {
    expect(nextToCheck(BASE, 3)).toBe(40)
    expect(nextToCheck(BASE, 70)).toBe(3)
    expect(nextToCheck(board(), 0)).toBeNull()
  })
})

describe('setDigit', () => {
  it('changes nothing without an open cell', () => {
    expect(setDigit(BASE, NO_EDITS, 4)).toBe(NO_EDITS)
  })

  it('makes a digit in an empty cell a given', () => {
    const edits = setDigit(BASE, selectCell(BASE, NO_EDITS, 70), 2)
    expect(looksOf(edits)[70]).toEqual(given(2))
  })

  it('keeps the kind of a filled cell', () => {
    const edits = setDigit(BASE, answerNo(selectCell(BASE, NO_EDITS, 40)), 1)
    expect(looksOf(edits)[40]).toEqual(entry(1))
  })

  it('does not change the looks it got', () => {
    const before = JSON.parse(JSON.stringify(BASE))
    setDigit(BASE, selectCell(BASE, NO_EDITS, 3), 2)
    expect(BASE).toEqual(before)
  })
})

describe('clearCell', () => {
  it('empties the cell and removes its ring', () => {
    expect(looksOf(clearCell(BASE, selectCell(BASE, NO_EDITS, 3)))[3]).toEqual(EMPTY)
  })
})

describe('setKind', () => {
  it('switches a given to an entry and keeps the cell open', () => {
    const edits = setKind(BASE, selectCell(BASE, NO_EDITS, 3), 'entry')
    expect(looksOf(edits)[3]).toEqual(entry(4))
    expect(edits.selected).toBe(3)
  })

  it('marks notes and clears the digit', () => {
    expect(looksOf(setKind(BASE, selectCell(BASE, NO_EDITS, 3), 'notes'))[3]).toEqual({ ...EMPTY, style: 'notes' })
  })

  it('gives no digitless cell the kind given', () => {
    const open = selectCell(BASE, NO_EDITS, 70)
    expect(setKind(BASE, open, 'given')).toBe(open)
  })
})

describe('panel text', () => {
  it('asks about the read in the check state', () => {
    expect(panelQuestion(en, given(4, true), false)).toBe('Is this a 4?')
    expect(panelQuestion(en, { ...EMPTY, uncertain: true }, false)).toBe('Is this empty?')
    expect(yesLabel(en, given(4))).toBe('Yes, 4')
    expect(yesLabel(en, EMPTY)).toBe('Yes, empty')
  })

  it('asks for the digit in the pick state', () => {
    expect(panelQuestion(en, given(4, true), true)).toBe('What is it?')
    expect(panelQuestion(en, given(4), true)).toBe('Change this 4')
    expect(panelQuestion(en, EMPTY, true)).toBe('Fill this cell')
  })
})

describe('givenConflicts', () => {
  it('marks two givens with the same digit in a row', () => {
    const marked = givenConflicts(board({ 0: given(5), 8: given(5) }))
    expect(marked[0]).toBe(true)
    expect(marked[8]).toBe(true)
    expect(marked.filter(Boolean)).toHaveLength(2)
  })

  it('marks a conflict in a column and in a box', () => {
    expect(givenConflicts(board({ 0: given(3), 72: given(3) }))[72]).toBe(true)
    expect(givenConflicts(board({ 0: given(4), 20: given(4) }))[20]).toBe(true)
  })

  it('does not mark an entry, also when it repeats a given', () => {
    expect(givenConflicts(board({ 0: given(5), 1: entry(5), 2: entry(5) })).some(Boolean)).toBe(false)
  })

  it('does not mark the same digit in different units', () => {
    expect(givenConflicts(board({ 0: given(5), 13: given(5) })).some(Boolean)).toBe(false)
  })

  it('removes the mark when the player switches one given to an entry', () => {
    const base = board({ 0: given(5), 8: given(5) })
    const edits = setKind(base, selectCell(base, NO_EDITS, 8), 'entry')
    expect(givenConflicts(editedLooks(base, edits)).some(Boolean)).toBe(false)
  })
})

describe('correctedGrid', () => {
  it('splits the looks into givens and entries, with 0 for every other cell', () => {
    const grid = correctedGrid(board({ 0: given(5), 1: entry(7), 2: given(9, true) }))
    expect(grid.givens.slice(0, 3)).toEqual([5, 0, 9])
    expect(grid.entries.slice(0, 3)).toEqual([0, 7, 0])
    expect(grid.givens).toHaveLength(GRID_CELLS)
    expect(grid.entries).toHaveLength(GRID_CELLS)
    expect(grid.givens.slice(3).every((value) => value === 0)).toBe(true)
  })
})

describe('cellPlaceLabel', () => {
  it('says the row and the column, from 1', () => {
    expect(cellPlaceLabel(en, 0)).toBe('Row 1, column 1')
    expect(cellPlaceLabel(en, 23)).toBe('Row 3, column 6')
  })
})

describe('correctionCellLabel', () => {
  it('says the place, the kind and the digit', () => {
    expect(correctionCellLabel(en, 0, given(5), false)).toBe('Row 1, column 1, given 5')
    expect(correctionCellLabel(en, 10, entry(7), false)).toBe('Row 2, column 2, entry 7')
    expect(correctionCellLabel(en, 80, EMPTY, false)).toBe('Row 9, column 9, empty')
  })

  it('adds the conflict and the check', () => {
    expect(correctionCellLabel(en, 0, given(5, true), true)).toBe(
      'Row 1, column 1, given 5, same digit as another given, check this cell',
    )
  })
})

describe('the cell text in Dutch', () => {
  it('names the place, the kind and the questions in Dutch', () => {
    expect(cellPlaceLabel(nl, 23)).toBe('Rij 3, kolom 6')
    expect(correctionCellLabel(nl, 10, entry(7), false)).toBe('Rij 2, kolom 2, ingevuld cijfer 7')
    expect(panelQuestion(nl, given(4, true), false)).toBe('Is dit een 4?')
    expect(yesLabel(nl, EMPTY)).toBe('Ja, leeg')
  })
})
