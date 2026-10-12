import type { CellView } from './cell.utils'

const CONTENT_PREFIX = { given: 'given ', entry: '', wrong: 'wrong ' } as const

/** The VoiceOver label of a cell, for example "Row 5, column 5, empty, notes 3 5". */
export function cellLabel(cell: number, view: CellView): string {
  const place = `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}`
  if (view.digit !== 0) return `${place}, ${CONTENT_PREFIX[view.digitStyle]}${view.digit}`
  if (view.notes === '') return `${place}, empty`
  return `${place}, empty, notes ${[...view.notes].join(' ')}`
}
