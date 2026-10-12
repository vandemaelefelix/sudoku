import { GRID_CELLS } from '../grid'
import { MAX_MISTAKES, UNDO_LIMIT } from './constants'
import { createGame } from './createGame'
import type { Digit, Game, GameStatus, UndoStep } from './types'

export const SAVED_GAME_VERSION = 1

/** A game as plain JSON data. Change SAVED_GAME_VERSION when this shape changes. */
export type SavedGame = {
  version: typeof SAVED_GAME_VERSION
  givens: number[]
  solution: number[]
  entries: number[]
  notes: number[][]
  selected: number | null
  mistakes: number
  hintsUsed: number
  playedMs: number
  status: GameStatus
  undoSteps: { entries: number[]; notes: number[][] }[]
}

const STATUSES: readonly GameStatus[] = ['playing', 'paused', 'lost', 'won']

export function toSavedGame(game: Game): SavedGame {
  return {
    version: SAVED_GAME_VERSION,
    givens: [...game.givens],
    solution: [...game.solution],
    entries: [...game.entries],
    notes: game.notes.map((cellNotes) => [...cellNotes]),
    selected: game.selected,
    mistakes: game.mistakes,
    hintsUsed: game.hintsUsed,
    playedMs: game.playedMs,
    status: game.status,
    undoSteps: game.undoSteps.map((step) => ({
      entries: [...step.entries],
      notes: step.notes.map((cellNotes) => [...cellNotes]),
    })),
  }
}

/** Throws a RangeError when `value` is not a valid saved game of this version. */
export function fromSavedGame(value: unknown): Game {
  const saved = record(value, 'The saved game')
  if (saved.version !== SAVED_GAME_VERSION) {
    throw new RangeError(
      `The saved game version ${String(saved.version)} is not ${SAVED_GAME_VERSION}`,
    )
  }
  const board = createGame({
    givens: numbers(saved.givens, 'givens'),
    solution: numbers(saved.solution, 'solution'),
    entries: numbers(saved.entries, 'entries'),
  })
  const steps = list(saved.undoSteps, 'undoSteps')
  if (steps.length > UNDO_LIMIT) throw new RangeError(`More than ${UNDO_LIMIT} undo steps`)
  const undoSteps: UndoStep[] = steps.map((item, index) => {
    const step = record(item, `Undo step ${index}`)
    const entries = createGame({
      givens: board.givens,
      solution: board.solution,
      entries: numbers(step.entries, `undo step ${index} entries`),
    }).entries
    return { entries, notes: notes(step.notes, `undo step ${index} notes`) }
  })
  return {
    ...board,
    notes: notes(saved.notes, 'notes'),
    selected:
      saved.selected === null ? null : integer(saved.selected, 'selected', 0, GRID_CELLS - 1),
    mistakes: integer(saved.mistakes, 'mistakes', 0, MAX_MISTAKES),
    hintsUsed: integer(saved.hintsUsed, 'hintsUsed', 0, Number.MAX_SAFE_INTEGER),
    playedMs: duration(saved.playedMs),
    status: status(saved.status),
    undoSteps,
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError(`${name} is not an object`)
  }
  return value as Record<string, unknown>
}

function list(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new RangeError(`The ${name} are not a list`)
  return value
}

function numbers(value: unknown, name: string): number[] {
  const items = list(value, name)
  if (!items.every((item) => typeof item === 'number')) {
    throw new RangeError(`The ${name} hold a value that is not a number`)
  }
  return items as number[]
}

function integer(value: unknown, name: string, lowest: number, highest: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < lowest || value > highest) {
    throw new RangeError(`The ${name} value ${String(value)} is outside ${lowest} to ${highest}`)
  }
  return value
}

function duration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`The time played ${String(value)} is not a duration`)
  }
  return value
}

function status(value: unknown): GameStatus {
  const found = STATUSES.find((item) => item === value)
  if (found === undefined) throw new RangeError(`The status ${String(value)} is not known`)
  return found
}

/** 81 lists of digits 1 to 9, each sorted, without repeats. */
function notes(value: unknown, name: string): Digit[][] {
  const cells = list(value, name)
  if (cells.length !== GRID_CELLS) throw new RangeError(`The ${name} have ${cells.length} cells`)
  return cells.map((cell) => {
    const digits = numbers(cell, name)
    const sorted = digits.every(
      (digit, index) =>
        Number.isInteger(digit) &&
        digit >= 1 &&
        digit <= 9 &&
        (index === 0 || digit > (digits[index - 1] ?? 0)),
    )
    if (!sorted) throw new RangeError(`The ${name} hold notes that are not sorted digits`)
    return digits as Digit[]
  })
}
