import { cellLabel } from './cellLabel.utils'

const view = { digit: 0, digitStyle: 'entry', notes: '', fill: 'plain', ring: false } as const

it('reads the row, the column and the content of a cell', () => {
  expect(cellLabel(0, { ...view, digit: 5, digitStyle: 'given' })).toBe('Row 1, column 1, given 5')
  expect(cellLabel(40, { ...view, digit: 4 })).toBe('Row 5, column 5, 4')
  expect(cellLabel(80, { ...view, digit: 6, digitStyle: 'wrong' })).toBe('Row 9, column 9, wrong 6')
  expect(cellLabel(2, view)).toBe('Row 1, column 3, empty')
  expect(cellLabel(2, { ...view, notes: '35' })).toBe('Row 1, column 3, empty, notes 3 5')
})
