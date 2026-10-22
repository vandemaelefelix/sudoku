import { HINT_MESSAGE_IDS, HINT_TECHNIQUE_IDS, type HintMessage, type HintPart, type HintValue } from '@sudoku/core'
import { createAppIntl } from '@/i18n/utils/intl.utils'
import { cellName, cellsName, hintText, listOf, techniqueExplanation, unitName } from './hintText.utils'

const en = createAppIntl('en')
const nl = createAppIntl('nl', 'nl-BE')

const cell = (index: number): HintPart => ({ kind: 'cell', cell: index })
const cells = (indexes: number[]): HintPart => ({ kind: 'cells', cells: indexes })
const unit = (index: number): HintPart => ({ kind: 'unit', unit: index })
const units = (indexes: number[]): HintPart => ({ kind: 'units', units: indexes })
const cellsIn = (within: number, indexes: number[]): HintPart => ({ kind: 'cellsIn', unit: within, cells: indexes })
const lines = (indexes: number[]): HintPart => ({ kind: 'lines', units: indexes })
const digits = (list: number[], joiner: 'and' | 'or' = 'and'): HintPart => ({ kind: 'digits', digits: list, joiner })
const message = (id: HintMessage['id'], values: Record<string, HintValue> = {}): HintMessage => ({ id, values })
const at = (row: number, column: number): number => row * 9 + column

describe('the parts', () => {
  it('names a cell in plain words', () => {
    expect(cellName(en, 0)).toBe('row 1, column 1')
    expect(cellName(en, 35)).toBe('row 4, column 9')
    expect(cellName(nl, 35)).toBe('rij 4, kolom 9')
  })

  it('names a row, a column and each box by its place', () => {
    expect(unitName(en, 1)).toBe('row 2')
    expect(unitName(en, 13)).toBe('column 5')
    expect([18, 19, 20, 21, 22, 23, 24, 25, 26].map((box) => unitName(en, box))).toEqual([
      'the top-left box',
      'the top-middle box',
      'the top-right box',
      'the middle-left box',
      'the centre box',
      'the middle-right box',
      'the bottom-left box',
      'the bottom-middle box',
      'the bottom-right box',
    ])
    expect([18, 22, 26].map((box) => unitName(nl, box))).toEqual([
      'het blok linksboven',
      'het middelste blok',
      'het blok rechtsonder',
    ])
  })

  it('lists items and cells', () => {
    expect(listOf(en, [3])).toBe('3')
    expect(listOf(en, [3, 7])).toBe('3 and 7')
    expect(listOf(en, [2, 5, 8])).toBe('2, 5 and 8')
    expect(listOf(nl, [2, 5, 8], 'or')).toBe('2, 5 of 8')
    expect(cellsName(en, [9, 13])).toBe('row 2, columns 1 and 5')
    expect(cellsName(en, [2, 29])).toBe('column 3, rows 1 and 4')
    expect(cellsName(en, [0, 10, 20])).toBe('row 1, column 1; row 2, column 2 and row 3, column 3')
    expect(cellsName(nl, [9, 13])).toBe('rij 2, kolommen 1 en 5')
  })
})

describe('hintText in English', () => {
  it.each<[HintMessage, string]>([
    [message('hint.fullHouse.look', { unit: unit(0) }), 'Look at row 1. It has one empty cell.'],
    [
      message('hint.fullHouse.why', { unit: unit(0), digit: 4 }),
      'Row 1 holds every digit but 4. So 4 goes in its empty cell.',
    ],
    [message('hint.put', { cell: cell(2), digit: 4 }), 'Put 4 in row 1, column 3.'],
    [message('hint.look.unit', { unit: unit(18) }), 'Look at the top-left box.'],
    [
      message('hint.hiddenSingle.why', { unit: unit(18), cell: cell(20), digit: 1 }),
      'In the top-left box, a 1 fits only in row 3, column 3. Every other empty cell has a 1 in its row, column or box.',
    ],
    [
      message('hint.hiddenSingle.whyLater', { unit: unit(18), cell: cell(20), digit: 1 }),
      'In the top-left box, a 1 fits only in row 3, column 3. Every other empty cell has a 1 in its row, column or box, or an earlier step removed it.',
    ],
    [message('hint.look.cell', { cell: cell(80) }), 'Look at row 9, column 9.'],
    [message('hint.nakedSingle.why', { digit: 9 }), 'Its row, column and box hold every digit but 9. So only 9 fits.'],
    [
      message('hint.nakedSingle.whyLater', { digit: 9 }),
      'Its row, column and box hold the other digits, or earlier steps removed them. So only 9 fits.',
    ],
    [message('hint.look.digitIn', { digit: 5, place: unit(18) }), 'Look where a 5 fits in the top-left box.'],
    [message('hint.look.digitIn', { digit: 8, place: unit(18) }), 'Look where an 8 fits in the top-left box.'],
    [
      message('hint.pointing.why', { unit: unit(18), digit: 5, second: unit(0) }),
      'In the top-left box, a 5 fits only in row 1. So the 5 of row 1 must be in this box.',
    ],
    [
      message('hint.removeOutside', { digit: 5, from: unit(0), outside: unit(18) }),
      'Remove 5 from row 1, outside the top-left box.',
    ],
    [
      message('hint.boxLine.why', { unit: unit(9), digit: 7, second: unit(18) }),
      'In column 1, a 7 fits only in the top-left box. So the 7 of the top-left box must be in column 1.',
    ],
    [
      message('hint.nakedPair.why', { unit: unit(0), cells: cellsIn(0, [0, 1]), digits: digits([3, 7]) }),
      'In row 1, columns 1 and 2 can hold only 3 and 7. So these two digits must go in these two cells.',
    ],
    [
      message('hint.nakedSubset.answer', { digits: digits([3, 7]), units: units([0, 18]) }),
      'Remove 3 and 7 from the other cells of row 1 and the top-left box.',
    ],
    [
      message('hint.nakedTriple.why', { unit: unit(9), cells: cellsIn(9, [0, 9, 18]), digits: digits([2, 5, 8]) }),
      'In column 1, rows 1, 2 and 3 can hold only 2, 5 and 8 between them. So these three digits must go in these three cells.',
    ],
    [
      message('hint.hiddenPair.why', { unit: unit(18), digits: digits([3, 7]), cells: cellsIn(18, [0, 10]) }),
      'In the top-left box, 3 and 7 fit only in row 1, column 1 and row 2, column 2. So these two cells can hold no other digit.',
    ],
    [
      message('hint.hiddenSubset.answer', { digits: digits([2, 9]), cells: cells([0, 10]) }),
      'Remove 2 and 9 from row 1, column 1 and row 2, column 2.',
    ],
    [
      message('hint.hiddenTriple.why', { unit: unit(4), digits: digits([1, 4, 6]), cells: cellsIn(4, [36, 40, 44]) }),
      'In row 5, 1, 4 and 6 fit only in columns 1, 5 and 9. So these three cells can hold no other digit.',
    ],
    [
      message('hint.hiddenSubset.answer', { digits: digits([1, 2, 3, 4, 5]), cells: cells([17, 35, 53, 71]) }),
      'Remove 1, 2, 3, 4 and 5 from column 9, rows 2, 4, 6 and 8.',
    ],
    [message('hint.mistake', { cell: cell(35) }), 'Row 4, column 9 holds a wrong digit. Erase it first.'],
    [
      message('hint.fallback', { digit: 4, cell: cell(2) }),
      'No hint technique fits this board. Put 4 in row 1, column 3, the cell with the fewest possible digits.',
    ],
    [
      message('hint.fish.why', { digit: 5, bases: lines([0, 4]), covers: lines([11, 15]) }),
      'In rows 1 and 5, a 5 fits only in columns 3 and 7. So columns 3 and 7 must hold their 5s in rows 1 and 5.',
    ],
    [
      message('hint.fish.why', { digit: 8, bases: lines([10, 14]), covers: lines([2, 7]) }),
      'In columns 2 and 6, an 8 fits only in rows 3 and 8. So rows 3 and 8 must hold their 8s in columns 2 and 6.',
    ],
    [message('hint.look.digitIn', { digit: 5, place: lines([0, 4, 8]) }), 'Look where a 5 fits in rows 1, 5 and 9.'],
    [
      message('hint.linkedPair.why', {
        lines: lines([1, 6]),
        digit: 1,
        joint: unit(11),
        a: cell(at(1, 6)),
        b: cell(at(6, 7)),
      }),
      'Rows 2 and 7 each have only two cells for a 1, and both have one in column 3. At most one of those holds the 1, so row 2, column 7 or row 7, column 8 holds it.',
    ],
    [
      message('hint.removeSeeingBoth', { digit: 1, a: cell(at(1, 6)), b: cell(at(6, 7)) }),
      'Remove 1 from the cells that share a row, column or box with both row 2, column 7 and row 7, column 8.',
    ],
    [message('hint.look.digitIn', { digit: 1, place: units([1, 11]) }), 'Look where a 1 fits in row 2 and column 3.'],
    [
      message('hint.linkedPair.why', {
        lines: units([1, 11]),
        digit: 1,
        joint: unit(18),
        a: cell(at(1, 5)),
        b: cell(at(7, 2)),
      }),
      'Row 2 and column 3 each have only two cells for a 1, and both have one in the top-left box. At most one of those holds the 1, so row 2, column 6 or row 8, column 3 holds it.',
    ],
    [
      message('hint.wWing.why', {
        link: unit(19),
        linked: 1,
        ends: cellsIn(19, [3, 22]),
        a: cell(0),
        b: cell(40),
        removed: 2,
      }),
      'In the top-middle box, a 1 fits only in row 1, column 4 and row 3, column 5, so one of them holds it. That cell rules out 1 in row 1, column 1 or in row 5, column 5, so one of these holds 2.',
    ],
    [message('hint.xyWing.look', { cell: cell(0) }), 'Look at row 1, column 1. It has only two digits.'],
    [
      message('hint.xyWing.why', { pivot: cell(0), digits: digits([1, 2], 'or'), shared: 3, a: cell(3), b: cell(18) }),
      'Row 1, column 1 holds 1 or 2. Each choice puts a 3 in row 1, column 4 or row 3, column 1.',
    ],
    [
      message('hint.xyzWing.why', {
        pivot: cell(0),
        digits: digits([1, 2, 3], 'or'),
        shared: 3,
        a: cell(1),
        b: cell(9),
      }),
      'Row 1, column 1 holds 1, 2 or 3. Each choice puts a 3 in this cell, in row 1, column 2 or in row 2, column 1.',
    ],
    [
      message('hint.removeSeeingAll', { digit: 3 }),
      'Remove 3 from the cells that share a row, column or box with all three of these cells.',
    ],
    [
      message('hint.wWing.look', { a: cell(0), b: cell(13) }),
      'Look at row 1, column 1 and row 2, column 5. They hold the same two digits.',
    ],
  ])('writes %j as "%s"', (hint, text) => {
    expect(hintText(en, hint)).toBe(text)
  })

  it('names the technique and its definition at rung 2', () => {
    expect(hintText(en, { id: 'hint.technique', values: {}, technique: 'fullHouse' })).toBe(
      'Full house: a row, column or box with one empty cell. That cell gets the missing digit.',
    )
  })
})

describe('hintText in Dutch', () => {
  it('writes the hint in Dutch, with its own lists and article', () => {
    expect(hintText(nl, message('hint.fullHouse.why', { unit: unit(0), digit: 4 }))).toBe(
      'Rij 1 bevat elk cijfer behalve 4. Dus komt 4 in het lege vakje.',
    )
    expect(hintText(nl, message('hint.look.digitIn', { digit: 8, place: unit(18) }))).toBe(
      'Bekijk waar een 8 past in het blok linksboven.',
    )
    expect(
      hintText(nl, message('hint.nakedPair.why', { unit: unit(0), cells: cellsIn(0, [0, 1]), digits: digits([3, 7]) })),
    ).toBe('In rij 1 kunnen kolommen 1 en 2 alleen 3 en 7 bevatten. Deze twee cijfers moeten dus in deze twee vakjes.')
    expect(hintText(nl, { id: 'hint.technique', values: {}, technique: 'nakedSingle' })).toBe(
      'Naakte single: een vakje waar maar één cijfer in past.',
    )
  })
})

describe('the hint text of every message', () => {
  // A sample value for each argument name, so each message can be written.
  const SAMPLE: Record<string, HintValue> = {
    cell: cell(35),
    cells: cellsIn(0, [0, 1]),
    unit: unit(18),
    units: units([0, 18]),
    digit: 5,
    digits: digits([3, 7]),
    place: unit(18),
    second: unit(0),
    from: unit(0),
    outside: unit(18),
    a: cell(3),
    b: cell(18),
    bases: lines([0, 4]),
    covers: lines([11, 15]),
    lines: lines([1, 6]),
    joint: unit(11),
    pivot: cell(0),
    shared: 3,
    link: unit(19),
    linked: 1,
    ends: cellsIn(19, [3, 22]),
    removed: 2,
  }

  it.each(['en', 'nl'] as const)('keeps every hint and every definition to two short sentences in %s', (language) => {
    const intl = createAppIntl(language)
    const texts = [
      ...HINT_MESSAGE_IDS.filter((id) => id !== 'hint.technique').map((id) => hintText(intl, message(id, SAMPLE))),
      ...HINT_TECHNIQUE_IDS.map((technique) => hintText(intl, { id: 'hint.technique', values: {}, technique })),
    ]
    for (const text of texts) {
      expect(text).not.toMatch(/r\dc\d/)
      expect([text, text.split(/\.(?: |$)/).filter(Boolean).length <= 2]).toEqual([text, true])
      const long = text.split(/[.:]/).filter((sentence) => sentence.trim().split(/\s+/).length > 25)
      expect([text, long]).toEqual([text, []])
    }
  })

  it.each(['en', 'nl'] as const)('explains each technique in at most 4 short sentences in %s', (language) => {
    const intl = createAppIntl(language)
    for (const technique of HINT_TECHNIQUE_IDS) {
      const sentences = techniqueExplanation(intl, technique).split(/(?<=\.)\s+/)
      expect([technique, sentences.length <= 4]).toEqual([technique, true])
      for (const sentence of sentences) expect([sentence, sentence.split(/\s+/).length <= 25]).toEqual([sentence, true])
    }
  })
})
