import { GRID_CELLS } from '@sudoku/core'
import type { CellLook } from '@/scan/utils/correction.utils'
import {
  clearCell,
  correctedGrid,
  correctionCellLabel,
  deselect,
  givenConflicts,
  selectCell,
  setDigit,
  setKind,
  startEdits,
} from './correctionEdit.utils'

const EMPTY: CellLook = { digit: '', style: 'empty', uncertain: false }
const given = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'given', uncertain })
const entry = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'entry', uncertain })

function board(cells: { [n: number]: CellLook } = {}): CellLook[] {
  return Array.from({ length: GRID_CELLS }, (_, n) => cells[n] ?? EMPTY)
}

describe('selectCell', () => {
  it('selects a cell, and a second tap on it clears the selection', () => {
    const edits = selectCell(startEdits(board()), 4)
    expect(edits.selected).toBe(4)
    expect(selectCell(edits, 4).selected).toBeNull()
    expect(selectCell(edits, 5).selected).toBe(5)
  })

  it('deselect clears the selection', () => {
    expect(deselect(selectCell(startEdits(board()), 4)).selected).toBeNull()
  })
})

describe('setDigit', () => {
  it('changes nothing without a selected cell', () => {
    const edits = startEdits(board())
    expect(setDigit(edits, 5)).toBe(edits)
  })

  it('makes a digit in an empty cell a given', () => {
    expect(setDigit(selectCell(startEdits(board()), 0), 5).looks[0]).toEqual(given(5))
  })

  it('keeps the kind of a filled cell and removes its ring', () => {
    const edits = setDigit(selectCell(startEdits(board({ 3: entry(1, true) })), 3), 7)
    expect(edits.looks[3]).toEqual(entry(7))
  })

  it('keeps the selection, so the player can correct again', () => {
    expect(setDigit(selectCell(startEdits(board()), 0), 5).selected).toBe(0)
  })

  it('does not change the looks it got', () => {
    const looks = board({ 3: entry(1, true) })
    setDigit(selectCell(startEdits(looks), 3), 7)
    expect(looks[3]).toEqual(entry(1, true))
  })
})

describe('clearCell', () => {
  it('empties the cell and removes its ring', () => {
    const edits = clearCell(selectCell(startEdits(board({ 2: given(9, true) })), 2))
    expect(edits.looks[2]).toEqual(EMPTY)
  })
})

describe('setKind', () => {
  it('switches a given to an entry and back', () => {
    const asEntry = setKind(selectCell(startEdits(board({ 0: given(5) })), 0), 'entry')
    expect(asEntry.looks[0]).toEqual(entry(5))
    expect(setKind(asEntry, 'given').looks[0]).toEqual(given(5))
  })

  it('removes the ring also when the kind stays, because the player checked the cell', () => {
    const edits = setKind(selectCell(startEdits(board({ 0: given(5, true) })), 0), 'given')
    expect(edits.looks[0]).toEqual(given(5))
  })

  it('changes nothing in an empty cell', () => {
    const edits = selectCell(startEdits(board({ 0: { ...EMPTY, uncertain: true } })), 0)
    expect(setKind(edits, 'entry').looks[0]).toEqual({ ...EMPTY, uncertain: true })
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
    const edits = setKind(selectCell(startEdits(board({ 0: given(5), 8: given(5) })), 8), 'entry')
    expect(givenConflicts(edits.looks).some(Boolean)).toBe(false)
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

describe('correctionCellLabel', () => {
  it('says the place, the kind and the digit', () => {
    expect(correctionCellLabel(0, given(5), false)).toBe('Row 1, column 1, given 5')
    expect(correctionCellLabel(10, entry(7), false)).toBe('Row 2, column 2, entry 7')
    expect(correctionCellLabel(80, EMPTY, false)).toBe('Row 9, column 9, empty')
  })

  it('adds the conflict and the check', () => {
    expect(correctionCellLabel(0, given(5, true), true)).toBe(
      'Row 1, column 1, given 5, same digit as another given, check this cell',
    )
  })
})
