import { DEFAULT_ASSISTS } from '@/game/constants/assists.constants'
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

const fills = (views: readonly { hintFill: string }[]) => views.map((view) => view.hintFill)

describe('the hint roles', () => {
  it('draws no role without a highlight', () => {
    const views = cellViews(gameAfter({ type: 'select', cell: 2 }), DEFAULT_ASSISTS)
    for (const view of views) {
      expect(view).toMatchObject({ hintFill: 'none', hintSupport: false, hintStruck: '', hintTarget: 0 })
    }
  })

  it('tints a focus unit with one fill', () => {
    const views = cellViews(gameAfter(), DEFAULT_ASSISTS, highlight({ units: [0] }))
    expect(fills(views.slice(0, 9))).toEqual(Array(9).fill('focus'))
    expect(views[9]?.hintFill).toBe('none')
    expect(views.slice(0, 9).every((view) => view.fill === 'plain')).toBe(true)
  })

  it('gives two focus units that overlap one tint, not a darker one', () => {
    // Row 1 and the top-left box overlap in cells 0, 1 and 2.
    const views = cellViews(gameAfter(), DEFAULT_ASSISTS, highlight({ units: [0, 18] }))
    expect(new Set([views[0]?.hintFill, views[3]?.hintFill, views[10]?.hintFill])).toEqual(new Set(['focus']))
  })

  it('hides the assist shades and the selected cell while a hint is open', () => {
    const views = cellViews(gameAfter({ type: 'select', cell: 0 }), DEFAULT_ASSISTS, highlight({ units: [8] }))
    expect(views[0]).toMatchObject({ fill: 'plain', ring: false })
    expect(views[9]?.fill).toBe('plain')
    // Cell 14 holds the 5 of cell 0.
    expect(views[14]?.fill).toBe('plain')
    const noAssist = { ...DEFAULT_ASSISTS, selectedCell: false }
    expect(cellViews(gameAfter({ type: 'select', cell: 0 }), noAssist, highlight({ units: [8] }))[0]?.ring).toBe(false)
  })

  it('keeps the conflict fill of a wrong entry, without a hint fill', () => {
    const game = gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }, { type: 'select', cell: 40 })
    const views = cellViews(game, DEFAULT_ASSISTS, highlight({ units: [0], pattern: [2] }))
    expect(views[2]).toMatchObject({ fill: 'conflict', hintFill: 'none' })
  })

  it('keeps a wrong entry in its conflict colours when it is a support digit', () => {
    const game = gameAfter({ type: 'select', cell: 2 }, { type: 'digit', digit: 5 }, { type: 'select', cell: 40 })
    expect(cellViews(game, DEFAULT_ASSISTS, highlight({ support: [2] }))[2]).toMatchObject({
      digitStyle: 'wrong',
      hintSupport: false,
      hintFill: 'none',
    })
  })

  it('lets the strongest role win: target, then pattern, then focus', () => {
    const views = cellViews(
      gameAfter(),
      DEFAULT_ASSISTS,
      highlight({ units: [0], pattern: [2, 3], placements: [{ cell: 2, digit: 4 }] }),
    )
    expect(views[2]?.hintFill).toBe('target')
    expect(views[3]?.hintFill).toBe('pattern')
    expect(views[4]?.hintFill).toBe('focus')
  })

  it('colours a support digit and gives its cell the focus fill, only on a cell with a digit', () => {
    const views = cellViews(gameAfter(), DEFAULT_ASSISTS, highlight({ support: [0, 5] }))
    expect(views[0]).toMatchObject({ hintSupport: true, hintFill: 'focus' })
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
    for (const view of views) expect(view).toMatchObject({ fill: 'plain', hintFill: 'none', hintSupport: false })
  })
})

it('gives a display fill the colours of the fill keys of the cell styles', () => {
  const colours = forestColour.components.cell
  expect(displayFill(colours, 'plain')).toEqual({ backgroundColor: colours.fill })
  expect(displayFill(colours, 'peer')).toEqual({ backgroundColor: colours.peer })
  expect(displayFill(colours, 'same')).toEqual({ backgroundColor: colours.same })
  expect(displayFill(colours, 'conflict')).toEqual({ backgroundColor: colours.conflictFill })
  expect(displayFill(colours, 'selected')).toEqual({ backgroundColor: colours.selected })
})
