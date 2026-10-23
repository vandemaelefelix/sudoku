import { useState } from 'react'
import type { SaveState } from '@/scan/components/DevMenu'
import type { CaptureOk } from '@/scan/utils/captureResult.utils'
import type { CellLook } from '@/scan/utils/correction.utils'
import { finalGrid } from '@/scan/utils/finalGrid.utils'
import type { FinalGrid } from '@/utils/finalGrid.utils'

/**
 * The save of the corrections, for the dev menu. canSave: the parent gave onSave and the scan kept its photo file.
 * save does nothing unless canSave, and while a save runs.
 */
export function useSaveState(
  ok: CaptureOk | null,
  looks: readonly CellLook[],
  onSave: ((grid: FinalGrid) => Promise<boolean>) | undefined,
): { saveState: SaveState; canSave: boolean; save(): void } {
  // A new edit makes the saved copy old, so Save works again: the status counts only for the looks that it was made for.
  const [saving, setSaving] = useState<{ looks: readonly CellLook[]; status: Exclude<SaveState, 'idle'> } | null>(null)
  const saveState: SaveState = saving !== null && saving.looks === looks ? saving.status : 'idle'
  const canSave = onSave !== undefined && ok?.photoPath != null
  const save = () => {
    if (onSave === undefined || ok === null || saveState === 'saving') return
    const final = finalGrid(ok.cells, looks)
    setSaving({ looks, status: 'saving' })
    void onSave(final).then((saved) => setSaving({ looks, status: saved ? 'saved' : 'failed' }))
  }
  return { saveState, canSave, save }
}
