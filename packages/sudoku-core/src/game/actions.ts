import { GRID_CELLS } from '../grid'
import { peersOf } from '../units'
import { completeDigits, completedBetween, isSolved, NOTHING_COMPLETED } from './completion'
import { MAX_MISTAKES, UNDO_LIMIT } from './constants'
import type { Digit, Game, MoveResult, UndoStep } from './types'

/** For an action that completes nothing. With the same game object, the action changed nothing. */
const noCompletion = (game: Game): MoveResult => ({ game, completed: NOTHING_COMPLETED })

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  const copy = [...items]
  copy[index] = value
  return copy
}

/** The selected cell when the player may change it, else null. */
function editableCell(game: Game): number | null {
  const cell = game.selected
  if (game.status !== 'playing' || cell === null || game.givens[cell] !== 0) return null
  return cell
}

function withUndoStep(game: Game): readonly UndoStep[] {
  return [...game.undoSteps, { entries: game.entries, notes: game.notes }].slice(-UNDO_LIMIT)
}

/** Puts `digit` in `cell`, empties its notes and removes `digit` from the notes of its peers. */
function withNumber(game: Game, cell: number, digit: Digit): Pick<Game, 'entries' | 'notes'> {
  const peers = new Set(peersOf(cell))
  return {
    entries: replaceAt(game.entries, cell, digit),
    notes: game.notes.map((cellNotes, other) => {
      if (other === cell) return []
      return peers.has(other) ? cellNotes.filter((note) => note !== digit) : cellNotes
    }),
  }
}

/** Wins the game when the grid is solved, and reports what `after` completed. */
function settle(before: Game, after: Game): MoveResult {
  const game: Game = isSolved(after) ? { ...after, status: 'won' } : after
  return { game, completed: completedBetween(before, game) }
}

export function select(game: Game, cell: number | null): Game {
  if (cell !== null && (!Number.isInteger(cell) || cell < 0 || cell >= GRID_CELLS)) {
    throw new RangeError(`Cell ${cell} is outside the grid`)
  }
  if (game.status !== 'playing' || game.selected === cell) return game
  return { ...game, selected: cell }
}

export function place(game: Game, digit: Digit): MoveResult {
  const cell = editableCell(game)
  if (cell === null || completeDigits(game).includes(digit)) return noCompletion(game)
  if (game.entries[cell] === digit) {
    return noCompletion({
      ...game,
      entries: replaceAt(game.entries, cell, 0),
      undoSteps: withUndoStep(game),
    })
  }
  const next: Game = { ...game, ...withNumber(game, cell, digit), undoSteps: withUndoStep(game) }
  if (digit !== game.solution[cell]) {
    const mistakes = game.mistakes + 1
    return noCompletion({
      ...next,
      mistakes,
      status: mistakes >= MAX_MISTAKES ? 'lost' : 'playing',
    })
  }
  return settle(game, next)
}

export function toggleNote(game: Game, digit: Digit): MoveResult {
  const cell = editableCell(game)
  if (cell === null || game.entries[cell] !== 0) return noCompletion(game)
  const current = game.notes[cell] ?? []
  const cellNotes = current.includes(digit)
    ? current.filter((note) => note !== digit)
    : [...current, digit].sort((a, b) => a - b)
  return noCompletion({
    ...game,
    notes: replaceAt(game.notes, cell, cellNotes),
    undoSteps: withUndoStep(game),
  })
}

export function erase(game: Game): MoveResult {
  const cell = editableCell(game)
  if (cell === null || (game.entries[cell] === 0 && (game.notes[cell] ?? []).length === 0)) {
    return noCompletion(game)
  }
  return noCompletion({
    ...game,
    entries: replaceAt(game.entries, cell, 0),
    notes: replaceAt(game.notes, cell, []),
    undoSteps: withUndoStep(game),
  })
}
