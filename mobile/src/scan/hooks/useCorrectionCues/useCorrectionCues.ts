import { useEffect, useRef } from 'react'
import { useAnimatedReaction } from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { resultsGateReached, type SweepTiming } from '@/scan/utils/transition.utils'
import { useHaptics } from '@/preferences/hooks/useHaptics'

type Cues = {
  timing: SweepTiming
  /** The scan has a recognised grid. A boolean, not the result: a worklet copies what it captures, and the result holds images. */
  recognised: boolean
  failed: boolean
  editable: boolean
  /** The cell in the panel, or null for the summary. */
  selected: number | null
  /** The play gate is open. */
  ready: boolean
  celebrated: boolean
}

/**
 * The haptic cues that the state of the correction session triggers, not an action of the player: success for the celebration,
 * success when the last check makes the puzzle playable, success when the results gate opens, and a warning for a failed scan.
 */
export function useCorrectionCues({ timing, recognised, failed, editable, selected, ready, celebrated }: Cues): void {
  const { play } = useHaptics()
  const { clock, resultsAt, crossFade } = timing

  const solvedBefore = useRef(false)
  useEffect(() => {
    if (celebrated && !solvedBefore.current) play('success')
    solvedBefore.current = celebrated
  }, [celebrated, play])

  // The first summary of a review only sets the state: a scan that needs no check already had its success haptic. While a cell is
  // open, the summary has no check, so the state waits.
  const readyBefore = useRef<boolean | null>(null)
  useEffect(() => {
    if (!editable || selected !== null) return
    if (readyBefore.current === false && ready) play('success')
    readyBefore.current = ready
  }, [editable, selected, ready, play])

  // A recognised grid gets its success when the results gate opens: the digits start to sweep in at that moment.
  useAnimatedReaction(
    () => recognised && resultsAt != null && resultsAt.value >= 0,
    (gateOpen, previous) => {
      if (gateOpen && previous === false) scheduleOnRN(play, 'success')
    },
  )
  // A failure keeps the results gate closed. Its warning plays when the failure panel starts to slide in.
  useAnimatedReaction(
    () => failed && resultsGateReached(clock?.value, crossFade),
    (go, previous) => {
      if (go && go !== previous) scheduleOnRN(play, 'warning')
    },
  )
}
