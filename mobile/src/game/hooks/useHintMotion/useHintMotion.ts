import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useSystemReduceMotion } from '@/game/hooks/useSystemReduceMotion'
import type { HintHighlight } from '@/game/utils/cell.utils'
import { hintTimings, NO_HINT_TIMINGS, type HintTimings } from '@/game/utils/hint.utils'

/** The timings of the last highlight change. The ref keeps its identity, so a new change renders no cell. */
export type HintMotion = RefObject<HintTimings>

/**
 * The timings of each change of the highlight, for the role entrances of the cells. A layout effect writes them: it runs
 * before the effects of the cells, which read the timings when a role mounts.
 */
export function useHintMotion(highlight: HintHighlight | null): HintMotion {
  const reduceMotion = useSystemReduceMotion()
  const timings = useRef<HintTimings>(NO_HINT_TIMINGS)
  const shown = useRef<HintHighlight | null>(null)
  useLayoutEffect(() => {
    if (highlight === shown.current) return
    timings.current = hintTimings(shown.current, highlight, reduceMotion.current)
    shown.current = highlight
  }, [highlight, reduceMotion])
  return timings
}
