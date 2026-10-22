import { COL_OF, ROW_OF, unitKindOf } from '../units'

const BOX_PLACES = [
  'top-left',
  'top-middle',
  'top-right',
  'middle-left',
  'centre',
  'middle-right',
  'bottom-left',
  'bottom-middle',
  'bottom-right',
]

/** "row 4, column 9". ADR-032 point 10: never "r4c9". */
export function cellName(cell: number): string {
  return `row ${ROW_OF[cell]! + 1}, column ${COL_OF[cell]! + 1}`
}

/** "row 2", "column 5" or "the top-left box". */
export function unitName(unit: number): string {
  switch (unitKindOf(unit)) {
    case 'row':
      return `row ${unit + 1}`
    case 'column':
      return `column ${unit - 8}`
    case 'box':
      return `the ${BOX_PLACES[unit - 18]} box`
  }
}

/** "a", "a and b", "a, b and c". With `or`: "a, b or c". */
export function listOf(items: readonly (string | number)[], joiner: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`
}

/**
 * Cells of one row read "row 2, columns 1 and 5". Cells of one column read "column 3, rows 1 and 4".
 * Other cells take a semicolon between names, because each name holds a comma.
 */
export function cellsName(cells: readonly number[]): string {
  if (cells.length === 1) return cellName(cells[0]!)
  const rows = cells.map((cell) => ROW_OF[cell]! + 1)
  const columns = cells.map((cell) => COL_OF[cell]! + 1)
  if (rows.every((row) => row === rows[0])) return `row ${rows[0]}, columns ${listOf(columns)}`
  if (columns.every((column) => column === columns[0])) return `column ${columns[0]}, rows ${listOf(rows)}`
  const names = cells.map(cellName)
  return `${names.slice(0, -1).join('; ')} and ${names.at(-1)}`
}

/** The cells of `unit`, without the name of the unit itself: "columns 1 and 5" in a row. */
export function cellsIn(unit: number, cells: readonly number[]): string {
  switch (unitKindOf(unit)) {
    case 'row':
      return `column${cells.length > 1 ? 's' : ''} ${listOf(cells.map((cell) => COL_OF[cell]! + 1))}`
    case 'column':
      return `row${cells.length > 1 ? 's' : ''} ${listOf(cells.map((cell) => ROW_OF[cell]! + 1))}`
    case 'box':
      return cellsName(cells)
  }
}

/** Rows read "rows 2 and 7", columns read "columns 1, 4 and 8". Other units are listed by name. */
export function linesName(units: readonly number[]): string {
  if (units.length > 1 && units.every((unit) => unitKindOf(unit) === 'row')) {
    return `rows ${listOf(units.map((unit) => unit + 1))}`
  }
  if (units.length > 1 && units.every((unit) => unitKindOf(unit) === 'column')) {
    return `columns ${listOf(units.map((unit) => unit - 8))}`
  }
  return listOf(units.map(unitName))
}

/** "a 5", but "an 8". */
export function aDigit(digit: number): string {
  return `${digit === 8 ? 'an' : 'a'} ${digit}`
}

export function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
