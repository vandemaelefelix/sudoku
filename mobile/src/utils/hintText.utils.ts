import type { HintMessage, HintPart, HintTechniqueId, HintValue } from '@sudoku/core'
import type { MessageId } from '@/i18n/messages'
import type { Formatter } from '@/i18n/utils/intl.utils'
import { cellPlace } from '@/utils/grid.utils'

// The hint text of @sudoku/core comes as message ids with values (ADR-033, point 8). These helpers write each part from the
// catalogue, so each language builds its own cell names, lists and plurals.

const BOX_PLACES = [
  'hint.part.box.topLeft',
  'hint.part.box.topMiddle',
  'hint.part.box.topRight',
  'hint.part.box.middleLeft',
  'hint.part.box.centre',
  'hint.part.box.middleRight',
  'hint.part.box.bottomLeft',
  'hint.part.box.bottomMiddle',
  'hint.part.box.bottomRight',
] as const satisfies readonly MessageId[]

const rowNumber = (cell: number): number => cellPlace(cell).row
const columnNumber = (cell: number): number => cellPlace(cell).column

/** "row 4, column 9". ADR-032 point 10: never "r4c9". */
export function cellName(intl: Formatter, cell: number): string {
  return intl.formatMessage({ id: 'hint.part.cell' }, cellPlace(cell))
}

/** "row 2", "column 5" or "the top-left box". unit: 0-8 rows, 9-17 columns, 18-26 boxes. */
export function unitName(intl: Formatter, unit: number): string {
  if (unit < 9) return intl.formatMessage({ id: 'hint.part.row' }, { row: unit + 1 })
  if (unit < 18) return intl.formatMessage({ id: 'hint.part.column' }, { column: unit - 8 })
  return intl.formatMessage({ id: BOX_PLACES[unit - 18]! })
}

/** "a", "a and b", "a, b and c". With `or`: "a, b or c". separator: between the items before the last one. */
export function listOf(
  intl: Formatter,
  items: readonly (string | number)[],
  joiner: 'and' | 'or' = 'and',
  separator = ', ',
): string {
  if (items.length <= 1) return items.join('')
  return intl.formatMessage(
    { id: joiner === 'and' ? 'hint.part.and' : 'hint.part.or' },
    { items: items.slice(0, -1).join(separator), last: items.at(-1) },
  )
}

/**
 * Cells of one row read "row 2, columns 1 and 5". Cells of one column read "column 3, rows 1 and 4".
 * Other cells take a semicolon between names, because each name holds a comma.
 */
export function cellsName(intl: Formatter, cells: readonly number[]): string {
  if (cells.length === 1) return cellName(intl, cells[0]!)
  const rows = cells.map(rowNumber)
  const columns = cells.map(columnNumber)
  if (rows.every((row) => row === rows[0])) {
    return intl.formatMessage({ id: 'hint.part.rowCells' }, { row: rows[0], columns: listOf(intl, columns) })
  }
  if (columns.every((column) => column === columns[0])) {
    return intl.formatMessage({ id: 'hint.part.columnCells' }, { column: columns[0], rows: listOf(intl, rows) })
  }
  return listOf(
    intl,
    cells.map((cell) => cellName(intl, cell)),
    'and',
    '; ',
  )
}

/** The cells of `unit`, without the name of the unit itself: "columns 1 and 5" in a row. */
function cellsIn(intl: Formatter, unit: number, cells: readonly number[]): string {
  if (unit < 9) {
    return intl.formatMessage(
      { id: 'hint.part.columnsIn' },
      {
        count: cells.length,
        list: listOf(intl, cells.map(columnNumber)),
      },
    )
  }
  if (unit < 18) {
    return intl.formatMessage(
      { id: 'hint.part.rowsIn' },
      {
        count: cells.length,
        list: listOf(intl, cells.map(rowNumber)),
      },
    )
  }
  return cellsName(intl, cells)
}

/** Rows read "rows 2 and 7", columns read "columns 1, 4 and 8". Other units are listed by name. */
function linesName(intl: Formatter, units: readonly number[]): string {
  if (units.length > 1 && units.every((unit) => unit < 9)) {
    return intl.formatMessage(
      { id: 'hint.part.rows' },
      {
        list: listOf(
          intl,
          units.map((unit) => unit + 1),
        ),
      },
    )
  }
  if (units.length > 1 && units.every((unit) => unit >= 9 && unit < 18)) {
    return intl.formatMessage(
      { id: 'hint.part.columns' },
      {
        list: listOf(
          intl,
          units.map((unit) => unit - 8),
        ),
      },
    )
  }
  return listOf(
    intl,
    units.map((unit) => unitName(intl, unit)),
  )
}

function partText(intl: Formatter, part: HintPart): string {
  switch (part.kind) {
    case 'cell':
      return cellName(intl, part.cell)
    case 'cells':
      return cellsName(intl, part.cells)
    case 'unit':
      return unitName(intl, part.unit)
    case 'units':
      return listOf(
        intl,
        part.units.map((unit) => unitName(intl, unit)),
      )
    case 'cellsIn':
      return cellsIn(intl, part.unit, part.cells)
    case 'lines':
      return linesName(intl, part.units)
    case 'digits':
      return listOf(intl, part.digits, part.joiner)
  }
}

export function techniqueName(intl: Formatter, technique: HintTechniqueId): string {
  return intl.formatMessage({ id: `technique.${technique}.name` })
}

/** It follows the name and a colon in the hint card, so it starts in lower case. */
export function techniqueDefinition(intl: Formatter, technique: HintTechniqueId): string {
  return intl.formatMessage({ id: `technique.${technique}.definition` })
}

export function techniqueExplanation(intl: Formatter, technique: HintTechniqueId): string {
  return intl.formatMessage({ id: `technique.${technique}.explanation` })
}

export function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The card text of a hint message. A digit stays a number, so a message can pick its article from it ("a 5", "an 8"). A
 * sentence can start with a part, such as "Row 1 holds…", so the text starts with a capital.
 */
export function hintText(intl: Formatter, hint: HintMessage): string {
  const values: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(hint.values) as [string, HintValue][]) {
    values[name] = typeof value === 'number' ? value : partText(intl, value)
  }
  if (hint.technique !== undefined) {
    const technique = hint.technique as HintTechniqueId
    values.name = techniqueName(intl, technique)
    values.definition = techniqueDefinition(intl, technique)
  }
  return capitalised(intl.formatMessage({ id: hint.id }, values))
}
