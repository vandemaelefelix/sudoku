import { NOTHING_COMPLETED } from '@sudoku/core'
import type { Move } from '@/game/utils/session.utils'
import { markOf } from './mark.utils'

const move = (change: Partial<Move>): Move => ({
  id: 7,
  kind: 'number',
  cell: 2,
  completed: NOTHING_COMPLETED,
  mistake: false,
  ...change,
})

describe('markOf', () => {
  it('marks a mistake, a hint and an undo on their cell', () => {
    expect(markOf(move({ mistake: true }))).toEqual({ cell: 2, id: 7, kind: 'mistake' })
    expect(markOf(move({ kind: 'hint' }))).toEqual({ cell: 2, id: 7, kind: 'hint' })
    expect(markOf(move({ kind: 'undo', cell: 40 }))).toEqual({ cell: 40, id: 7, kind: 'undo' })
  })

  it('marks nothing for a right number, a note, a clear or an erase', () => {
    for (const kind of ['number', 'note', 'clear', 'erase'] as const) expect(markOf(move({ kind }))).toBeNull()
  })

  it('marks nothing without a move or a cell', () => {
    expect(markOf(null)).toBeNull()
    expect(markOf(move({ kind: 'undo', cell: null }))).toBeNull()
  })
})
