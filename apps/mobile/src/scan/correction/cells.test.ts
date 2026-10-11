import type { CellResult } from '@/scanner'
import { cellLook, cellsToCheck, REVIEW_CONFIDENCE } from './cells'

const cell = (over: Partial<CellResult>): CellResult => ({
  digit: 5,
  kind: 'printed',
  confidence: 1,
  validPair: true,
  ...over,
})

describe('cellLook', () => {
  it('shows a printed digit as a given', () => {
    expect(cellLook(cell({}))).toEqual({ digit: '5', style: 'given', uncertain: false })
  })

  it('shows a handwritten digit as an entry', () => {
    expect(cellLook(cell({ kind: 'handwritten' }))).toEqual({ digit: '5', style: 'entry', uncertain: false })
  })

  it('shows none, notes and digit 0 as empty', () => {
    expect(cellLook(cell({ kind: 'none', digit: 0 })).style).toBe('empty')
    expect(cellLook(cell({ kind: 'notes' }))).toEqual({ digit: '', style: 'empty', uncertain: false })
    expect(cellLook(cell({ digit: 0 })).digit).toBe('')
  })

  it('marks a cell below the confidence threshold', () => {
    expect(REVIEW_CONFIDENCE).toBe(0.9)
    expect(cellLook(cell({ confidence: 0.89 })).uncertain).toBe(true)
    expect(cellLook(cell({ confidence: 0.9 })).uncertain).toBe(false)
  })

  it('marks an invalid pair', () => {
    expect(cellLook(cell({ validPair: false })).uncertain).toBe(true)
  })

  it('keeps the ring on an uncertain empty cell', () => {
    expect(cellLook(cell({ kind: 'none', digit: 0, confidence: 0.5 }))).toEqual({
      digit: '',
      style: 'empty',
      uncertain: true,
    })
  })
})

describe('cellsToCheck', () => {
  it('counts the uncertain cells', () => {
    const cells = [
      cell({}),
      cell({ confidence: 0.2 }),
      cell({ validPair: false }),
      cell({ kind: 'none', digit: 0, confidence: 0.1 }),
    ]
    expect(cellsToCheck(cells)).toBe(3)
    expect(cellsToCheck([])).toBe(0)
  })
})
