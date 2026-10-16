import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { cellViews } from './cell.utils'
import { reduceSession, startSession, type SessionAction } from './session.utils'
import { sampleStart } from './sample.utils'

const gameAfter = (...actions: SessionAction[]) => actions.reduce(reduceSession, startSession(sampleStart())).game

it('styles givens, entries and wrong entries apart', () => {
  const views = cellViews(gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }), DEFAULT_ASSISTS)
  expect(views[0]).toMatchObject({ digit: 5, digitStyle: 'given' })
  expect(views[2]).toMatchObject({ digit: 5, digitStyle: 'wrong' })
  const right = cellViews(gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 4 }), DEFAULT_ASSISTS)
  expect(right[2]).toMatchObject({ digit: 4, digitStyle: 'entry' })
})

it('shades the row, the column and the box of the selected cell', () => {
  const views = cellViews(gameAfter({ type: 'select', cell: 40 }), DEFAULT_ASSISTS)
  expect(views[40]?.fill).toBe('selected')
  expect(views[36]?.fill).toBe('peer')
  expect(views[4]?.fill).toBe('peer')
  expect(views[30]?.fill).toBe('peer')
  expect(views[0]?.fill).toBe('plain')
})

it('shades every cell with the number of the selected cell', () => {
  // Cell 0 holds 5. Cell 14 holds 5 too, outside the row, column and box of cell 0.
  const views = cellViews(gameAfter({ type: 'select', cell: 0 }), DEFAULT_ASSISTS)
  expect(views[14]?.fill).toBe('same')
})

it('keeps the conflict fill of a wrong entry under the shades', () => {
  const views = cellViews(
    gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }, { type: 'select', cell: 0 }),
    DEFAULT_ASSISTS,
  )
  expect(views[2]?.fill).toBe('conflict')
})

it('follows the assists', () => {
  const game = gameAfter({ type: 'select', cell: 40 })
  const views = cellViews(game, { ...DEFAULT_ASSISTS, rowColumn: false, selectedCell: false })
  expect(views[36]?.fill).toBe('plain')
  expect(views[40]).toMatchObject({ ring: true })
  expect(views[40]?.fill).not.toBe('selected')
})

it('lists the notes of an empty cell in order', () => {
  const views = cellViews(
    gameAfter(
      { type: 'select', cell: 2 },
      { type: 'toggleNotesMode' },
      { type: 'digit', digit: 3 },
      { type: 'digit', digit: 2 },
    ),
    DEFAULT_ASSISTS,
  )
  expect(views[2]?.notes).toBe('23')
})

it('hides every digit and note while the game is paused', () => {
  const views = cellViews(
    gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 4 }, { type: 'pause' }),
    DEFAULT_ASSISTS,
  )
  for (const view of views) expect(view).toMatchObject({ digit: 0, notes: '', fill: 'plain', ring: false })
})
