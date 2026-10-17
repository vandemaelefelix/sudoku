import { useCallback, useEffect, useRef } from 'react'
import type { CellLook } from '@/scan/utils/correction.utils'

/**
 * Calls `onExit` with the latest looks when the correction screen unmounts after the player could edit it, whatever route leaves:
 * Play, Home, Scan another, Back. A Retake does not call it: the player did not accept the scan. Call the returned function
 * before a Retake. The screen mounts during the capture transition, where the player cannot edit yet, so `editable` guards it.
 */
export function useScanExit(
  looks: readonly CellLook[],
  editable: boolean,
  onExit: ((looks: readonly CellLook[]) => void) | undefined,
): () => void {
  const latest = useRef({ looks, editable, onExit })
  const retaking = useRef(false)
  useEffect(() => {
    latest.current = { looks, editable, onExit }
  })
  useEffect(
    () => () => {
      const { looks: last, editable: could, onExit: exit } = latest.current
      if (could && !retaking.current) exit?.(last)
    },
    [],
  )
  return useCallback(() => {
    retaking.current = true
  }, [])
}
