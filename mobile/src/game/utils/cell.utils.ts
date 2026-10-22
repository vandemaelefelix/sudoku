import { isWrong, UNITS, valueAt, type Game, type Step } from '@sudoku/core'
import type { Assists } from '@/game/constants/assists.constants'
import { HINT_EDGE } from '@/game/constants/hint.constants'
import type { Theme } from '@/theme/theme.types'
import { boxOf, columnOf, rowOf } from './grid.utils'

/** focus: the tint of a focus unit while a hint is open. */
export type CellFill = 'plain' | 'peer' | 'same' | 'focus' | 'conflict' | 'selected'

export type DigitStyle = 'given' | 'entry' | 'wrong'

/** small: digits at the note size and no notes, for a grid of about 20 pt cells. */
export type DigitSize = 'full' | 'small'

/** What one cell shows. digit 0: no digit. notes: the note digits in order, for example "35". */
export type CellView = {
  digit: number
  digitStyle: DigitStyle
  notes: string
  fill: CellFill
  /** A thin ring marks the selected cell when the selected-cell assist is off. */
  ring: boolean
  /** The hint roles (ADR-032). hintEdges: HINT_EDGE bits of the focus outline. */
  hintEdges: number
  hintPattern: boolean
  hintSupport: boolean
  /** The struck note digits in order, for example "26". */
  hintStruck: string
  /** The ghost digit of the target cell. 0: not a target. */
  hintTarget: number
}

/**
 * The cells that an open hint marks. A Step of the technique solver is a highlight as it is. units: unit indices 0 to 26,
 * the focus units. eliminations: the struck candidates. placements: the target cells.
 */
export type HintHighlight = Pick<Step, 'units' | 'pattern' | 'support' | 'eliminations' | 'placements'>

const NO_HINT = { hintEdges: 0, hintPattern: false, hintSupport: false, hintStruck: '', hintTarget: 0 } as const

const HIDDEN: CellView = { digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false, ...NO_HINT }

/** For each cell, the HINT_EDGE bits of the sides where the region ends. */
function regionEdges(region: ReadonlySet<number>): number[] {
  const inside = (row: number, column: number) =>
    row >= 0 && row < 9 && column >= 0 && column < 9 && region.has(row * 9 + column)
  return Array.from({ length: 81 }, (_, cell) => {
    if (!region.has(cell)) return 0
    const row = rowOf(cell)
    const column = columnOf(cell)
    return (
      (inside(row - 1, column) ? 0 : HINT_EDGE.top) |
      (inside(row, column + 1) ? 0 : HINT_EDGE.right) |
      (inside(row + 1, column) ? 0 : HINT_EDGE.bottom) |
      (inside(row, column - 1) ? 0 : HINT_EDGE.left)
    )
  })
}

/**
 * The view of each cell, row by row. A paused game hides the whole board. While a hint highlight is set, the assist
 * shades step back: only the hint roles, the conflict fill and the selected cell show.
 */
export function cellViews(game: Game, assists: Assists, highlight: HintHighlight | null = null): CellView[] {
  if (game.status === 'paused') return game.givens.map(() => HIDDEN)
  const selected = game.selected
  const selectedValue = selected === null ? 0 : valueAt(game, selected)
  const focus = new Set(highlight?.units.flatMap((unit) => UNITS[unit] ?? []))
  const edges = regionEdges(focus)
  return game.givens.map((given, cell) => {
    const digit = valueAt(game, cell)
    const wrong = isWrong(game, cell)
    const notes = digit === 0 ? (game.notes[cell] ?? []) : []
    const target = digit === 0 ? (highlight?.placements.find((placement) => placement.cell === cell)?.digit ?? 0) : 0
    let fill: CellFill = 'plain'
    if (highlight !== null) {
      if (focus.has(cell)) fill = 'focus'
    } else if (selected !== null) {
      const sameLine = rowOf(cell) === rowOf(selected) || columnOf(cell) === columnOf(selected)
      if (assists.rowColumn && sameLine) fill = 'peer'
      if (assists.box && boxOf(cell) === boxOf(selected)) fill = 'peer'
      if (assists.sameNumbers && selectedValue !== 0 && cell !== selected && digit === selectedValue) fill = 'same'
    }
    if (wrong) fill = 'conflict'
    if (cell === selected && assists.selectedCell) fill = 'selected'
    return {
      digit,
      digitStyle: given !== 0 ? 'given' : wrong ? 'wrong' : 'entry',
      notes: target === 0 ? notes.join('') : '',
      fill,
      ring: cell === selected && !assists.selectedCell,
      hintEdges: edges[cell] ?? 0,
      hintPattern: highlight?.pattern.includes(cell) ?? false,
      hintSupport: digit !== 0 && (highlight?.support.includes(cell) ?? false),
      hintStruck: notes
        .filter((note) => highlight?.eliminations.some((struck) => struck.cell === cell && struck.digit === note))
        .join(''),
      hintTarget: target,
    }
  })
}

type CellColours = Theme['components']['cell']

/** The fill of a display cell, as plain values. The same colours as the fill keys of the cell styles. */
export function displayFill(colours: CellColours, fill: CellFill) {
  switch (fill) {
    case 'plain':
      return { backgroundColor: colours.fill }
    case 'peer':
      return { backgroundColor: colours.peer }
    case 'same':
      return { backgroundColor: colours.same }
    case 'focus':
      return { backgroundColor: colours.hintFocus }
    case 'conflict':
      return { backgroundColor: colours.conflictFill }
    case 'selected':
      return {
        backgroundColor: colours.selected,
        borderWidth: colours.selectedRingWidth,
        borderColor: colours.ring,
      }
  }
}
