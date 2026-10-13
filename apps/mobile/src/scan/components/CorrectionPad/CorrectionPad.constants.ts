import type { Digit } from '@sudoku/core'

/** Five keys per row: 1 to 5, then 6 to 9 and Empty. */
export const PAD_ROWS: readonly (readonly Digit[])[] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9],
]
