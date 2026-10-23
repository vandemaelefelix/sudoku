import { BOXES, COLUMNS, ROWS, type Completion, type Game } from '@sudoku/core'
import { LONGEST_PULSE_STEPS, NO_PULSE, POP_PEAK_AT, WAVE_PEAK_AT } from '@/constants/pulse.constants'
import type { Theme } from '@/theme/theme.types'
import { columnOf, rowOf } from '@/utils/grid.utils'

/** The part of a game move that a pulse reads. A game `Move` fits it. */
export type PulseMove = { id: number; cell: number | null; completed: Completion }

/** The theme tokens of one pulse. Times in milliseconds. */
export type PulseLook = { stepMs: number; waveMs: number; popMs: number; waveOpacity: number; popScale: number }

export function pulseLook({ motion, components }: Theme): PulseLook {
  return {
    stepMs: motion.pulseStep,
    waveMs: motion.long,
    popMs: motion.pop,
    waveOpacity: components.pulse.waveOpacity,
    popScale: components.pulse.popScale,
  }
}

/** The cells that a completion pulses, in any order. */
function pulsedCells(board: Game, completed: Completion): number[] {
  if (completed.grid) return board.solution.map((_, cell) => cell)
  const cells = new Set<number>()
  const units = [
    ...completed.rows.map((row) => ROWS[row] ?? []),
    ...completed.columns.map((column) => COLUMNS[column] ?? []),
    ...completed.boxes.map((box) => BOXES[box] ?? []),
  ]
  for (const unit of units) for (const cell of unit) cells.add(cell)
  // The solution, not the shown value: a wrong copy of a complete number must not pulse.
  board.solution.forEach((value, cell) => {
    if (completed.digits.some((digit) => digit === value)) cells.add(cell)
  })
  return [...cells]
}

/** One delay per cell, row by row, in ms after the move: stepMs per step from the cell of the move. null when the move completed nothing. */
export function pulseDelays(board: Game, move: PulseMove | null, stepMs: number): number[] | null {
  if (move === null || move.cell === null) return null
  const cells = pulsedCells(board, move.completed)
  if (cells.length === 0) return null
  const origin = move.cell
  const delays = board.solution.map(() => NO_PULSE)
  for (const cell of cells) {
    const steps = Math.abs(rowOf(cell) - rowOf(origin)) + Math.abs(columnOf(cell) - columnOf(origin))
    delays[cell] = steps * stepMs
  }
  return delays
}

/** The time from the move to the end of the last wave or pop. */
export function pulseDuration(delays: readonly number[], look: PulseLook): number {
  return Math.max(...delays) + Math.max(look.waveMs, look.popMs)
}

/** The longest pulse of a solved grid, from any cell. */
export function solvePulseDuration(look: PulseLook): number {
  return LONGEST_PULSE_STEPS * look.stepMs + Math.max(look.waveMs, look.popMs)
}

function easeOut(x: number): number {
  'worklet'
  return 1 - (1 - x) * (1 - x)
}

/** 0, up to 1 at peakAt, down to 0 at the end. t is the part of the animation, 0 to 1. Each half eases out, close to a CSS ease-out keyframe. */
function keyframe(t: number, peakAt: number): number {
  'worklet'
  if (t <= 0 || t >= 1) return 0
  return t < peakAt ? easeOut(t / peakAt) : 1 - easeOut((t - peakAt) / (1 - peakAt))
}

export function waveOpacity(elapsed: number, delay: number, look: PulseLook): number {
  'worklet'
  if (delay === NO_PULSE) return 0
  return look.waveOpacity * keyframe((elapsed - delay) / look.waveMs, WAVE_PEAK_AT)
}

export function popScale(elapsed: number, delay: number, look: PulseLook): number {
  'worklet'
  if (delay === NO_PULSE) return 1
  return 1 + (look.popScale - 1) * keyframe((elapsed - delay) / look.popMs, POP_PEAK_AT)
}
