import type { CellStyle } from '@/scan/utils/correction.utils'

/** The kinds that the dev menu lets the developer set, with the names of the labelling tool. */
export const KIND_LABELS: readonly { style: CellStyle; label: string }[] = [
  { style: 'given', label: 'Printed' },
  { style: 'entry', label: 'Handwritten' },
  { style: 'notes', label: 'Notes' },
  { style: 'empty', label: 'Empty' },
]

/** Milliseconds the question and the cell place take to fade in for the next cell. */
export const TEXT_FADE_MS = 180

/** The scale of the progress dot of the open cell. */
export const DOT_NOW_SCALE = 1.3
