import { useMemo, useState } from 'react'
import type { Digit } from '@sudoku/core'
import type { RecogniseResult } from '@/scanner'
import { REVIEW_CONFIDENCE } from '@/scan/constants/correction.constants'
import { cellLook, type CellLook, type CellStyle } from '@/scan/utils/correction.utils'
import {
  answerNo,
  answerYes,
  clearCell,
  closeCell,
  correctedGrid,
  editedLooks,
  givenConflicts,
  NO_EDITS,
  selectCell,
  setDigit,
  setKind,
  startCheck,
  type CorrectedGrid,
  type CorrectionEdits,
} from '@/scan/utils/correctionEdit.utils'

export type CorrectionEditActions = {
  select(cell: number): void
  startCheck(): void
  close(): void
  yes(): void
  no(): void
  setDigit(digit: Digit): void
  clear(): void
  setKind(style: CellStyle): void
}

/**
 * looks: the 81 cells after the edits. selected and picking: see CorrectionEdits. toCheck: the cells that still have a ring.
 * flow: the cells the scanner was unsure of, in reading order, for the progress dots of the check state.
 */
export type CorrectionEditState = {
  looks: readonly CellLook[]
  selected: number | null
  picking: boolean
  conflicts: readonly boolean[]
  toCheck: number
  flow: readonly number[]
  grid: CorrectedGrid
  actions: CorrectionEditActions
}

type Own = { result: RecogniseResult | null; edits: CorrectionEdits }

/**
 * The edits of the correction screen. They copy the looks of the result and never change the result.
 * threshold: the ring threshold. A new threshold moves the rings and keeps the edits.
 */
export function useCorrectionEdits(
  result: RecogniseResult | null,
  threshold: number = REVIEW_CONFIDENCE,
): CorrectionEditState {
  const base = useMemo(
    () => (result?.ok ? result.cells.map((cell) => cellLook(cell, threshold)) : []),
    [result, threshold],
  )
  const [own, setOwn] = useState<Own | null>(null)
  // The transition mounts the screen before the result arrives. Edits of an older result do not apply to a new one.
  const edits = own?.result === result ? own.edits : NO_EDITS

  const actions = useMemo<CorrectionEditActions>(() => {
    const update = (step: (from: CorrectionEdits) => CorrectionEdits) =>
      setOwn((previous) => ({ result, edits: step(previous?.result === result ? previous.edits : NO_EDITS) }))
    return {
      select: (cell) => update((from) => selectCell(base, from, cell)),
      startCheck: () => update((from) => startCheck(base, from)),
      close: () => update(closeCell),
      yes: () => update((from) => answerYes(base, from)),
      no: () => update(answerNo),
      setDigit: (digit) => update((from) => setDigit(base, from, digit)),
      clear: () => update((from) => clearCell(base, from)),
      setKind: (style) => update((from) => setKind(base, from, style)),
    }
  }, [base, result])

  // Only the cell edits change the looks: opening or closing a cell keeps the same 81 looks, so no memo cell re-renders.
  const { overrides, checked } = edits
  const looks = useMemo(() => editedLooks(base, { ...NO_EDITS, overrides, checked }), [base, overrides, checked])
  const conflicts = useMemo(() => givenConflicts(looks), [looks])
  const grid = useMemo(() => correctedGrid(looks), [looks])
  const flow = useMemo(() => base.flatMap((look, cell) => (look.uncertain ? [cell] : [])), [base])
  return {
    looks,
    selected: edits.selected,
    picking: edits.picking,
    conflicts,
    toCheck: looks.filter((look) => look.uncertain).length,
    flow,
    grid,
    actions,
  }
}
