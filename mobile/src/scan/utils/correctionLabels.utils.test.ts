import { createAppIntl } from '@/i18n/utils/intl.utils'
import type { CellLook } from '@/scan/utils/correction.utils'
import { cellPlaceLabel, correctionCellLabel, panelQuestion, yesLabel } from './correctionLabels.utils'

const EMPTY: CellLook = { digit: '', style: 'empty', uncertain: false }
const given = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'given', uncertain })
const entry = (digit: number, uncertain = false): CellLook => ({ digit: String(digit), style: 'entry', uncertain })

const en = createAppIntl('en')
const nl = createAppIntl('nl')

describe('panel text', () => {
  it('asks about the read in the check state', () => {
    expect(panelQuestion(en, given(4, true), false)).toBe('Is this a 4?')
    expect(panelQuestion(en, { ...EMPTY, uncertain: true }, false)).toBe('Is this empty?')
    expect(yesLabel(en, given(4))).toBe('Yes, 4')
    expect(yesLabel(en, EMPTY)).toBe('Yes, empty')
  })

  it('asks for the digit in the pick state', () => {
    expect(panelQuestion(en, given(4, true), true)).toBe('What is it?')
    expect(panelQuestion(en, given(4), true)).toBe('Change this 4')
    expect(panelQuestion(en, EMPTY, true)).toBe('Fill this cell')
  })
})

describe('cellPlaceLabel', () => {
  it('says the row and the column, from 1', () => {
    expect(cellPlaceLabel(en, 0)).toBe('Row 1, column 1')
    expect(cellPlaceLabel(en, 23)).toBe('Row 3, column 6')
  })
})

describe('correctionCellLabel', () => {
  it('says the place, the kind and the digit', () => {
    expect(correctionCellLabel(en, 0, given(5), false)).toBe('Row 1, column 1, given 5')
    expect(correctionCellLabel(en, 10, entry(7), false)).toBe('Row 2, column 2, entry 7')
    expect(correctionCellLabel(en, 80, EMPTY, false)).toBe('Row 9, column 9, empty')
  })

  it('adds the conflict and the check', () => {
    expect(correctionCellLabel(en, 0, given(5, true), true)).toBe(
      'Row 1, column 1, given 5, same digit as another given, check this cell',
    )
  })
})

describe('the cell text in Dutch', () => {
  it('names the place, the kind and the questions in Dutch', () => {
    expect(cellPlaceLabel(nl, 23)).toBe('Rij 3, kolom 6')
    expect(correctionCellLabel(nl, 10, entry(7), false)).toBe('Rij 2, kolom 2, ingevuld cijfer 7')
    expect(panelQuestion(nl, given(4, true), false)).toBe('Is dit een 4?')
    expect(yesLabel(nl, EMPTY)).toBe('Ja, leeg')
  })
})
