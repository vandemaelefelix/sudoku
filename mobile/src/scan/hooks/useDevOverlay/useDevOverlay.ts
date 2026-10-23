import { useMemo, useState } from 'react'
import type { CellConfidence } from '@/scan/components/CorrectionCell'
import type { CaptureOk } from '@/scan/utils/captureResult.utils'
import { cellLook, type CellLook } from '@/scan/utils/correction.utils'
import type { InspectorView } from '@/scan/utils/inspector.utils'
import { KIND_TAG } from './useDevOverlay.constants'

/**
 * The state of the dev menu. It belongs to the screen: these switches change what the screen draws, never the scan.
 * devTools: development builds, after the transition. confidences: the overlay of the cells, or null while it is off.
 */
export function useDevOverlay({
  editable,
  scan,
  looks,
  threshold,
}: {
  editable: boolean
  scan: CaptureOk | null
  looks: readonly CellLook[]
  threshold: number
}) {
  const devTools = __DEV__ && editable
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<InspectorView>('photo')
  const [labelKinds, setLabelKinds] = useState(false)
  const [showConfidence, setShowConfidence] = useState(false)

  const confidences = useMemo<(CellConfidence | null)[] | null>(() => {
    if (!devTools || !showConfidence || scan === null) return null
    return looks.map((look, n) => {
      const read = scan.cells[n]
      if (read === undefined) return null
      const scanned = cellLook(read, threshold)
      const edited = scanned.digit !== look.digit || scanned.style !== look.style
      return {
        tag: KIND_TAG[look.style],
        value: edited ? 'fix' : String(Math.round(read.confidence * 100)),
        low: read.confidence < threshold,
      }
    })
  }, [devTools, showConfidence, scan, looks, threshold])

  return {
    devTools,
    open,
    setOpen,
    view,
    setView,
    labelKinds,
    setLabelKinds,
    showConfidence,
    setShowConfidence,
    confidences,
  }
}
