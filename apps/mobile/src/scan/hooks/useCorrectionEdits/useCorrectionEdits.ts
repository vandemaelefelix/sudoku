import { useMemo, useState } from 'react'
import type { Digit } from '@sudoku/core'
import type { RecogniseResult } from '@/scanner'
import { cellLook, cellsToCheck, type CellLook } from '@/scan/utils/correction.utils'
import {
  clearCell,
  correctedGrid,
  deselect,
  givenConflicts,
  selectCell,
  setDigit,
  setKind,
  startEdits,
  type CorrectedGrid,
  type CorrectionEdits,
  type EntryKind,
} from '@/scan/utils/correctionEdit.utils'

export type CorrectionEditActions = {
  select(cell: number): void
  deselect(): void
  setDigit(digit: Digit): void
  clear(): void
  setKind(kind: EntryKind): void
}

export type CorrectionEditState = {
  looks: readonly CellLook[]
  selected: number | null
  conflicts: readonly boolean[]
  toCheck: number
  grid: CorrectedGrid
  actions: CorrectionEditActions
}

type Own = { base: CorrectionEdits; edits: CorrectionEdits }

/** The edits of the correction screen. They copy the looks of the result and never change the result. */
export function useCorrectionEdits(result: RecogniseResult | null): CorrectionEditState {
  const base = useMemo(() => startEdits(result?.ok ? result.cells.map(cellLook) : []), [result])
  const [own, setOwn] = useState<Own | null>(null)
  // The transition mounts the screen before the result arrives. Edits of an older result do not apply to a new one.
  const edits = own?.base === base ? own.edits : base

  const actions = useMemo<CorrectionEditActions>(() => {
    const update = (step: (from: CorrectionEdits) => CorrectionEdits) =>
      setOwn((previous) => ({ base, edits: step(previous?.base === base ? previous.edits : base) }))
    return {
      select: (cell) => update((from) => selectCell(from, cell)),
      deselect: () => update(deselect),
      setDigit: (digit) => update((from) => setDigit(from, digit)),
      clear: () => update(clearCell),
      setKind: (kind) => update((from) => setKind(from, kind)),
    }
  }, [base])

  const { looks, selected } = edits
  const conflicts = useMemo(() => givenConflicts(looks), [looks])
  const grid = useMemo(() => correctedGrid(looks), [looks])
  return { looks, selected, conflicts, toCheck: cellsToCheck(looks), grid, actions }
}
