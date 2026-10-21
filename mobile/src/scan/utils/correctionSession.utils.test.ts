import { isFull, markedCells, panelState } from './correctionSession.utils'

describe('panelState', () => {
  it('shows the failure whatever else is open', () => {
    expect(panelState(true, 3, true)).toBe('failure')
  })

  it('shows the summary without an open cell', () => {
    expect(panelState(false, null, false)).toBe('summary')
  })

  it('shows the check state for an open cell, and the pick state with the keypad', () => {
    expect(panelState(false, 3, false)).toBe('check')
    expect(panelState(false, 3, true)).toBe('pick')
  })
})

const emptyGrid = () => ({ givens: Array.from({ length: 81 }, () => 0), entries: Array.from({ length: 81 }, () => 0) })

describe('isFull', () => {
  it('is false while a cell is empty', () => {
    expect(isFull(emptyGrid())).toBe(false)
  })

  it('is true when every cell holds a given or an entry', () => {
    const full = emptyGrid()
    full.givens.fill(1, 0, 40)
    full.entries.fill(2, 40)
    expect(isFull(full)).toBe(true)
  })
})

describe('markedCells', () => {
  it('marks the wrong entries', () => {
    expect([...markedCells({ status: 'wrong', hints: { 4: 7, 9: 2 } })]).toEqual([4, 9])
  })

  it('marks the cells that clash', () => {
    expect([...markedCells({ status: 'clash', cells: [1, 2] })]).toEqual([1, 2])
  })

  it('marks nothing for a solved grid or without a verdict', () => {
    expect(markedCells({ status: 'solved' }).size).toBe(0)
    expect(markedCells(null).size).toBe(0)
  })
})
