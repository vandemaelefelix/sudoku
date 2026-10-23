import type { Formatter } from '@/i18n/utils/intl.utils'
import type { CellView } from './cell.utils'
import { columnOf, rowOf } from '@/utils/grid.utils'

/** The VoiceOver label of a cell, for example "Row 5, column 5, empty, notes 3 5". */
export function cellLabel(
  intl: Formatter,
  cell: number,
  view: Pick<CellView, 'digit' | 'digitStyle' | 'notes'>,
): string {
  const place = intl.formatMessage({ id: 'cell.place' }, { row: rowOf(cell) + 1, column: columnOf(cell) + 1 })
  if (view.digit !== 0) {
    const id = view.digitStyle === 'given' ? 'cell.given' : view.digitStyle === 'wrong' ? 'cell.wrong' : 'cell.entry'
    return intl.formatMessage({ id }, { place, digit: view.digit })
  }
  if (view.notes === '') return intl.formatMessage({ id: 'cell.empty' }, { place })
  return intl.formatMessage({ id: 'cell.notes' }, { place, notes: [...view.notes].join(' ') })
}
