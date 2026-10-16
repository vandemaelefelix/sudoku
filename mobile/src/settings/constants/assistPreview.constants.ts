import type { Digit } from '@sudoku/core'

/** The entries of the canvas preview, as [cell, digit]. The 6 in cell 54 is wrong, so the preview shows a conflict. */
export const PREVIEW_ENTRIES: ReadonlyArray<readonly [cell: number, digit: Digit]> = [
  [2, 4],
  [3, 6],
  [5, 8],
  [10, 7],
  [18, 1],
  [28, 5],
  [37, 2],
  [54, 6],
]

/** Cell 39 holds a given 8, so the same-numbers assist has cells to shade. */
export const PREVIEW_SELECTED = 39
