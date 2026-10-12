import type { Digit } from '@sudoku/core'
import {
  NO_PULSE,
  POP_MS,
  POP_PEAK_AT,
  POP_SCALE,
  PULSE_STEP_MS,
  SOLVE_PULSE_MS,
  WAVE_MS,
  WAVE_PEAK_AT,
  WAVE_PEAK_OPACITY,
} from '@/game/constants/pulse.constants'
import { SHARED_MOTION } from '@/theme/shared.tokens'
import { popScale, pulseDelays, pulseDuration, waveOpacity } from './pulse.utils'
import { sampleStart } from './sample.utils'
import { reduceSession, startSession, type Session } from './session.utils'

// Cell 2 (row 0, column 2) is empty in the canvas puzzle. Its solution is 4.
const LAST = 2
const sample = sampleStart()

/** A session whose entries are the solution on the cells that keep(cell) accepts. */
function startWith(keep: (cell: number) => boolean): Session {
  const entries = sample.solution.map((value, cell) => (sample.givens[cell] === 0 && keep(cell) ? value : 0))
  return startSession({ ...sample, entries })
}

function play(session: Session, cell: number, digit: Digit): Session {
  return [{ type: 'select', cell } as const, { type: 'digit', digit } as const].reduce(reduceSession, session)
}

const pulsed = (delays: readonly number[] | null) =>
  (delays ?? []).flatMap((delay, cell) => (delay === NO_PULSE ? [] : [cell]))

it('keeps the motion values of the theme', () => {
  expect(PULSE_STEP_MS).toBe(SHARED_MOTION.pulseStep)
  expect(WAVE_MS).toBe(SHARED_MOTION.long)
})

it('pulses the completed row out from the cell, one step per cell', () => {
  const after = play(
    startWith((cell) => cell < 9 && cell !== LAST),
    LAST,
    4,
  )
  const delays = pulseDelays(after.board, after.move)
  expect(pulsed(delays)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  expect(delays?.slice(0, 9)).toEqual([2, 1, 0, 1, 2, 3, 4, 5, 6].map((steps) => steps * PULSE_STEP_MS))
})

it('pulses the nine copies of a complete number and not a wrong copy', () => {
  const fours = (cell: number) => sample.solution[cell] === 4 && cell !== LAST
  const wrongCell = sample.givens.findIndex((given, cell) => given === 0 && sample.solution[cell] !== 4)
  const entries = sample.solution.map((value, cell) => {
    if (cell === wrongCell) return 4
    return sample.givens[cell] === 0 && fours(cell) ? value : 0
  })
  const after = play(startSession({ ...sample, entries }), LAST, 4)
  const delays = pulseDelays(after.board, after.move)
  const fourCells = sample.solution.flatMap((value, cell) => (value === 4 ? [cell] : []))
  expect(pulsed(delays)).toEqual(fourCells)
  expect(delays?.[wrongCell]).toBe(NO_PULSE)
})

it('pulses every cell when the last correct number solves the grid', () => {
  const after = play(
    startWith((cell) => cell !== LAST),
    LAST,
    4,
  )
  const delays = pulseDelays(after.board, after.move)
  expect(pulsed(delays)).toHaveLength(81)
  // Row 8, column 8 is the farthest cell from row 0, column 2: 8 + 6 steps.
  expect(Math.max(...(delays ?? []))).toBe(14 * PULSE_STEP_MS)
})

it('gives no pulse to a move that completes nothing, and to no move', () => {
  const after = play(
    startWith(() => false),
    LAST,
    4,
  )
  expect(pulseDelays(after.board, after.move)).toBeNull()
  expect(pulseDelays(after.board, null)).toBeNull()
})

it('ends the pulse when the last wave ends', () => {
  expect(pulseDuration([NO_PULSE, 0, 3 * PULSE_STEP_MS])).toBe(3 * PULSE_STEP_MS + WAVE_MS)
})

it('waits long enough for a solve pulse from any cell', () => {
  // A corner is 16 steps from the opposite corner.
  expect(SOLVE_PULSE_MS).toBe(16 * PULSE_STEP_MS + WAVE_MS)
})

it('raises the wave to its peak, then lets it fade, after the delay of the cell', () => {
  const delay = 90
  expect(waveOpacity(delay, delay)).toBe(0)
  expect(waveOpacity(delay + WAVE_MS * WAVE_PEAK_AT, delay)).toBeCloseTo(WAVE_PEAK_OPACITY)
  expect(waveOpacity(delay + WAVE_MS * 0.7, delay)).toBeGreaterThan(0)
  expect(waveOpacity(delay + WAVE_MS * 0.7, delay)).toBeLessThan(WAVE_PEAK_OPACITY)
  expect(waveOpacity(delay + WAVE_MS, delay)).toBe(0)
  expect(waveOpacity(0, delay)).toBe(0)
})

it('pops the digit to its peak scale and back', () => {
  expect(popScale(0, 0)).toBe(1)
  expect(popScale(POP_MS * POP_PEAK_AT, 0)).toBeCloseTo(POP_SCALE)
  expect(popScale(POP_MS, 0)).toBe(1)
})

it('leaves a cell outside the pulse still', () => {
  expect(waveOpacity(WAVE_MS * WAVE_PEAK_AT, NO_PULSE)).toBe(0)
  expect(popScale(POP_MS * POP_PEAK_AT, NO_PULSE)).toBe(1)
})
