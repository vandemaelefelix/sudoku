import { createEmptyGrid } from '../grid'
import type { Candidates } from './types'

/** An empty board with the given digits placed. The keys are cell indices. */
export function boardWith(placed: Readonly<Record<number, number>>): number[] {
  const board = createEmptyGrid()
  for (const [cell, digit] of Object.entries(placed)) board[Number(cell)] = digit
  return board
}

/** 81 characters, row by row. A dot or a 0 is an empty cell. */
export function boardFromString(text: string): number[] {
  return [...text].map((char) => (char === '.' ? 0 : Number(char)))
}

/** A copy of `candidates` without the given digits in the given cells. */
export function struck(candidates: Candidates, cells: readonly number[], digits: readonly number[]): Candidates {
  const copy = new Uint16Array(candidates)
  for (const cell of cells) for (const digit of digits) copy[cell]! &= ~(1 << (digit - 1))
  return copy
}

/** A copy of `candidates` where each cell holds exactly the given digits. */
export function withDigits(candidates: Candidates, edits: Readonly<Record<number, readonly number[]>>): Candidates {
  const copy = new Uint16Array(candidates)
  for (const [cell, digits] of Object.entries(edits)) {
    copy[Number(cell)] = digits.reduce((mask, digit) => mask | (1 << (digit - 1)), 0)
  }
  return copy
}
