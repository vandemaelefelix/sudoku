import type { Digit } from '@sudoku/core'
import type { EntryKind } from '@/scan/utils/correctionEdit.utils'

/** The second row also holds Clear, so both rows have five keys of the same width. */
export const PAD_ROWS: readonly (readonly Digit[])[] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9],
]

export const KINDS: readonly { kind: EntryKind; label: string }[] = [
  { kind: 'given', label: 'Given' },
  { kind: 'entry', label: 'Entry' },
]
