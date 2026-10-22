import { createAppIntl } from '@/i18n/utils/intl.utils'
import { cellLabel } from './cellLabel.utils'

const en = createAppIntl('en')
const nl = createAppIntl('nl')

const view = { digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false } as const

it('reads the row, the column and the content of a cell', () => {
  expect(cellLabel(en, 0, { ...view, digit: 5, digitStyle: 'given' })).toBe('Row 1, column 1, given 5')
  expect(cellLabel(en, 40, { ...view, digit: 4 })).toBe('Row 5, column 5, 4')
  expect(cellLabel(en, 80, { ...view, digit: 6, digitStyle: 'wrong' })).toBe('Row 9, column 9, wrong 6')
  expect(cellLabel(en, 2, view)).toBe('Row 1, column 3, empty')
  expect(cellLabel(en, 2, { ...view, notes: '35' })).toBe('Row 1, column 3, empty, notes 3 5')
})

it('reads a cell in Dutch', () => {
  expect(cellLabel(nl, 0, { digit: 5, digitStyle: 'given', notes: '' })).toBe('Rij 1, kolom 1, gegeven cijfer 5')
  expect(cellLabel(nl, 80, { digit: 0, digitStyle: 'entry', notes: '35' })).toBe('Rij 9, kolom 9, leeg, notities 3 5')
})
