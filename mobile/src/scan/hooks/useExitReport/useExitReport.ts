import { useCallback, useEffect, useRef } from 'react'
import type { CaptureOk } from '@/scan/utils/captureResult.utils'
import type { CellLook } from '@/scan/utils/correction.utils'
import { finalGrid } from '@/scan/utils/finalGrid.utils'
import type { FinalGrid } from '@/utils/finalGrid.utils'

/**
 * Reports the final grid to onExit when the screen unmounts, but only after the player could edit it. It reports the latest looks.
 * Returns skip: call it before a retake, so the unmount that follows does not report a scan that the player did not accept.
 */
export function useExitReport({
  ok,
  looks,
  editable,
  onExit,
}: {
  ok: CaptureOk | null
  looks: readonly CellLook[]
  editable: boolean
  onExit: ((grid: FinalGrid) => void) | undefined
}): { skip(): void } {
  // The unmount reads the latest values, because the effect that listens for it runs once.
  const latest = useRef({ ok, looks, editable, onExit })
  useEffect(() => {
    latest.current = { ok, looks, editable, onExit }
  })
  const skipped = useRef(false)
  useEffect(
    () => () => {
      const { ok: last, looks: finalLooks, editable: could, onExit: report } = latest.current
      if (could && !skipped.current && last !== null) report?.(finalGrid(last.cells, finalLooks))
    },
    [],
  )
  const skip = useCallback(() => {
    skipped.current = true
  }, [])
  return { skip }
}
