import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
import { HINT_EDGE } from '@/game/constants/hint.constants'
import { forestColour } from '@/theme/themes/forest'
import { cellViews, displayFill, type HintHighlight } from './cell.utils'
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

const highlight = (roles: Partial<HintHighlight>): HintHighlight => ({
  units: [],
  pattern: [],
  support: [],
  eliminations: [],
  placements: [],
  ...roles,
})

describe('the hint roles', () => {
  const { top, right, bottom, left } = HINT_EDGE

  it('draws no role without a highlight', () => {
    const views = cellViews(gameAfter({ type: 'select', cell: 2 }), DEFAULT_ASSISTS)
    for (const view of views) {
      expect(view).toMatchObject({
        hintFocus: false,
        hintEdges: 0,
        hintPattern: false,
        hintSupport: false,
        hintStruck: '',
        hintTarget: 0,
      })
    }
  })

  it('tints a focus unit and outlines it', () => {
    const views = cellViews(gameAfter(), DEFAULT_ASSISTS, highlight({ units: [0] }))
    expect(views.slice(0, 9).map((view) => view.fill)).toEqual(Array(9).fill('focus'))
    expect(views.slice(0, 9).every((view) => view.hintFocus)).toBe(true)
    expect(views[9]?.fill).toBe('plain')
    expect(views[9]?.hintFocus).toBe(false)
    expect(views[0]?.hintEdges).toBe(top | bottom | left)
    expect(views[4]?.hintEdges).toBe(top | bottom)
    expect(views[8]?.hintEdges).toBe(top | right | bottom)
    expect(views[9]?.hintEdges).toBe(0)
  })

  it('outlines the outside of several focus units together', () => {
    // Row 1 and the top-left box overlap in cells 0, 1 and 2.
    const views = cellViews(gameAfter(), DEFAULT_ASSISTS, highlight({ units: [0, 18] }))
    expect(views[0]?.hintEdges).toBe(top | left)
    expect(views[3]?.hintEdges).toBe(top | bottom)
    expect(views[10]?.hintEdges).toBe(0)
    expect(views[11]?.hintEdges).toBe(right)
    expect(views[20]?.hintEdges).toBe(right | bottom)
  })

  it('steps back the assist shades and keeps the selected cell', () => {
    const views = cellViews(gameAfter({ type: 'select', cell: 0 }), DEFAULT_ASSISTS, highlight({ units: [8] }))
    expect(views[0]?.fill).toBe('selected')
    expect(views[9]?.fill).toBe('plain')
    expect(views[1]?.fill).toBe('plain')
    // Cell 14 holds the 5 of cell 0.
    expect(views[14]?.fill).toBe('plain')
  })

  it('keeps the conflict fill inside a focus unit', () => {
    const game = gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }, { type: 'select', cell: 40 })
    const views = cellViews(game, DEFAULT_ASSISTS, highlight({ units: [0] }))
    expect(views[2]?.fill).toBe('conflict')
    expect(views[2]?.hintEdges).toBe(top | bottom)
    expect(views[2]?.hintFocus).toBe(true)
  })

  it('marks the pattern cells, and the support digits only on a cell with a digit', () => {
    const views = cellViews(gameAfter(), DEFAULT_ASSISTS, highlight({ pattern: [2, 3], support: [0, 5] }))
    expect(views.filter((view) => view.hintPattern)).toHaveLength(2)
    expect(views[2]?.hintPattern).toBe(true)
    expect(views[0]?.hintSupport).toBe(true)
    expect(views[5]?.hintSupport).toBe(false)
  })

  it('strikes a candidate only on a note that the player wrote', () => {
    const game = gameAfter(
      { type: 'select', cell: 2 },
      { type: 'toggleNotesMode' },
      { type: 'digit', digit: 6 },
      { type: 'digit', digit: 2 },
    )
    const eliminations = [
      { cell: 2, digit: 6 },
      { cell: 2, digit: 2 },
      { cell: 2, digit: 7 },
      { cell: 3, digit: 1 },
    ] as const
    const views = cellViews(game, DEFAULT_ASSISTS, highlight({ eliminations }))
    expect(views[2]?.hintStruck).toBe('26')
    expect(views[3]?.hintStruck).toBe('')
  })

  it('shows the target digit as a ghost on an empty cell, in place of its notes', () => {
    const game = gameAfter({ type: 'select', cell: 2 }, { type: 'toggleNotesMode' }, { type: 'digit', digit: 4 })
    const views = cellViews(
      game,
      DEFAULT_ASSISTS,
      highlight({
        placements: [
          { cell: 2, digit: 4 },
          { cell: 0, digit: 5 },
        ],
      }),
    )
    expect(views[2]).toMatchObject({ hintTarget: 4, notes: '' })
    expect(views[0]?.hintTarget).toBe(0)
  })

  it('hides every role while the game is paused', () => {
    const game = gameAfter({ type: 'pause' })
    const views = cellViews(game, DEFAULT_ASSISTS, highlight({ units: [0], pattern: [2], support: [0] }))
    for (const view of views) expect(view).toMatchObject({ fill: 'plain', hintEdges: 0, hintPattern: false })
  })
})

it('gives a display fill the colours of the fill keys of the cell styles', () => {
  const colours = forestColour.components.cell
  expect(displayFill(colours, 'plain')).toEqual({ backgroundColor: colours.fill })
  expect(displayFill(colours, 'peer')).toEqual({ backgroundColor: colours.peer })
  expect(displayFill(colours, 'same')).toEqual({ backgroundColor: colours.same })
  expect(displayFill(colours, 'conflict')).toEqual({ backgroundColor: colours.conflictFill })
  expect(displayFill(colours, 'focus')).toEqual({ backgroundColor: colours.hintFocus })
  expect(displayFill(colours, 'selected')).toEqual({
    backgroundColor: colours.selected,
    borderWidth: colours.selectedRingWidth,
    borderColor: colours.ring,
  })
})
