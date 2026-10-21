import { isWrong, valueAt, type Game } from '@sudoku/core'
import type { Assists } from '@/game/constants/assists.constants'
import type { Theme } from '@/theme/theme.types'
import { boxOf, columnOf, rowOf } from './grid.utils'

export type CellFill = 'plain' | 'peer' | 'same' | 'conflict' | 'selected'

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
}

const HIDDEN: CellView = { digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false }

/** The view of each cell, row by row. A paused game hides the whole board. */
export function cellViews(game: Game, assists: Assists): CellView[] {
  if (game.status === 'paused') return game.givens.map(() => HIDDEN)
  const selected = game.selected
  const selectedValue = selected === null ? 0 : valueAt(game, selected)
  return game.givens.map((given, cell) => {
    const digit = valueAt(game, cell)
    const wrong = isWrong(game, cell)
    let fill: CellFill = 'plain'
    if (selected !== null) {
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
      notes: digit === 0 ? (game.notes[cell] ?? []).join('') : '',
      fill,
      ring: cell === selected && !assists.selectedCell,
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
