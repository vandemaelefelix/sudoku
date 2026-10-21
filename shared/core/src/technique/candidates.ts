import { GRID_CELLS } from '../grid'
import { PEERS } from '../units'
import { ALL_DIGITS } from './masks'
import type { Candidates } from './types'

/**
 * The digits that can still go in each cell, from the givens and the entries only.
 * The notes of the player are not an input (ADR-032).
 * Throws a RangeError for a board that is not 81 integers from 0 to 9.
 */
export function computeCandidates(board: readonly number[]): Candidates {
  if (board.length !== GRID_CELLS) {
    throw new RangeError(`A board has ${GRID_CELLS} cells, not ${board.length}`)
  }
  for (let cell = 0; cell < GRID_CELLS; cell++) {
    const digit = board[cell]!
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new RangeError(`Cell ${cell} holds ${digit}, not an integer from 0 to 9`)
    }
  }
  const candidates = new Uint16Array(GRID_CELLS).fill(ALL_DIGITS)
  for (let cell = 0; cell < GRID_CELLS; cell++) {
    const digit = board[cell]!
    if (digit === 0) continue
    candidates[cell] = 0
    const bit = 1 << (digit - 1)
    for (const peer of PEERS[cell]!) candidates[peer]! &= ~bit
  }
  return candidates
}
