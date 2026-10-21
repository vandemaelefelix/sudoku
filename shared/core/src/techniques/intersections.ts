import {
  BOX_UNITS,
  boxOf,
  cellsWith,
  COLUMN_UNITS,
  columnOf,
  DIGITS,
  makeStep,
  ROW_UNITS,
  rowOf,
  type Unit,
} from './scan'
import type { CandidateState, Technique, TechniqueId } from './types'

/**
 * Looks in each source unit for a digit with two or more cells that all lie in one target unit.
 * The digit then leaves the other cells of the target.
 */
function lockedCandidates(
  id: TechniqueId,
  state: CandidateState,
  sources: readonly Unit[],
  targetsOf: (cells: readonly number[]) => Unit[],
) {
  for (const source of sources) {
    for (const digit of DIGITS) {
      const cells = cellsWith(state, source.cells, digit)
      if (cells.length < 2) continue
      for (const target of targetsOf(cells)) {
        const eliminations = cellsWith(state, target.cells, digit)
          .filter((cell) => !cells.includes(cell))
          .map((cell) => ({ cell, digit }))
        if (eliminations.length === 0) continue
        return makeStep(id, { eliminations, units: [source.ref, target.ref], cells, digits: [digit] })
      }
    }
  }
  return null
}

const allSame = (cells: readonly number[], key: (cell: number) => number): boolean =>
  cells.every((cell) => key(cell) === key(cells[0]!))

export const pointing: Technique = {
  id: 'pointing',
  find: (state) =>
    lockedCandidates('pointing', state, BOX_UNITS, (cells) => [
      ...(allSame(cells, rowOf) ? [ROW_UNITS[rowOf(cells[0]!)]!] : []),
      ...(allSame(cells, columnOf) ? [COLUMN_UNITS[columnOf(cells[0]!)]!] : []),
    ]),
}

export const claiming: Technique = {
  id: 'claiming',
  find: (state) =>
    lockedCandidates('claiming', state, [...ROW_UNITS, ...COLUMN_UNITS], (cells) =>
      allSame(cells, boxOf) ? [BOX_UNITS[boxOf(cells[0]!)]!] : [],
    ),
}
