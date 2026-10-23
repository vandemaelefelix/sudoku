import type { Formatter } from '@/i18n/utils/intl.utils'
import { cellPlace } from '@/utils/grid.utils'
import { hasDigit, type CellLook } from '@/scan/utils/correction.utils'

/** For example "Row 1, column 3". cell: the index, row-major. */
export function cellPlaceLabel(intl: Formatter, cell: number): string {
  return intl.formatMessage({ id: 'scan.cell.place' }, cellPlace(cell))
}

function kindWords(intl: Formatter, look: CellLook): string {
  if (hasDigit(look) && look.style === 'given')
    return intl.formatMessage({ id: 'scan.cell.given' }, { digit: look.digit })
  if (hasDigit(look) && look.style === 'entry')
    return intl.formatMessage({ id: 'scan.cell.entry' }, { digit: look.digit })
  return intl.formatMessage({ id: look.style === 'notes' ? 'scan.cell.notes' : 'scan.cell.empty' })
}

/** The VoiceOver label of a correction cell, for example "Row 1, column 3, entry 7, check this cell". */
export function correctionCellLabel(
  intl: Formatter,
  cell: number,
  look: CellLook,
  conflict: boolean,
  hint = '',
): string {
  const parts = [cellPlaceLabel(intl, cell), kindWords(intl, look)]
  if (hint !== '') parts.push(intl.formatMessage({ id: 'scan.cell.differs' }, { digit: hint }))
  else if (conflict) {
    parts.push(intl.formatMessage({ id: look.style === 'entry' ? 'scan.cell.sameAsCell' : 'scan.cell.sameAsGiven' }))
  }
  if (look.uncertain) parts.push(intl.formatMessage({ id: 'scan.cell.check' }))
  return parts.join(', ')
}

/** The question of the panel for an open cell, for example "Is this a 4?" in the check state. */
export function panelQuestion(intl: Formatter, look: CellLook, picking: boolean): string {
  if (look.uncertain && !picking) {
    return hasDigit(look)
      ? intl.formatMessage({ id: 'scan.question.isDigit' }, { digit: look.digit })
      : intl.formatMessage({ id: 'scan.question.isEmpty' })
  }
  if (look.uncertain) return intl.formatMessage({ id: 'scan.question.what' })
  return hasDigit(look)
    ? intl.formatMessage({ id: 'scan.question.change' }, { digit: look.digit })
    : intl.formatMessage({ id: 'scan.question.fill' })
}

/** The label of the Yes button, for example "Yes, 4". */
export function yesLabel(intl: Formatter, look: CellLook): string {
  return hasDigit(look)
    ? intl.formatMessage({ id: 'scan.check.yesDigit' }, { digit: look.digit })
    : intl.formatMessage({ id: 'scan.check.yesEmpty' })
}
