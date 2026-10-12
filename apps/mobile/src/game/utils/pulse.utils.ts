import { BOXES, COLUMNS, ROWS, type Completion, type Game } from '@sudoku/core'
import {
  NO_PULSE,
  POP_MS,
  POP_PEAK_AT,
  POP_SCALE,
  PULSE_STEP_MS,
  WAVE_MS,
  WAVE_PEAK_AT,
  WAVE_PEAK_OPACITY,
} from '@/game/constants/pulse.constants'
import { columnOf, rowOf } from './grid.utils'
import type { Move } from './session.utils'

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

/** One delay per cell, row by row, in ms after the move. null when the move completed nothing. */
export function pulseDelays(board: Game, move: Move | null): number[] | null {
  if (move === null || move.cell === null) return null
  const cells = pulsedCells(board, move.completed)
  if (cells.length === 0) return null
  const origin = move.cell
  const delays = board.solution.map(() => NO_PULSE)
  for (const cell of cells) {
    const steps = Math.abs(rowOf(cell) - rowOf(origin)) + Math.abs(columnOf(cell) - columnOf(origin))
    delays[cell] = steps * PULSE_STEP_MS
  }
  return delays
}

/** The wave lasts longer than the pop, so the last wave ends the pulse. */
export function pulseDuration(delays: readonly number[]): number {
  return Math.max(...delays) + WAVE_MS
}

function easeOut(x: number): number {
  'worklet'
  return 1 - (1 - x) * (1 - x)
}

/** 0, up to 1 at peakAt, down to 0 at the end. t is the part of the animation, 0 to 1. Each half eases out, as a CSS keyframe does. */
function keyframe(t: number, peakAt: number): number {
  'worklet'
  if (t <= 0 || t >= 1) return 0
  return t < peakAt ? easeOut(t / peakAt) : 1 - easeOut((t - peakAt) / (1 - peakAt))
}

export function waveOpacity(elapsed: number, delay: number): number {
  'worklet'
  if (delay === NO_PULSE) return 0
  return WAVE_PEAK_OPACITY * keyframe((elapsed - delay) / WAVE_MS, WAVE_PEAK_AT)
}

export function popScale(elapsed: number, delay: number): number {
  'worklet'
  if (delay === NO_PULSE) return 1
  return 1 + (POP_SCALE - 1) * keyframe((elapsed - delay) / POP_MS, POP_PEAK_AT)
}
